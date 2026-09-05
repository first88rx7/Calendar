import { getPublicConfig } from "@/lib/config";
import { listStoredEvents, readWeatherCache, seedMockIfNeeded } from "@/lib/mock";
import { listMeals } from "@/lib/mealie";
import { listSyncStatus } from "@/lib/sync-state";
import { weekKeys } from "@/lib/time";
import type { DashboardPayload } from "@/lib/types";

export function loadDashboard(from: string, to: string): DashboardPayload {
  seedMockIfNeeded();
  const config = getPublicConfig();
  const allowed = new Set(config.people.map((person) => person.calendarId).filter(Boolean));
  const events = listStoredEvents(from, to).filter((event) => allowed.has(event.calendarId));
  return {
    config,
    events,
    meals: listMeals(from, to),
    weather: readWeatherCache(),
    status: listSyncStatus(),
    range: { from, to },
  };
}

export function defaultWeekRange(weekStart?: string) {
  const config = getPublicConfig();
  const tz = config.weather.timezone;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const keys = weekKeys(weekStart || today, config.weekStartsOn, tz);
  return { from: keys[0], to: keys[6], keys, today, config };
}
