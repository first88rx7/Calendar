import { readConfig } from "@/lib/config";
import { getDb } from "@/lib/db";
import { mockWeather } from "@/lib/mock";
import { setSyncState } from "@/lib/sync-state";
import type { WeatherDay, WeatherNow, WeatherPayload } from "@/lib/types";

export { weatherLabel } from "@/lib/weather-copy";

type OpenMeteoResponse = {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
  };
};

export async function syncWeather() {
  const config = readConfig();
  const { latitude, longitude, timezone, temperatureUnit } = config.weather;
  const unit = temperatureUnit === "celsius" ? "celsius" : "fahrenheit";
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    current: [
      "temperature_2m",
      "apparent_temperature",
      "weather_code",
      "wind_speed_10m",
      "relative_humidity_2m",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
    ].join(","),
    temperature_unit: unit,
    wind_speed_unit: "mph",
    forecast_days: "7",
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo ${response.status}`);
    }
    const data = (await response.json()) as OpenMeteoResponse;
    if (!data.current || !data.daily) {
      throw new Error("Open-Meteo returned an empty forecast");
    }
    const current: WeatherNow = {
      temperature: Math.round(data.current.temperature_2m),
      apparentTemperature: Math.round(data.current.apparent_temperature),
      weatherCode: data.current.weather_code,
      windSpeed: Math.round(data.current.wind_speed_10m),
      humidity: Math.round(data.current.relative_humidity_2m),
    };
    const daily: WeatherDay[] = data.daily.time.map((date, i) => ({
      date,
      weatherCode: data.daily!.weather_code[i],
      tempMax: Math.round(data.daily!.temperature_2m_max[i]),
      tempMin: Math.round(data.daily!.temperature_2m_min[i]),
      precipitationProbability: data.daily!.precipitation_probability_max[i] ?? 0,
    }));
    const payload: WeatherPayload = { current, daily, timezone, unit };
    getDb()
      .prepare(
        `INSERT INTO weather_cache (id, payload, updated_at) VALUES (1, @payload, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      )
      .run({ payload: JSON.stringify(payload), updatedAt: new Date().toISOString() });
    setSyncState("weather", "live");
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weather sync failed";
    setSyncState("weather", "mock", message);
    const fallback = mockWeather(timezone, unit);
    getDb()
      .prepare(
        `INSERT INTO weather_cache (id, payload, updated_at) VALUES (1, @payload, @updatedAt)
         ON CONFLICT(id) DO NOTHING`,
      )
      .run({ payload: JSON.stringify(fallback), updatedAt: new Date().toISOString() });
    throw error;
  }
}

