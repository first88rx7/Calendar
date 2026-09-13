import { getDb } from "@/lib/db";
import {
  lunchGroupLabel,
  lunchGroupMembers,
  listLunchGroups,
  personLunchGroup,
  personOrderIndex,
} from "@/lib/lunch-groups";
import { yearMonthFromParse } from "@/lib/school-menu";
import { schoolMenuKeepFrom } from "@/lib/time";
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

export function sortMeals(meals: MealEntry[], people: Person[] = []) {
  return [...meals].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const rankA = MEAL_ORDER.indexOf(a.entryType);
    const rankB = MEAL_ORDER.indexOf(b.entryType);
    if (rankA !== rankB) return (rankA < 0 ? 9 : rankA) - (rankB < 0 ? 9 : rankB);
    const personA = personOrderIndex(people, a.personId);
    const personB = personOrderIndex(people, b.personId);
    if (personA !== personB) return personA - personB;
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

function groupIdForUploadPerson(personId: string, people: Person[]) {
  const person = people.find((item) => item.id === personId);
  return person ? personLunchGroup(person) : personId;
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
  const collapsed = new Map<string, SchoolMenuUpload>();
  for (const row of rows) {
    const groupId = groupIdForUploadPerson(row.person_id, people);
    const key = `${groupId}|${row.entry_type}|${row.year_month}`;
    const members = lunchGroupMembers(people, groupId);
    const personIds = members.length ? members.map((member) => member.id) : [row.person_id];
    const existing = collapsed.get(key);
    if (existing && existing.uploadedAt >= row.uploaded_at) continue;
    collapsed.set(key, {
      personId: groupId,
      personName: members.length ? lunchGroupLabel(people, groupId) : row.person_id,
      personIds,
      entryType: row.entry_type,
      yearMonth: row.year_month,
      school: row.school,
      sourceKind: row.source_kind,
      filename: row.filename,
      uploadedAt: row.uploaded_at,
      mealCount: row.meal_count,
    });
  }
  return [...collapsed.values()].sort(
    (a, b) =>
      b.yearMonth.localeCompare(a.yearMonth) ||
      a.entryType.localeCompare(b.entryType) ||
      a.personName.localeCompare(b.personName),
  );
}

export function pruneOldSchoolMenus(timeZone: string) {
  const keepFrom = schoolMenuKeepFrom(timeZone);
  const db = getDb();
  db.prepare("DELETE FROM school_menu_uploads WHERE year_month < ?").run(keepFrom);
  db.prepare("DELETE FROM school_meals WHERE date < ?").run(`${keepFrom}-01`);
}

function membersForGroup(people: Person[], groupId: string) {
  const members = lunchGroupMembers(people, groupId);
  if (members.length) return members;
  const person = people.find((item) => item.id === groupId);
  return person ? [person] : [];
}

function writeMealsForPerson(
  personId: string,
  entryType: string,
  yearMonth: string,
  meals: Array<{
    date: string;
    title: string;
    detail: string;
    school: string;
    sourceKind: string;
    quantity: number;
  }>,
) {
  const db = getDb();
  db.prepare(
    `DELETE FROM school_meals
     WHERE person_id = ? AND entry_type = ? AND date LIKE ?`,
  ).run(personId, entryType, `${yearMonth}-%`);
  const insert = db.prepare(
    `INSERT INTO school_meals
      (date, person_id, entry_type, title, detail, school, source_kind, quantity)
     VALUES
      (@date, @personId, @entryType, @title, @detail, @school, @sourceKind, @quantity)`,
  );
  for (const meal of meals) {
    insert.run({
      date: meal.date,
      personId,
      entryType,
      title: meal.title,
      detail: meal.detail || "",
      school: meal.school,
      sourceKind: meal.sourceKind,
      quantity: meal.quantity || 1,
    });
  }
}

function upsertUpload(row: {
  personId: string;
  entryType: string;
  yearMonth: string;
  school: string;
  sourceKind: string;
  filename: string;
  uploadedAt: string;
  mealCount: number;
}) {
  getDb()
    .prepare(
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
    )
    .run(row);
}

function loadMealsFor(personId: string, entryType: string, yearMonth: string) {
  return getDb()
    .prepare(
      `SELECT date, title, detail, school, source_kind as sourceKind, quantity
       FROM school_meals
       WHERE person_id = ? AND entry_type = ? AND date LIKE ?
       ORDER BY date`,
    )
    .all(personId, entryType, `${yearMonth}-%`) as Array<{
    date: string;
    title: string;
    detail: string;
    school: string;
    sourceKind: string;
    quantity: number;
  }>;
}

export function saveSchoolMenu(options: {
  people: Person[];
  groupId: string;
  entryType: "breakfast" | "lunch";
  filename: string;
  parsed: SchoolMenuParse;
  timeZone: string;
}) {
  pruneOldSchoolMenus(options.timeZone);
  const yearMonth = yearMonthFromParse(options.parsed);
  const members = membersForGroup(options.people, options.groupId);
  if (members.length === 0) {
    throw new Error("Pick who this menu belongs to.");
  }
  const meals = options.parsed.meals.map((meal) => ({
    date: meal.date,
    title: meal.title,
    detail: meal.detail || "",
    school: options.parsed.school,
    sourceKind: options.parsed.kind,
    quantity: meal.quantity || 1,
  }));
  const uploadedAt = new Date().toISOString();
  const db = getDb();
  const tx = db.transaction(() => {
    const relatedIds = new Set(members.map((member) => member.id));
    relatedIds.add(options.groupId);
    for (const personId of relatedIds) {
      writeMealsForPerson(personId, options.entryType, yearMonth, []);
      db.prepare(
        `DELETE FROM school_menu_uploads
         WHERE person_id = ? AND entry_type = ? AND year_month = ?`,
      ).run(personId, options.entryType, yearMonth);
    }
    for (const member of members) {
      writeMealsForPerson(member.id, options.entryType, yearMonth, meals);
    }
    upsertUpload({
      personId: options.groupId,
      entryType: options.entryType,
      yearMonth,
      school: options.parsed.school,
      sourceKind: options.parsed.kind,
      filename: options.filename,
      uploadedAt,
      mealCount: options.parsed.meals.length,
    });
  });
  tx();
  pruneOldSchoolMenus(options.timeZone);
  return { yearMonth, mealCount: options.parsed.meals.length };
}

export function deleteSchoolMenu(
  groupId: string,
  entryType: string,
  yearMonth: string,
  people: Person[],
) {
  const members = membersForGroup(people, groupId);
  const ids = new Set([groupId, ...members.map((member) => member.id)]);
  const db = getDb();
  const tx = db.transaction(() => {
    for (const personId of ids) {
      db.prepare(
        `DELETE FROM school_meals
         WHERE person_id = ? AND entry_type = ? AND date LIKE ?`,
      ).run(personId, entryType, `${yearMonth}-%`);
      db.prepare(
        `DELETE FROM school_menu_uploads
         WHERE person_id = ? AND entry_type = ? AND year_month = ?`,
      ).run(personId, entryType, yearMonth);
    }
  });
  tx();
}

export function syncSchoolMenusToPeople(people: Person[], timeZone: string) {
  pruneOldSchoolMenus(timeZone);
  const db = getDb();
  const uploads = db
    .prepare(
      `SELECT person_id, entry_type, year_month, school, source_kind, filename,
              uploaded_at, meal_count
       FROM school_menu_uploads`,
    )
    .all() as UploadRow[];
  const mealRows = db
    .prepare(
      `SELECT date, person_id, entry_type, school, source_kind
       FROM school_meals`,
    )
    .all() as Array<{
    date: string;
    person_id: string;
    entry_type: string;
    school: string;
    source_kind: string;
  }>;

  type MenuMeta = {
    school: string;
    sourceKind: string;
    filename: string;
    uploadedAt: string;
    mealCount: number;
    sourceIds: string[];
  };
  const menusByGroup = new Map<string, Map<string, MenuMeta>>();

  const remember = (groupId: string, entryType: string, yearMonth: string, meta: Partial<MenuMeta> & { sourceId: string }) => {
    if (!groupId) return;
    let groupMenus = menusByGroup.get(groupId);
    if (!groupMenus) {
      groupMenus = new Map();
      menusByGroup.set(groupId, groupMenus);
    }
    const key = `${entryType}|${yearMonth}`;
    const current = groupMenus.get(key) || {
      school: "",
      sourceKind: "",
      filename: "",
      uploadedAt: "",
      mealCount: 0,
      sourceIds: [],
    };
    if (meta.school) current.school = meta.school;
    if (meta.sourceKind) current.sourceKind = meta.sourceKind;
    if (meta.filename) current.filename = meta.filename;
    if (meta.uploadedAt && meta.uploadedAt >= current.uploadedAt) {
      current.uploadedAt = meta.uploadedAt;
      current.mealCount = meta.mealCount || current.mealCount;
    }
    if (!current.sourceIds.includes(meta.sourceId)) current.sourceIds.push(meta.sourceId);
    groupMenus.set(key, current);
  };

  for (const row of uploads) {
    remember(groupIdForUploadPerson(row.person_id, people), row.entry_type, row.year_month, {
      school: row.school,
      sourceKind: row.source_kind,
      filename: row.filename,
      uploadedAt: row.uploaded_at,
      mealCount: row.meal_count,
      sourceId: row.person_id,
    });
  }
  for (const row of mealRows) {
    const person = people.find((item) => item.id === row.person_id);
    if (!person) continue;
    remember(personLunchGroup(person), row.entry_type, row.date.slice(0, 7), {
      school: row.school,
      sourceKind: row.source_kind,
      sourceId: row.person_id,
    });
  }

  const validMeal = new Set<string>();
  const validUpload = new Set<string>();

  const tx = db.transaction(() => {
    for (const group of listLunchGroups(people)) {
      const members = lunchGroupMembers(people, group.id);
      const menus = menusByGroup.get(group.id);
      if (!menus) continue;
      for (const [menuKey, meta] of menus) {
        const [entryType, yearMonth] = menuKey.split("|");
        let sourceMeals: ReturnType<typeof loadMealsFor> = [];
        for (const sourceId of [...meta.sourceIds, ...members.map((member) => member.id)]) {
          sourceMeals = loadMealsFor(sourceId, entryType, yearMonth);
          if (sourceMeals.length) break;
        }
        if (!sourceMeals.length) continue;
        for (const member of members) {
          writeMealsForPerson(member.id, entryType, yearMonth, sourceMeals);
          validMeal.add(`${member.id}|${entryType}|${yearMonth}`);
        }
        const relatedIds = new Set([...meta.sourceIds, ...members.map((member) => member.id), group.id]);
        for (const personId of relatedIds) {
          db.prepare(
            `DELETE FROM school_menu_uploads
             WHERE person_id = ? AND entry_type = ? AND year_month = ?`,
          ).run(personId, entryType, yearMonth);
        }
        upsertUpload({
          personId: group.id,
          entryType,
          yearMonth,
          school: meta.school || sourceMeals[0]?.school || "",
          sourceKind: meta.sourceKind || sourceMeals[0]?.sourceKind || "",
          filename: meta.filename,
          uploadedAt: meta.uploadedAt || new Date().toISOString(),
          mealCount: meta.mealCount || sourceMeals.length,
        });
        validUpload.add(`${group.id}|${entryType}|${yearMonth}`);
      }
    }

    const leftoverUploads = db
      .prepare(
        `SELECT person_id, entry_type, year_month FROM school_menu_uploads`,
      )
      .all() as Array<{ person_id: string; entry_type: string; year_month: string }>;
    for (const row of leftoverUploads) {
      if (!validUpload.has(`${row.person_id}|${row.entry_type}|${row.year_month}`)) {
        db.prepare(
          `DELETE FROM school_menu_uploads
           WHERE person_id = ? AND entry_type = ? AND year_month = ?`,
        ).run(row.person_id, row.entry_type, row.year_month);
      }
    }

    const leftoverMeals = db
      .prepare(`SELECT DISTINCT person_id, entry_type, substr(date, 1, 7) as year_month FROM school_meals`)
      .all() as Array<{ person_id: string; entry_type: string; year_month: string }>;
    for (const row of leftoverMeals) {
      if (!validMeal.has(`${row.person_id}|${row.entry_type}|${row.year_month}`)) {
        db.prepare(
          `DELETE FROM school_meals
           WHERE person_id = ? AND entry_type = ? AND date LIKE ?`,
        ).run(row.person_id, row.entry_type, `${row.year_month}-%`);
      }
    }
  });
  tx();
  pruneOldSchoolMenus(timeZone);
}
