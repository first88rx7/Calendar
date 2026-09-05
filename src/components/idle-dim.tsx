"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { PhotoBackdrop } from "@/components/photo-backdrop";
import { formatClock, formatLongDate, isNightHours } from "@/lib/time";
import { weatherLabel } from "@/lib/weather-copy";
import type { PublicConfig, WeatherPayload } from "@/lib/types";

type IdleApi = {
  dimmed: boolean;
  dimNow: () => void;
  wake: () => void;
};

const IdleDimContext = createContext<IdleApi>({
  dimmed: false,
  dimNow: () => {},
  wake: () => {},
});

export function useIdleDim() {
  return useContext(IdleDimContext);
}

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
        const response = await fetch("/api/dashboard", { cache: "no-store" });
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
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const timezone = config?.weather.timezone || "America/Los_Angeles";
  const night = config
    ? isNightHours(timezone, config.nightClockStart, config.nightClockEnd, now)
    : false;
  const configuredTimeout = config?.idleTimeoutMs ?? 180_000;
  const timeout =
    configuredTimeout === 0
      ? 0
      : night
        ? Math.min(configuredTimeout, 45_000)
        : configuredTimeout;
  const dimPercent = config?.sleepDimPercent ?? 78;
  const showClock = config?.sleepShowClock ?? true;

  const wake = () => {
    setDimmed(false);
    if (timer.current) window.clearTimeout(timer.current);
    if (timeout > 0) {
      timer.current = window.setTimeout(() => setDimmed(true), timeout);
    } else {
      timer.current = null;
    }
  };

  const dimNow = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setDimmed(true);
  };

  useEffect(() => {
    wake();
    const onActivity = () => wake();
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
    <IdleDimContext.Provider value={{ dimmed, dimNow, wake }}>
      <div className="relative min-h-[100dvh]">
        <PhotoBackdrop />
        <div className="relative z-10">{children}</div>
        {dimmed && (
          <button
            type="button"
            className="fixed inset-0 z-80 flex flex-col items-center justify-center text-center"
            style={{ backgroundColor: `rgba(0, 0, 0, ${dimPercent / 100})` }}
            onClick={() => wake()}
          >
            {showClock && (
              <>
                <p className="text-7xl font-semibold tracking-tight text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.7)] md:text-8xl">
                  {formatClock(timezone, now)}
                </p>
                <p className="mt-3 text-2xl text-white/80 drop-shadow-[0_4px_16px_rgba(0,0,0,0.65)]">
                  {formatLongDate(timezone, now)}
                </p>
                {weather && (
                  <p className="mt-6 text-xl text-white/75 drop-shadow-[0_4px_16px_rgba(0,0,0,0.65)]">
                    {Math.round(weather.current.temperature)}° · {weatherLabel(weather.current.weatherCode)}
                  </p>
                )}
              </>
            )}
            <p className="mt-10 text-sm uppercase tracking-[0.2em] text-white/55">Tap to wake</p>
          </button>
        )}
      </div>
    </IdleDimContext.Provider>
  );
}
