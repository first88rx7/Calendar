import { NextResponse } from "next/server";
import { disconnectGoogle } from "@/lib/google";
import { settingsUnlocked } from "@/lib/settings-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await settingsUnlocked())) {
    return NextResponse.json({ error: "Settings are locked" }, { status: 401 });
  }
  disconnectGoogle();
  return NextResponse.json({ ok: true });
}
