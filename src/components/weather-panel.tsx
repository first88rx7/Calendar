"use client";

import { MapPin, RefreshCw } from "lucide-react";
import { WeatherGlyph } from "@/components/weather-glyph";
import { weekdayShort } from "@/lib/time";
import { weatherLabel } from "@/lib/weather-copy";
import type { WeatherHour, WeatherPayload } from "@/lib/types";

function pickHourly(weather: WeatherPayload): WeatherHour[] {
  const wanted = [9, 12, 15, 18, 21];
  const today = weather.daily[0]?.date;
  if (!today || !weather.hourly?.length) return weather.hourly?.slice(0, 5) || [];
  return wanted
    .map((hour) =>
      weather.hourly!.find((item) => {
        const stamp = item.time.replace(" ", "T");
        return stamp.startsWith(today) && stamp.includes(`T${String(hour).padStart(2, "0")}:`);
      }),
    )
    .filter((item): item is WeatherHour => Boolean(item));
}

function hourLabel(time: string) {
  const match = time.match(/T(\d{2})/);
  const hour = match ? Number(match[1]) : 0;
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function WeatherPanel({
  weather,
  locationLabel,
  onRefresh,
  refreshing,
}: {
  weather: WeatherPayload | null;
  locationLabel: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  if (!weather) {
    return <p className="p-5 text-white/70">Weather is still catching up.</p>;
  }

  const unit = weather.unit === "celsius" ? "C" : "F";
  const today = weather.daily[0];
  const hourly = pickHourly(weather);
  const week = weather.daily.slice(0, 7);

  return (
    <div className="flex h-full min-h-0 flex-col p-5">
      <p className="flex items-center gap-1.5 text-sm text-white/65">
        <MapPin className="size-3.5" />
        {locationLabel}
      </p>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-5xl font-semibold tracking-tight">
            {weather.current.temperature}°{unit}
          </p>
          <p className="mt-1 text-white/75">{weatherLabel(weather.current.weatherCode)}</p>
          {today && (
            <p className="mt-2 text-sm text-white/60">
              H {today.tempMax}° · L {today.tempMin}° · Feels {weather.current.apparentTemperature}°
            </p>
          )}
        </div>
        <WeatherGlyph code={weather.current.weatherCode} className="size-14 text-amber-200" />
      </div>

      {hourly.length > 0 && (
        <div className="mt-5 grid grid-cols-5 gap-1">
          {hourly.map((hour) => (
            <div key={hour.time} className="rounded-xl bg-white/6 px-1 py-2 text-center">
              <p className="text-[0.65rem] text-white/55">{hourLabel(hour.time)}</p>
              <WeatherGlyph code={hour.weatherCode} className="mx-auto my-1 size-4" />
              <p className="text-sm font-medium">{hour.temperature}°</p>
            </div>
          ))}
        </div>
      )}

      <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {week.map((day, index) => (
          <li key={day.date} className="flex items-center gap-2 text-sm">
            <span className="w-11 shrink-0 text-white/65">
              {index === 0 ? "Today" : weekdayShort(day.date, weather.timezone)}
            </span>
            <WeatherGlyph code={day.weatherCode} className="size-4 shrink-0" />
            {day.precipitationProbability != null && (
              <span className="w-9 shrink-0 text-xs text-sky-200/80">
                {day.precipitationProbability}%
              </span>
            )}
            <span className="ml-auto text-white/80">
              {day.tempMax}° / {day.tempMin}°
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between text-xs text-white/50">
        <span>Updated just now</span>
        {onRefresh && (
          <button type="button" onClick={onRefresh} className="rounded-md p-1" aria-label="Refresh weather">
            <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
          </button>
        )}
      </div>
    </div>
  );
}
