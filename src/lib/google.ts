import { google } from "googleapis";
import { readConfig } from "@/lib/config";
import {
  clearOAuth,
  isGoogleConfigured,
  readOAuth,
  writeOAuth,
} from "@/lib/google-store";
import type { CalendarEvent, EventWriteInput, GoogleCalendarInfo } from "@/lib/types";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export { isGoogleConfigured };

export function oauthRedirectUri(origin?: string) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  if (process.env.APP_URL) {
    return `${process.env.APP_URL.replace(/\/$/, "")}/api/auth/google/callback`;
  }
  if (origin) return `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
  return "http://127.0.0.1:3847/api/auth/google/callback";
}

function client(origin?: string) {
  if (!isGoogleConfigured()) {
    throw new Error("Google OAuth is not configured");
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    oauthRedirectUri(origin),
  );
}

export function googleAuthUrl(origin?: string) {
  return client(origin).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCode(code: string, origin?: string) {
  const auth = client(origin);
  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth });
  const me = await oauth2.userinfo.get();
  writeOAuth({
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token ?? null,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    email: me.data.email ?? null,
  });
}

export function disconnectGoogle() {
  clearOAuth();
}

export async function getAuthClient(origin?: string) {
  const stored = readOAuth();
  if (!stored?.access_token && !stored?.refresh_token) return null;
  if (!isGoogleConfigured()) return null;
  const auth = client(origin);
  auth.setCredentials({
    access_token: stored.access_token ?? undefined,
    refresh_token: stored.refresh_token ?? undefined,
    expiry_date: stored.expiry ? Date.parse(stored.expiry) : undefined,
  });
  auth.on("tokens", (tokens) => {
    writeOAuth({
      access_token: tokens.access_token ?? stored.access_token,
      refresh_token: tokens.refresh_token ?? stored.refresh_token,
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : stored.expiry,
      email: stored.email,
    });
  });
  return auth;
}

export async function listGoogleCalendars(): Promise<GoogleCalendarInfo[]> {
  const auth = await getAuthClient();
  if (!auth) return [];
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.calendarList.list({ maxResults: 50 });
  return (res.data.items ?? []).map((item) => ({
    id: item.id || "",
    summary: item.summary || item.id || "Calendar",
    primary: Boolean(item.primary),
    backgroundColor: item.backgroundColor || undefined,
  })).filter((item) => item.id);
}

function mapGoogleEvent(
  calendarId: string,
  event: {
    id?: string | null;
    summary?: string | null;
    description?: string | null;
    location?: string | null;
    htmlLink?: string | null;
    updated?: string | null;
    start?: { date?: string | null; dateTime?: string | null };
    end?: { date?: string | null; dateTime?: string | null };
    status?: string | null;
  },
): CalendarEvent | null {
  if (!event.id || event.status === "cancelled") return null;
  const allDay = Boolean(event.start?.date);
  let startIso = event.start?.dateTime || event.start?.date || "";
  let endIso = event.end?.dateTime || event.end?.date || startIso;
  if (allDay && event.end?.date) {
    const exclusive = event.end.date;
    const inclusive = new Date(`${exclusive}T00:00:00Z`);
    inclusive.setUTCDate(inclusive.getUTCDate() - 1);
    endIso = inclusive.toISOString().slice(0, 10);
    startIso = event.start?.date || startIso;
  }
  return {
    id: event.id,
    calendarId,
    title: event.summary || "(No title)",
    description: event.description || "",
    location: event.location || "",
    startIso,
    endIso,
    allDay,
    htmlLink: event.htmlLink || undefined,
    updatedAt: event.updated || undefined,
  };
}

export async function listGoogleEvents(
  calendarId: string,
  fromIso: string,
  toIso: string,
): Promise<CalendarEvent[]> {
  const auth = await getAuthClient();
  if (!auth) return [];
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.list({
    calendarId,
    timeMin: fromIso,
    timeMax: toIso,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });
  return (res.data.items ?? [])
    .map((item) => mapGoogleEvent(calendarId, item))
    .filter((item): item is CalendarEvent => Boolean(item));
}

function toGoogleTimes(input: EventWriteInput) {
  const tz = readConfig().weather.timezone;
  if (input.allDay) {
    const start = input.startIso.slice(0, 10);
    const endExclusive = new Date(`${input.endIso.slice(0, 10)}T00:00:00Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    return {
      start: { date: start },
      end: { date: endExclusive.toISOString().slice(0, 10) },
    };
  }
  return {
    start: { dateTime: input.startIso, timeZone: tz },
    end: { dateTime: input.endIso, timeZone: tz },
  };
}

export async function createGoogleEvent(input: EventWriteInput): Promise<CalendarEvent> {
  const auth = await getAuthClient();
  if (!auth) throw new Error("Google is not connected");
  const calendar = google.calendar({ version: "v3", auth });
  const times = toGoogleTimes(input);
  const res = await calendar.events.insert({
    calendarId: input.calendarId,
    requestBody: {
      summary: input.title,
      description: input.description || undefined,
      location: input.location || undefined,
      ...times,
    },
  });
  const mapped = mapGoogleEvent(input.calendarId, res.data);
  if (!mapped) throw new Error("Google did not return the new event");
  return mapped;
}

export async function updateGoogleEvent(input: EventWriteInput): Promise<CalendarEvent> {
  if (!input.id) throw new Error("Missing event id");
  const auth = await getAuthClient();
  if (!auth) throw new Error("Google is not connected");
  const calendar = google.calendar({ version: "v3", auth });
  const times = toGoogleTimes(input);
  const res = await calendar.events.patch({
    calendarId: input.calendarId,
    eventId: input.id,
    requestBody: {
      summary: input.title,
      description: input.description || undefined,
      location: input.location || undefined,
      ...times,
    },
  });
  const mapped = mapGoogleEvent(input.calendarId, res.data);
  if (!mapped) throw new Error("Google did not return the updated event");
  return mapped;
}

export async function deleteGoogleEvent(calendarId: string, eventId: string) {
  const auth = await getAuthClient();
  if (!auth) throw new Error("Google is not connected");
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({ calendarId, eventId });
}

export function googleConnected() {
  const stored = readOAuth();
  return Boolean(isGoogleConfigured() && (stored?.refresh_token || stored?.access_token));
}
