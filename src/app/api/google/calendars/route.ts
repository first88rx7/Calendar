import { NextResponse } from "next/server";
import { listGoogleCalendars } from "@/lib/google";
import { settingsUnlocked } from "@/lib/settings-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await settingsUnlocked())) {
    return NextResponse.json({ error: "Settings are locked" }, { status: 401 });
  }
  try {
    const calendars = await listGoogleCalendars();
    return NextResponse.json({ calendars });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list calendars";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
