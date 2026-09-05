import fs from "node:fs";
import { getConfigPath } from "@/lib/paths";
import { isGoogleConfigured, readOAuth } from "@/lib/google-store";
import type { AppConfig, PhotoPrismConfig, PublicConfig } from "@/lib/types";

export const DEFAULT_CONFIG: AppConfig = {
  familyName: "Schumann Family",
  homeName: "Riverside Home",
  weekStartsOn: 0,
  idleTimeoutMs: 180_000,
  nightClockStart: "22:00",
  nightClockEnd: "06:30",
  sleepDimPercent: 78,
  sleepShowClock: true,
  photoRotateSec: 45,
  people: [
    { id: "alex", name: "Alex", color: "#3B9B5C", calendarId: "" },
    { id: "sam", name: "Sam", color: "#6B5B95", calendarId: "" },
    { id: "family", name: "Family", color: "#3B6FDB", calendarId: "" },
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
  photoPrism: {
    url: "",
    username: "",
    password: "",
    albumUid: "",
    query: "",
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

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
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
  const merged = deepMerge(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    fileConfig as Record<string, unknown>,
  ) as unknown as AppConfig;

  if (process.env.FAMILY_NAME) merged.familyName = process.env.FAMILY_NAME;
  if (process.env.HOME_NAME) merged.homeName = process.env.HOME_NAME;
  // WEATHER_* in .env is first-boot only. systemd EnvironmentFile would otherwise
  // pin Seattle (or whatever was in .env) on every read, so a ZIP saved in
  // Settings never reached the kitchen widget.
  if (!fileHasWeather(fileConfig)) {
    if (process.env.WEATHER_LAT) merged.weather.latitude = Number(process.env.WEATHER_LAT);
    if (process.env.WEATHER_LON) merged.weather.longitude = Number(process.env.WEATHER_LON);
    if (process.env.WEATHER_TIMEZONE) merged.weather.timezone = process.env.WEATHER_TIMEZONE;
    if (process.env.WEATHER_UNIT === "celsius" || process.env.WEATHER_UNIT === "fahrenheit") {
      merged.weather.temperatureUnit = process.env.WEATHER_UNIT;
    }
    if (process.env.WEATHER_LABEL) merged.weather.locationLabel = process.env.WEATHER_LABEL;
  }
  if (process.env.MEALIE_URL) merged.mealie.publicUrl = process.env.MEALIE_URL;
  if (process.env.MEALIE_GROUP_SLUG) merged.mealie.groupSlug = process.env.MEALIE_GROUP_SLUG;
  if (process.env.WEEK_STARTS_ON === "1" || process.env.WEEK_STARTS_ON === "0") {
    merged.weekStartsOn = Number(process.env.WEEK_STARTS_ON) as 0 | 1;
  }
  if (process.env.IDLE_TIMEOUT_MS) merged.idleTimeoutMs = Number(process.env.IDLE_TIMEOUT_MS);
  if (process.env.SLEEP_DIM_PERCENT) {
    merged.sleepDimPercent = clamp(Number(process.env.SLEEP_DIM_PERCENT), 40, 95);
  }
  if (process.env.SLEEP_SHOW_CLOCK === "0" || process.env.SLEEP_SHOW_CLOCK === "false") {
    merged.sleepShowClock = false;
  }
  if (process.env.PHOTO_ROTATE_SEC) {
    merged.photoRotateSec = clamp(Number(process.env.PHOTO_ROTATE_SEC), 10, 600);
  }
  if (process.env.PHOTOPRISM_URL) merged.photoPrism.url = process.env.PHOTOPRISM_URL;
  if (process.env.PHOTOPRISM_USER) merged.photoPrism.username = process.env.PHOTOPRISM_USER;
  if (process.env.PHOTOPRISM_PASSWORD) merged.photoPrism.password = process.env.PHOTOPRISM_PASSWORD;
  if (process.env.PHOTOPRISM_ALBUM) merged.photoPrism.albumUid = process.env.PHOTOPRISM_ALBUM;
  if (process.env.PHOTOPRISM_QUERY) merged.photoPrism.query = process.env.PHOTOPRISM_QUERY;

  merged.sleepDimPercent = clamp(merged.sleepDimPercent, 40, 95);
  merged.photoRotateSec = clamp(merged.photoRotateSec, 10, 600);
  if (merged.idleTimeoutMs < 0) merged.idleTimeoutMs = 0;
  merged.photoPrism.url = stripSlash(merged.photoPrism.url);

  return merged;
}

export function writeConfig(next: AppConfig) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2));
}

