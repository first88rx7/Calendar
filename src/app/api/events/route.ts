import { NextRequest, NextResponse } from "next/server";
import { createEvent } from "@/lib/events";
import type { EventWriteInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as EventWriteInput;
  if (!body.title?.trim() || !body.calendarId || !body.startIso || !body.endIso) {
    return NextResponse.json({ error: "Title, calendar, start, and end are required." }, { status: 400 });
  }
  try {
    const event = await createEvent({
      ...body,
      title: body.title.trim(),
    });
    return NextResponse.json(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
