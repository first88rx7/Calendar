import { getPublicConfig } from "@/lib/config";
import { listStoredEvents, mockRecipes, readWeatherCache, seedMockIfNeeded } from "@/lib/mock";
import { listMeals, searchRecipes } from "@/lib/mealie";
import { listSyncStatus } from "@/lib/sync-state";
import { eventTouchesDay, shiftDateKey, weekKeys } from "@/lib/time";
import type { DashboardPayload, RecipeSummary } from "@/lib/types";

export async function loadDashboard(from: string, to: string): Promise<DashboardPayload> {
  seedMockIfNeeded();
  const config = getPublicConfig();
  const tz = config.weather.timezone;
  const allowed = new Set(config.people.map((person) => person.calendarId).filter(Boolean));
  const events = listStoredEvents(shiftDateKey(from, -1), shiftDateKey(to, 1))
    .filter((event) => allowed.has(event.calendarId))
    .filter((event) => {
      for (let day = from; day <= to; day = shiftDateKey(day, 1)) {
        if (eventTouchesDay(event.startIso, event.endIso, event.allDay, day, tz)) {
          return true;
        }
      }
      return false;
    });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const mealFrom = from < today ? from : today;
  const mealHorizon = shiftDateKey(today, 6);
  const mealTo = to > mealHorizon ? to : mealHorizon;
  let recipes: RecipeSummary[] = mockRecipes();
  try {
    recipes = await searchRecipes("");
  } catch {
    recipes = mockRecipes();
  }
  return {
    config,
    events,
    meals: listMeals(mealFrom, mealTo),
    recipes: recipes.slice(0, 24),
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