export function mealieBaseUrl() {
  return stripSlash(process.env.MEALIE_URL || readConfig().mealie.publicUrl || "");
}

export function mealieConfigured() {
  return Boolean(process.env.MEALIE_TOKEN && mealieBaseUrl());
}

export function photoPrismSettings(): PhotoPrismConfig & { token: string } {
  const config = readConfig();
  return {
    url: stripSlash(process.env.PHOTOPRISM_URL || config.photoPrism.url || ""),
    username: process.env.PHOTOPRISM_USER || config.photoPrism.username || "",
    password: process.env.PHOTOPRISM_PASSWORD || config.photoPrism.password || "",
    albumUid: process.env.PHOTOPRISM_ALBUM || config.photoPrism.albumUid || "",
    query: process.env.PHOTOPRISM_QUERY || config.photoPrism.query || "",
    token: process.env.PHOTOPRISM_TOKEN || "",
  };
}

export function photoPrismConfigured() {
  const settings = photoPrismSettings();
  return Boolean(settings.url);
}

export function getPublicConfig(): PublicConfig {
  const config = readConfig();
  const oauth = readOAuth();
  const googleConnected =
    Boolean(oauth?.refresh_token || oauth?.access_token) && isGoogleConfigured();
  const mealieUrl = mealieBaseUrl() || config.mealie.publicUrl || null;
  const prism = photoPrismSettings();
  const people = config.people.map((person) => ({
    ...person,
    calendarId: googleConnected
      ? person.calendarId
      : person.calendarId.startsWith("mock:")
        ? person.calendarId
        : mockCalendarId(person.id),
  }));
  const rest: Omit<AppConfig, "photoPrism"> = {
    familyName: config.familyName,
    homeName: config.homeName,
    weekStartsOn: config.weekStartsOn,
    idleTimeoutMs: config.idleTimeoutMs,
    nightClockStart: config.nightClockStart,
    nightClockEnd: config.nightClockEnd,
    sleepDimPercent: config.sleepDimPercent,
    sleepShowClock: config.sleepShowClock,
    photoRotateSec: config.photoRotateSec,
    people: config.people,
    weather: config.weather,
    mealie: config.mealie,
  };
  return {
    ...rest,
    people,
    googleConnected,
    googleEmail: oauth?.email ?? null,
    mealieConfigured: mealieConfigured(),
    photoPrismConfigured: photoPrismConfigured(),
    settingsPinRequired: Boolean(process.env.SETTINGS_PIN),
    settingsUnlocked: !process.env.SETTINGS_PIN,
    mealieOpenUrl: mealieUrl,
    photoPrism: {
      url: prism.url,
      username: prism.username,
      passwordSet: Boolean(prism.password || prism.token),
      albumUid: prism.albumUid,
      query: prism.query,
    },
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

function fileHasWeather(fileConfig: Partial<AppConfig>) {
  const weather = fileConfig.weather;
  if (!weather || typeof weather !== "object") return false;
  return (
    weather.latitude != null ||
    weather.longitude != null ||
    Boolean(weather.timezone) ||
    Boolean(weather.locationLabel)
  );
}

function stripSlash(value: string) {
  return value.replace(/\/$/, "");
}
