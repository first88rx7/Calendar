import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { deleteSchoolMenu, listSchoolMenuUploads, saveSchoolMenu } from "@/lib/school-meals";
import { monthLabel, parseSchoolMenuPdf } from "@/lib/school-menu";
import { settingsUnlocked } from "@/lib/settings-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

export async function GET() {
  if (!(await settingsUnlocked())) {
    return NextResponse.json({ error: "Settings are locked" }, { status: 401 });
  }
  const people = readConfig().people;
  return NextResponse.json({ uploads: listSchoolMenuUploads(people) });
}

export async function POST(request: NextRequest) {
  if (!(await settingsUnlocked())) {
    return NextResponse.json({ error: "Settings are locked" }, { status: 401 });
  }
  const form = await request.formData();
  const file = form.get("file");
  const personId = String(form.get("personId") || "");
  const entryTypeRaw = String(form.get("entryType") || "lunch").toLowerCase();
  const yearMonth = String(form.get("yearMonth") || "");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF to import." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That PDF is too large (8 MB max)." }, { status: 400 });
  }
  const entryType = entryTypeRaw === "breakfast" ? "breakfast" : "lunch";
  const person = readConfig().people.find((item) => item.id === personId);
  if (!person) {
    return NextResponse.json({ error: "Pick who this menu belongs to." }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseSchoolMenuPdf(buffer, file.name, yearMonth || undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read that PDF.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (parsed.meals.length === 0) {
    return NextResponse.json(
      { error: "No school-day meals were found in that PDF." },
      { status: 400 },
    );
  }
  const usedType =
    parsed.mealTypeHint === "breakfast" || parsed.mealTypeHint === "lunch"
      ? parsed.mealTypeHint
      : entryType;
  const saved = saveSchoolMenu({
    person,
    entryType: usedType,
    filename: file.name,
    parsed,
  });
  const hintName = parsed.personHint?.split(/\s+/)[0]?.toLowerCase();
  const assignedName = person.name.split(/\s+/)[0]?.toLowerCase();
  const personMismatch = Boolean(hintName && assignedName && hintName !== assignedName);
  return NextResponse.json({
    ok: true,
    school: parsed.school,
    yearMonth: saved.yearMonth,
    monthLabel: monthLabel(saved.yearMonth),
    mealCount: saved.mealCount,
    entryType: usedType,
    personHint: parsed.personHint,
    personMismatch,
    uploads: listSchoolMenuUploads(readConfig().people),
  });
}

export async function DELETE(request: NextRequest) {
  if (!(await settingsUnlocked())) {
    return NextResponse.json({ error: "Settings are locked" }, { status: 401 });
  }
  const url = request.nextUrl;
  const personId = url.searchParams.get("personId") || "";
  const entryType = url.searchParams.get("entryType") || "";
  const yearMonth = url.searchParams.get("yearMonth") || "";
  if (!personId || !entryType || !yearMonth) {
    return NextResponse.json({ error: "Missing menu to delete." }, { status: 400 });
  }
  deleteSchoolMenu(personId, entryType, yearMonth);
  return NextResponse.json({ ok: true, uploads: listSchoolMenuUploads(readConfig().people) });
}
