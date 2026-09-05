import { NextRequest, NextResponse } from "next/server";
import { getPublicConfig, readConfig, writeConfig } from "@/lib/config";
import { settingsUnlocked } from "@/lib/settings-auth";
import type { AppConfig } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const unlocked = await settingsUnlocked();
  return NextResponse.json({
    ...getPublicConfig(),
    settingsUnlocked: unlocked,
  });
}

export async function PUT(request: NextRequest) {
  if (!(await settingsUnlocked())) {
    return NextResponse.json({ error: "Settings are locked" }, { status: 401 });
  }
  const patch = (await request.json()) as Partial<AppConfig>;
  const current = readConfig();
  const next: AppConfig = {
    ...current,
    ...patch,
    people: (patch.people ?? current.people).map((person) => ({
      ...person,
      calendarId: person.calendarId.startsWith("mock:") ? "" : person.calendarId,
    })),
    weather: { ...current.weather, ...(patch.weather || {}) },
    mealie: { ...current.mealie, ...(patch.mealie || {}) },
  };
  writeConfig(next);
  return NextResponse.json({ ...getPublicConfig(), settingsUnlocked: true });
}
