import { getDb } from "@/lib/db";
import { yearMonthFromParse } from "@/lib/school-menu";
import type { MealEntry, Person, SchoolMenuParse, SchoolMenuUpload } from "@/lib/types";

type UploadRow = {
  person_id: string;
  entry_type: string;
  year_month: string;
  school: string;
  source_kind: string;
  filename: string;
  uploaded_at: string;
  meal_count: number;
};

type MealRow = {
  date: string;
  person_id: string;
  entry_type: string;
  title: string;
  detail: string;
  school: string;
  source_kind: string;
  quantity: number;
};

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "side"];

export function sortMeals(meals: MealEntry[]) {
  return [...meals].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const rankA = MEAL_ORDER.indexOf(a.entryType);
    const rankB = MEAL_ORDER.indexOf(b.entryType);
    if (rankA !== rankB) return (rankA < 0 ? 9 : rankA) - (rankB < 0 ? 9 : rankB);
    return (a.personName || "").localeCompare(b.personName || "") || a.title.localeCompare(b.title);
  });
}

export function listSchoolMeals(from: string, to: string, people: Person[]): MealEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT date, person_id as person_id, entry_type as entry_type, title, detail,
              school, source_kind as source_kind, quantity
       FROM school_meals
       WHERE date >= ? AND date <= ?
       ORDER BY date, entry_type`,
    )
    .all(from, to) as MealRow[];
  return rows.map((row) => {
    const person = people.find((item) => item.id === row.person_id);
    return {
      date: row.date,
      entryType: row.entry_type,
      title: row.title,
      personId: row.person_id,
      personName: person?.name,
      personColor: person?.color,
      source: "school" as const,
      detail: row.detail || undefined,
      school: row.school || undefined,
    };
  });
}

export function listSchoolMenuUploads(people: Person[]): SchoolMenuUpload[] {
  const rows = getDb()
    .prepare(
      `SELECT person_id, entry_type, year_month, school, source_kind, filename,
              uploaded_at, meal_count
       FROM school_menu_uploads
       ORDER BY year_month DESC, entry_type, person_id`,
    )
    .all() as UploadRow[];
  return rows.map((row) => ({
    personId: row.person_id,
    personName: people.find((item) => item.id === row.person_id)?.name || "Removed person",
    entryType: row.entry_type,
    yearMonth: row.year_month,
    school: row.school,
    sourceKind: row.source_kind,
    filename: row.filename,
    uploadedAt: row.uploaded_at,
    mealCount: row.meal_count,
  }));
}

export function saveSchoolMenu(options: {
  person: Person;
  entryType: "breakfast" | "lunch";
  filename: string;
  parsed: SchoolMenuParse;
}) {
  const yearMonth = yearMonthFromParse(options.parsed);
  const prefix = `${yearMonth}-`;
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM school_meals
       WHERE person_id = ? AND entry_type = ? AND date LIKE ?`,
    ).run(options.person.id, options.entryType, `${prefix}%`);
    const insert = db.prepare(
      `INSERT INTO school_meals
        (date, person_id, entry_type, title, detail, school, source_kind, quantity)
       VALUES
        (@date, @personId, @entryType, @title, @detail, @school, @sourceKind, @quantity)`,
    );
    for (const meal of options.parsed.meals) {
      insert.run({
        date: meal.date,
        personId: options.person.id,
        entryType: options.entryType,
        title: meal.title,
        detail: meal.detail || "",
        school: options.parsed.school,
        sourceKind: options.parsed.kind,
        quantity: meal.quantity || 1,
      });
    }
    db.prepare(
      `INSERT INTO school_menu_uploads
        (person_id, entry_type, year_month, school, source_kind, filename, uploaded_at, meal_count)
       VALUES
        (@personId, @entryType, @yearMonth, @school, @sourceKind, @filename, @uploadedAt, @mealCount)
       ON CONFLICT(person_id, entry_type, year_month) DO UPDATE SET
        school = excluded.school,
        source_kind = excluded.source_kind,
        filename = excluded.filename,
        uploaded_at = excluded.uploaded_at,
        meal_count = excluded.meal_count`,
    ).run({
      personId: options.person.id,
      entryType: options.entryType,
      yearMonth,
      school: options.parsed.school,
      sourceKind: options.parsed.kind,
      filename: options.filename,
      uploadedAt: new Date().toISOString(),
      mealCount: options.parsed.meals.length,
    });
  });
  tx();
  return { yearMonth, mealCount: options.parsed.meals.length };
}

export function deleteSchoolMenu(personId: string, entryType: string, yearMonth: string) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM school_meals
       WHERE person_id = ? AND entry_type = ? AND date LIKE ?`,
    ).run(personId, entryType, `${yearMonth}-%`);
    db.prepare(
      `DELETE FROM school_menu_uploads
       WHERE person_id = ? AND entry_type = ? AND year_month = ?`,
    ).run(personId, entryType, yearMonth);
  });
  tx();
}
