import { NextRequest, NextResponse } from "next/server";
import { unlockSettings } from "@/lib/settings-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { pin?: string };
  const ok = await unlockSettings(body.pin || "");
  if (!ok) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
