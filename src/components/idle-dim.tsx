"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock, formatLongDate, isNightHours } from "@/lib/time";
import { weatherLabel } from "@/lib/weather-copy";
import type { PublicConfig, WeatherPayload } from "@/lib/types";

export function IdleDim({ children }: { children: React.ReactNode }) {
  const [dimmed, setDimmed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/dashboard");
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setConfig(data.config);
          setWeather(data.weather);
        }
      } catch {
        /* keep defaults */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const timezone = config?.weather.timezone || "America/Los_Angeles";
  const night = config
    ? isNightHours(timezone, config.nightClockStart, config.nightClockEnd, now)
    : false;
  const timeout = night ? Math.min(config?.idleTimeoutMs || 180000, 45000) : config?.idleTimeoutMs || 180000;

  const bump = () => {
    setDimmed(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDimmed(true), timeout);
  };

  useEffect(() => {
    bump();
    const onActivity = () => bump();
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity);
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.clearInterval(clock);
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeout]);

  return (
    <div className="relative min-h-[100dvh]">
      {children}
      {dimmed && (
        <button
          type="button"
          className="absolute inset-0 z-80 flex flex-col items-center justify-center bg-black/88 text-center"
          onClick={() => bump()}
        >
          <p className="text-7xl font-semibold tracking-tight md:text-8xl">
            {formatClock(timezone, now)}
          </p>
          <p className="mt-3 text-2xl text-muted-foreground">{formatLongDate(timezone, now)}</p>
          {weather && (
            <p className="mt-6 text-xl text-muted-foreground">
              {Math.round(weather.current.temperature)}° · {weatherLabel(weather.current.weatherCode)}
            </p>
          )}
          <p className="mt-10 text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Tap to wake
          </p>
        </button>
      )}
    </div>
  );
}
