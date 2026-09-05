import { NextRequest, NextResponse } from "next/server";
import { patchEvent, removeEvent } from "@/lib/events";
import type { EventWriteInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const body = (await request.json()) as EventWriteInput;
  if (!body.calendarId || !body.title?.trim()) {
    return NextResponse.json({ error: "Calendar and title are required." }, { status: 400 });
  }
  try {
    const event = await patchEvent({ ...body, id, title: body.title.trim() });
    return NextResponse.json(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const calendarId = request.nextUrl.searchParams.get("calendarId");
  if (!calendarId) {
    return NextResponse.json({ error: "calendarId is required" }, { status: 400 });
  }
  try {
    await removeEvent(calendarId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
