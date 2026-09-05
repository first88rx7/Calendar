import fs from "node:fs";
import { getConfigPath } from "@/lib/paths";
import { isGoogleConfigured, readOAuth } from "@/lib/google-store";
import type { AppConfig, PublicConfig } from "@/lib/types";

export const DEFAULT_CONFIG: AppConfig = {
  familyName: "Household",
  weekStartsOn: 0,
  idleTimeoutMs: 180_000,
  nightClockStart: "22:00",
  nightClockEnd: "06:30",
  people: [
    { id: "alex", name: "Alex", color: "#38bdf8", calendarId: "" },
    { id: "sam", name: "Sam", color: "#f472b6", calendarId: "" },
    { id: "family", name: "Family", color: "#a3e635", calendarId: "" },
  ],
  weather: {
    latitude: 47.6062,
    longitude: -122.3321,
    timezone: "America/Los_Angeles",
    temperatureUnit: "fahrenheit",
    locationLabel: "Seattle",
  },
  mealie: {
    publicUrl: "",
    groupSlug: "home",
  },
};

function deepMerge<T extends Record<string, unknown>>(base: T, overlay: Partial<T>): T {
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof out[key as keyof T] === "object" &&
      out[key as keyof T] !== null &&
      !Array.isArray(out[key as keyof T])
    ) {
      out[key as keyof T] = deepMerge(
        out[key as keyof T] as Record<string, unknown>,
        value as Record<string, unknown>,
      ) as T[keyof T];
    } else if (value !== undefined) {
      out[key as keyof T] = value as T[keyof T];
    }
  }
  return out;
}

export function readConfig(): AppConfig {
  const path = getConfigPath();
  let fileConfig: Partial<AppConfig> = {};
  if (fs.existsSync(path)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(path, "utf8")) as Partial<AppConfig>;
    } catch {
      fileConfig = {};
    }
  }
  const merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, fileConfig as Record<string, unknown>) as unknown as AppConfig;

  if (process.env.FAMILY_NAME) merged.familyName = process.env.FAMILY_NAME;
  if (process.env.WEATHER_LAT) merged.weather.latitude = Number(process.env.WEATHER_LAT);
  if (process.env.WEATHER_LON) merged.weather.longitude = Number(process.env.WEATHER_LON);
  if (process.env.WEATHER_TIMEZONE) merged.weather.timezone = process.env.WEATHER_TIMEZONE;
  if (process.env.WEATHER_UNIT === "celsius" || process.env.WEATHER_UNIT === "fahrenheit") {
    merged.weather.temperatureUnit = process.env.WEATHER_UNIT;
  }
  if (process.env.WEATHER_LABEL) merged.weather.locationLabel = process.env.WEATHER_LABEL;
  if (process.env.MEALIE_URL) merged.mealie.publicUrl = process.env.MEALIE_URL;
  if (process.env.MEALIE_GROUP_SLUG) merged.mealie.groupSlug = process.env.MEALIE_GROUP_SLUG;
  if (process.env.WEEK_STARTS_ON === "1" || process.env.WEEK_STARTS_ON === "0") {
    merged.weekStartsOn = Number(process.env.WEEK_STARTS_ON) as 0 | 1;
  }
  if (process.env.IDLE_TIMEOUT_MS) merged.idleTimeoutMs = Number(process.env.IDLE_TIMEOUT_MS);

  return merged;
}

export function writeConfig(next: AppConfig) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2));
}

export function mealieBaseUrl() {
  return (process.env.MEALIE_URL || readConfig().mealie.publicUrl || "").replace(/\/$/, "");
}

export function mealieConfigured() {
  return Boolean(process.env.MEALIE_TOKEN && mealieBaseUrl());
}

export function getPublicConfig(): PublicConfig {
  const config = readConfig();
  const oauth = readOAuth();
  const googleConnected =
    Boolean(oauth?.refresh_token || oauth?.access_token) && isGoogleConfigured();
  const mealieUrl = mealieBaseUrl() || config.mealie.publicUrl || null;
  const people = config.people.map((person) => ({
    ...person,
    calendarId: googleConnected
      ? person.calendarId
      : person.calendarId.startsWith("mock:")
        ? person.calendarId
        : mockCalendarId(person.id),
  }));
  return {
    ...config,
    people,
    googleConnected,
    googleEmail: oauth?.email ?? null,
    mealieConfigured: mealieConfigured(),
    settingsPinRequired: Boolean(process.env.SETTINGS_PIN),
    settingsUnlocked: !process.env.SETTINGS_PIN,
    mealieOpenUrl: mealieUrl,
  };
}

export function personForCalendar(calendarId: string, people = readConfig().people) {
  return (
    people.find((p) => p.calendarId && p.calendarId === calendarId) ||
    people.find((p) => p.id === calendarId) ||
    people[0]
  );
}

export function mockCalendarId(personId: string) {
  return `mock:${personId}`;
}
