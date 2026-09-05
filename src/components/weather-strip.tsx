import { weekdayShort } from "@/lib/time";
import { weatherLabel } from "@/lib/weather-copy";
import { WeatherGlyph } from "@/components/weather-glyph";
import type { WeatherPayload } from "@/lib/types";

export function WeatherStrip({
  weather,
  locationLabel,
}: {
  weather: WeatherPayload | null;
  locationLabel: string;
}) {
  if (!weather) {
    return (
      <section className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
        <p className="text-muted-foreground">Weather is still catching up.</p>
      </section>
    );
  }

  const unit = weather.unit === "celsius" ? "C" : "F";
  const today = weather.daily[0];

  return (
    <section className="flex min-h-20 items-center gap-4 overflow-x-auto rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <div className="flex shrink-0 items-center gap-3 pr-4">
        <WeatherGlyph code={weather.current.weatherCode} className="size-10 text-primary" />
        <div>
          <p className="text-3xl font-semibold leading-none">
            {weather.current.temperature}°
            <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {weatherLabel(weather.current.weatherCode)}
            {today ? ` · H ${today.tempMax}° L ${today.tempMin}°` : ""}
          </p>
          <p className="text-xs text-muted-foreground">{locationLabel}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 gap-2">
        {weather.daily.map((day) => (
          <div
            key={day.date}
            className="flex min-w-[4.5rem] flex-1 flex-col items-center rounded-xl bg-secondary/60 px-2 py-2 text-center"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {weekdayShort(day.date, weather.timezone)}
            </span>
            <WeatherGlyph code={day.weatherCode} className="my-1 size-5" />
            <span className="text-sm font-medium">
              {day.tempMax}° <span className="text-muted-foreground">{day.tempMin}°</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
