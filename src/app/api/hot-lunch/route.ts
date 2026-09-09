import { NextRequest, NextResponse } from "next/server";
import { setHotLunch } from "@/lib/hot-lunch";
import { normalizeHotLunchInitials } from "@/lib/hot-lunch-marks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    date?: string;
    initial?: string;
    wanted?: boolean;
  };
  const date = String(body.date || "");
  const initial = normalizeHotLunchInitials([body.initial || ""])[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !initial) {
    return NextResponse.json({ error: "Pick a day and an initial." }, { status: 400 });
  }
  try {
    setHotLunch(date, initial, Boolean(body.wanted));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save hot lunch.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, date, initial, wanted: Boolean(body.wanted) });
}
