import { getDb, rowToEvent, type EventRow } from "@/lib/db";
import {
  createGoogleEvent,
  deleteGoogleEvent,
  googleConnected,
  updateGoogleEvent,
} from "@/lib/google";
import type { CalendarEvent, EventWriteInput } from "@/lib/types";

const upsertSql = `INSERT INTO events (
  id, calendar_id, title, description, location, start_iso, end_iso, all_day, html_link, updated_at
) VALUES (
  @id, @calendarId, @title, @description, @location, @startIso, @endIso, @allDay, @htmlLink, @updatedAt
) ON CONFLICT(calendar_id, id) DO UPDATE SET
  title = excluded.title,
  description = excluded.description,
  location = excluded.location,
  start_iso = excluded.start_iso,
  end_iso = excluded.end_iso,
  all_day = excluded.all_day,
  html_link = excluded.html_link,
  updated_at = excluded.updated_at`;

export function upsertEvent(event: CalendarEvent) {
  getDb()
    .prepare(upsertSql)
    .run({
      id: event.id,
      calendarId: event.calendarId,
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      startIso: event.startIso,
      endIso: event.endIso,
      allDay: event.allDay ? 1 : 0,
      htmlLink: event.htmlLink || null,
      updatedAt: event.updatedAt || new Date().toISOString(),
    });
}

export function replaceCalendarEvents(
  calendarId: string,
  from: string,
  to: string,
  events: CalendarEvent[],
) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM events
       WHERE calendar_id = ?
         AND date(substr(start_iso, 1, 10)) <= date(?)
         AND date(substr(end_iso, 1, 10)) >= date(?)`,
    ).run(calendarId, to, from);
    const stmt = db.prepare(upsertSql);
    for (const event of events) {
      stmt.run({
        id: event.id,
        calendarId: event.calendarId,
        title: event.title,
        description: event.description || "",
        location: event.location || "",
        startIso: event.startIso,
        endIso: event.endIso,
        allDay: event.allDay ? 1 : 0,
        htmlLink: event.htmlLink || null,
        updatedAt: event.updatedAt || new Date().toISOString(),
      });
    }
  });
  tx();
}

export function getEvent(calendarId: string, id: string): CalendarEvent | null {
  const row = getDb()
    .prepare("SELECT * FROM events WHERE calendar_id = ? AND id = ?")
    .get(calendarId, id) as EventRow | undefined;
  return row ? rowToEvent(row) : null;
}

export function deleteStoredEvent(calendarId: string, id: string) {
  getDb().prepare("DELETE FROM events WHERE calendar_id = ? AND id = ?").run(calendarId, id);
}

export async function createEvent(input: EventWriteInput): Promise<CalendarEvent> {
  if (googleConnected() && !input.calendarId.startsWith("mock:")) {
    const created = await createGoogleEvent(input);
    upsertEvent(created);
    return created;
  }
  const local: CalendarEvent = {
    id: input.id || `local-${crypto.randomUUID()}`,
    calendarId: input.calendarId,
    title: input.title,
    description: input.description || "",
    location: input.location || "",
    startIso: input.startIso,
    endIso: input.endIso,
    allDay: input.allDay,
    updatedAt: new Date().toISOString(),
  };
  upsertEvent(local);
  return local;
}

export async function patchEvent(input: EventWriteInput): Promise<CalendarEvent> {
  if (!input.id) throw new Error("Missing event id");
  if (googleConnected() && !input.calendarId.startsWith("mock:") && !input.id.startsWith("local-")) {
    const updated = await updateGoogleEvent(input);
    upsertEvent(updated);
    return updated;
  }
  const next: CalendarEvent = {
    id: input.id,
    calendarId: input.calendarId,
    title: input.title,
    description: input.description || "",
    location: input.location || "",
    startIso: input.startIso,
    endIso: input.endIso,
    allDay: input.allDay,
    updatedAt: new Date().toISOString(),
  };
  upsertEvent(next);
  return next;
}

export async function removeEvent(calendarId: string, id: string) {
  if (googleConnected() && !calendarId.startsWith("mock:") && !id.startsWith("local-")) {
    await deleteGoogleEvent(calendarId, id);
  }
  deleteStoredEvent(calendarId, id);
}
