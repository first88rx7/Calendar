export type Person = {
  id: string;
  name: string;
  color: string;
  calendarId: string;
};

export type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  startIso: string;
  endIso: string;
  allDay: boolean;
  htmlLink?: string;
  updatedAt?: string;
};

export type MealEntry = {
  date: string;
  entryType: string;
  title: string;
  recipeSlug?: string;
  recipeId?: string;
  imageUrl?: string;
};

export type WeatherDay = {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
};

export type WeatherHour = {
  time: string;
  temperature: number;
  weatherCode: number;
};

export type WeatherNow = {
  temperature: number;
  weatherCode: number;
  apparentTemperature: number;
  windSpeed: number;
  humidity: number;
};

export type WeatherPayload = {
  current: WeatherNow;
  daily: WeatherDay[];
  hourly?: WeatherHour[];
  timezone: string;
  unit: "fahrenheit" | "celsius";
};

export type SyncSource = "google" | "mealie" | "weather" | "photos";

export type SyncStatus = {
  source: SyncSource;
  lastSuccessAt: string | null;
  lastError: string | null;
  mode: "live" | "mock";
};

export type PhotoPrismConfig = {
  url: string;
  username: string;
  password: string;
  albumUid: string;
  query: string;
};

export type PublicPhotoPrism = {
  url: string;
  username: string;
  passwordSet: boolean;
  albumUid: string;
  query: string;
};

export type AppConfig = {
  familyName: string;
  homeName: string;
  weekStartsOn: 0 | 1;
  idleTimeoutMs: number;
  nightClockStart: string;
  nightClockEnd: string;
  sleepDimPercent: number;
  sleepShowClock: boolean;
  photoRotateSec: number;
  people: Person[];
  weather: {
    latitude: number;
    longitude: number;
    timezone: string;
    temperatureUnit: "fahrenheit" | "celsius";
    locationLabel: string;
  };
  mealie: {
    publicUrl: string;
    groupSlug: string;
  };
  photoPrism: PhotoPrismConfig;
};

export type PublicConfig = Omit<AppConfig, "photoPrism"> & {
  googleConnected: boolean;
  googleEmail: string | null;
  mealieConfigured: boolean;
  photoPrismConfigured: boolean;
  settingsPinRequired: boolean;
  settingsUnlocked: boolean;
  mealieOpenUrl: string | null;
  photoPrism: PublicPhotoPrism;
};

export type SlideshowPhoto = {
  hash: string;
  src: string;
  thumbSrc: string;
  title: string;
};

export type SlideshowPayload = {
  configured: boolean;
  rotateSec: number;
  photos: SlideshowPhoto[];
  error?: string;
};

export type RecipeSummary = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  imageUrl?: string;
  totalTime?: string;
  rating?: number;
};

export type RecipeDetail = RecipeSummary & {
  ingredients: string[];
  instructions: string[];
  servings?: string;
  mealieUrl?: string;
};

export type DashboardPayload = {
  config: PublicConfig;
  events: CalendarEvent[];
  meals: MealEntry[];
  recipes: RecipeSummary[];
  weather: WeatherPayload | null;
  status: SyncStatus[];
  range: { from: string; to: string };
};

export type EventWriteInput = {
  id?: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startIso: string;
  endIso: string;
  allDay: boolean;
};

export type GoogleCalendarInfo = {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
};
