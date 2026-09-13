import { NextRequest, NextResponse } from "next/server";
import { readConfig, readStoredConfig, writeConfig } from "@/lib/config";
import { lunchGroupLabel, lunchGroupMembers, personLunchGroup } from "@/lib/lunch-groups";
import {
  deleteSchoolMenu,
  listSchoolMenuUploads,
  pruneOldSchoolMenus,
  saveSchoolMenu,
  syncSchoolMenusToPeople,
} from "@/lib/school-meals";
import { monthLabel, parseSchoolMenuPdf } from "@/lib/school-menu";
import { settingsUnlocked } from "@/lib/settings-auth";
import type { Person } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

function persistPeopleFromForm(raw: string) {
  if (!raw.trim()) return readConfig().people;
  try {
    const parsed = JSON.parse(raw) as Person[];
    if (!Array.isArray(parsed) || parsed.length === 0) return readConfig().people;
    const current = readStoredConfig();
    current.people = parsed.map((person, index) => {
      const stored = current.people.find((item) => item.id === person.id);
      const id = String(person.id || stored?.id || `person-${index + 1}`);
      const calendarId = String(person.calendarId || "");
      return {
        id,
        name: String(person.name || stored?.name || `Person ${index + 1}`).trim(),
        color: String(person.color || stored?.color || "#3B6FDB"),
        calendarId: calendarId.startsWith("mock:") ? stored?.calendarId || "" : calendarId,
        lunchGroup: personLunchGroup({ ...person, id }),
      };
    });
    writeConfig(current);
    return current.people;
  } catch {
    return readConfig().people;
  }
}

export async function GET() {
  if (!(await settingsUnlocked())) {
    return NextResponse.json({ error: "Settings are locked" }, { status: 401 });
  }
  const config = readConfig();
  pruneOldSchoolMenus(config.weather.timezone);
  return NextResponse.json({ uploads: listSchoolMenuUploads(config.people) });
}

export async function POST(request: NextRequest) {
  if (!(await settingsUnlocked())) {
    return NextResponse.json({ error: "Settings are locked" }, { status: 401 });
  }
  const form = await request.formData();
  const file = form.get("file");
  const people = persistPeopleFromForm(String(form.get("people") || ""));
  const config = readConfig();
  const timeZone = config.weather.timezone;
  const groupIdRaw = String(form.get("lunchGroup") || form.get("personId") || "");
  const entryTypeRaw = String(form.get("entryType") || "lunch").toLowerCase();
  const yearMonth = String(form.get("yearMonth") || "");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF to import." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That PDF is too large (8 MB max)." }, { status: 400 });
  }
  const entryType = entryTypeRaw === "breakfast" ? "breakfast" : "lunch";
  const person = people.find((item) => item.id === groupIdRaw);
  const groupId = person ? personLunchGroup(person) : groupIdRaw;
  const members = lunchGroupMembers(people, groupId);
  if (!groupId || members.length === 0) {
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
    people,
    groupId,
    entryType: usedType,
    filename: file.name,
    parsed,
    timeZone,
  });
  const hintName = parsed.personHint?.split(/\s+/)[0]?.toLowerCase();
  const personMismatch = Boolean(
    hintName &&
      !members.some((item) => item.name.split(/\s+/)[0]?.toLowerCase() === hintName),
  );
  return NextResponse.json({
    ok: true,
    school: parsed.school,
    yearMonth: saved.yearMonth,
    monthLabel: monthLabel(saved.yearMonth),
    mealCount: saved.mealCount,
    entryType: usedType,
    personHint: parsed.personHint,
    personMismatch,
    groupLabel: lunchGroupLabel(people, groupId),
    uploads: listSchoolMenuUploads(readConfig().people),
  });
}

export async function DELETE(request: NextRequest) {
  if (!(await settingsUnlocked())) {
    return NextResponse.json({ error: "Settings are locked" }, { status: 401 });
  }
  const url = request.nextUrl;
  const groupId = url.searchParams.get("lunchGroup") || url.searchParams.get("personId") || "";
  const entryType = url.searchParams.get("entryType") || "";
  const yearMonth = url.searchParams.get("yearMonth") || "";
  if (!groupId || !entryType || !yearMonth) {
    return NextResponse.json({ error: "Missing menu to delete." }, { status: 400 });
  }
  const people = readConfig().people;
  deleteSchoolMenu(groupId, entryType, yearMonth, people);
  pruneOldSchoolMenus(readConfig().weather.timezone);
  syncSchoolMenusToPeople(readConfig().people, readConfig().weather.timezone);
  return NextResponse.json({ ok: true, uploads: listSchoolMenuUploads(readConfig().people) });
}
