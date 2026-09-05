import { addDays, parseISO } from "date-fns";
import { mealieConfigured, mockCalendarId, readConfig } from "@/lib/config";
import { replaceCalendarEvents } from "@/lib/events";
import { googleConnected, listGoogleEvents } from "@/lib/google";
import { syncMeals } from "@/lib/mealie";
import { seedMockIfNeeded } from "@/lib/mock";
import { setSyncState } from "@/lib/sync-state";
import { syncWeather } from "@/lib/weather";

let loopStarted = false;
let syncing = false;

function assignedCalendars() {
  return readConfig().people.filter((person) => person.calendarId && !person.calendarId.startsWith("mock:"));
}

export async function runSync(from?: string, to?: string) {
  if (syncing) return;
  syncing = true;
  try {
    seedMockIfNeeded();
    const config = readConfig();
    const tz = config.weather.timezone;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const rangeStart = from || addDays(parseISO(today), -14).toISOString().slice(0, 10);
    const rangeEnd = to || addDays(parseISO(today), 21).toISOString().slice(0, 10);

    const weatherPromise = syncWeather().catch((error) => {
      console.error("Weather sync failed", error);
    });
    const mealiePromise = mealieConfigured()
      ? syncMeals(rangeStart, rangeEnd).catch((error) => {
          console.error("Mealie sync failed", error);
        })
      : Promise.resolve(setSyncState("mealie", "mock"));

    if (googleConnected()) {
      try {
        const timeMin = `${rangeStart}T00:00:00.000Z`;
        const timeMax = `${rangeEnd}T23:59:59.999Z`;
        const people = assignedCalendars();
        if (people.length === 0) {
          setSyncState("google", "live", "Assign a Google calendar to someone in Settings");
        } else {
          for (const person of people) {
            const events = await listGoogleEvents(person.calendarId, timeMin, timeMax);
            replaceCalendarEvents(person.calendarId, rangeStart, rangeEnd, events);
          }
          setSyncState("google", "live");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Google sync failed";
        setSyncState("google", "live", message);
        console.error("Google sync failed", error);
      }
    } else {
      for (const person of config.people) {
        if (!person.calendarId) {
          person.calendarId = mockCalendarId(person.id);
        }
      }
      setSyncState("google", "mock");
    }

    await Promise.all([weatherPromise, mealiePromise]);
  } finally {
    syncing = false;
  }
}

export function startSyncLoop() {
  if (loopStarted) return;
  loopStarted = true;
  const interval = Number(process.env.SYNC_INTERVAL_MS || 5 * 60 * 1000);
  void runSync();
  setInterval(() => {
    void runSync();
  }, interval);
}
