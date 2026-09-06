import fs from "node:fs";
import { getConfigPath } from "@/lib/paths";
import { isGoogleConfigured, readOAuth } from "@/lib/google-store";
import { extractAlbumUid, normalizePhotoPrismUrl } from "@/lib/photoprism-url";
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

function envRuntime(name: string) {
  return process.env[name];
}

function readFileConfig(): Partial<AppConfig> {
  const path = getConfigPath();
  if (!fs.existsSync(path)) return {};
  try {
    return JSON.parse(fs.readFileSync(path, "utf8")) as Partial<AppConfig>;
  } catch {
    return {};
  }
}

/** Defaults + config.json only. systemd WEATHER_* must not win over Settings. */
export function readStoredConfig(): AppConfig {
  return deepMerge(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    readFileConfig() as Record<string, unknown>,
  ) as unknown as AppConfig;
}

export function readConfig(): AppConfig {
  const fileConfig = readFileConfig();
  const merged = readStoredConfig();
  const hasFile = fs.existsSync(getConfigPath());

  if (envRuntime("FAMILY_NAME")) merged.familyName = envRuntime("FAMILY_NAME")!;
  if (envRuntime("HOME_NAME")) merged.homeName = envRuntime("HOME_NAME")!;
  // Weather comes from Settings / config.json. Do not apply WEATHER_* from
  // EnvironmentFile — Next also inlines process.env.WEATHER_* at build time,
  // which pinned Seattle even after a ZIP save.
  if (!hasFile) {
    const lat = envRuntime("WEATHER_LAT");
    const lon = envRuntime("WEATHER_LON");
    const tz = envRuntime("WEATHER_TIMEZONE");
    const unit = envRuntime("WEATHER_UNIT");
    const label = envRuntime("WEATHER_LABEL");
    if (lat) merged.weather.latitude = Number(lat);
    if (lon) merged.weather.longitude = Number(lon);
    if (tz) merged.weather.timezone = tz;
    if (unit === "celsius" || unit === "fahrenheit") merged.weather.temperatureUnit = unit;
    if (label) merged.weather.locationLabel = label;
  } else if (fileConfig.weather && typeof fileConfig.weather === "object") {
    merged.weather = {
      ...merged.weather,
      ...fileConfig.weather,
    };
  }
  if (envRuntime("MEALIE_URL")) merged.mealie.publicUrl = envRuntime("MEALIE_URL")!;
  if (envRuntime("MEALIE_GROUP_SLUG")) merged.mealie.groupSlug = envRuntime("MEALIE_GROUP_SLUG")!;
  if (envRuntime("WEEK_STARTS_ON") === "1" || envRuntime("WEEK_STARTS_ON") === "0") {
    merged.weekStartsOn = Number(envRuntime("WEEK_STARTS_ON")) as 0 | 1;
  }
  if (envRuntime("IDLE_TIMEOUT_MS")) merged.idleTimeoutMs = Number(envRuntime("IDLE_TIMEOUT_MS"));
  if (envRuntime("SLEEP_DIM_PERCENT")) {
    merged.sleepDimPercent = clamp(Number(envRuntime("SLEEP_DIM_PERCENT")), 40, 95);
  }
  if (envRuntime("SLEEP_SHOW_CLOCK") === "0" || envRuntime("SLEEP_SHOW_CLOCK") === "false") {
    merged.sleepShowClock = false;
  }
  if (envRuntime("PHOTO_ROTATE_SEC")) {
    merged.photoRotateSec = clamp(Number(envRuntime("PHOTO_ROTATE_SEC")), 10, 600);
  }
  if (envRuntime("PHOTOPRISM_URL") && !fileConfig.photoPrism?.url) {
    merged.photoPrism.url = envRuntime("PHOTOPRISM_URL")!;
  }
  if (envRuntime("PHOTOPRISM_USER") && !fileConfig.photoPrism?.username) {
    merged.photoPrism.username = envRuntime("PHOTOPRISM_USER")!;
  }
  if (envRuntime("PHOTOPRISM_PASSWORD") && !fileConfig.photoPrism?.password) {
    merged.photoPrism.password = envRuntime("PHOTOPRISM_PASSWORD")!;
  }
  if (envRuntime("PHOTOPRISM_ALBUM") && !fileConfig.photoPrism?.albumUid) {
    merged.photoPrism.albumUid = envRuntime("PHOTOPRISM_ALBUM")!;
  }
  if (envRuntime("PHOTOPRISM_QUERY") && !fileConfig.photoPrism?.query) {
    merged.photoPrism.query = envRuntime("PHOTOPRISM_QUERY")!;
  }

  merged.sleepDimPercent = clamp(merged.sleepDimPercent, 40, 95);
  merged.photoRotateSec = clamp(merged.photoRotateSec, 10, 600);
  if (merged.idleTimeoutMs < 0) merged.idleTimeoutMs = 0;
  merged.photoPrism.url = normalizePhotoPrismUrl(merged.photoPrism.url);
  merged.photoPrism.albumUid = extractAlbumUid(merged.photoPrism.albumUid);

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
    url: normalizePhotoPrismUrl(config.photoPrism.url || process.env.PHOTOPRISM_URL || ""),
    username: config.photoPrism.username || process.env.PHOTOPRISM_USER || "",
    password: config.photoPrism.password || process.env.PHOTOPRISM_PASSWORD || "",
    albumUid: extractAlbumUid(config.photoPrism.albumUid || process.env.PHOTOPRISM_ALBUM || ""),
    query: config.photoPrism.query || process.env.PHOTOPRISM_QUERY || "",
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

function stripSlash(value: string) {
  return value.replace(/\/$/, "");
}
