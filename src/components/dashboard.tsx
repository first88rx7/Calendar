"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventSheet, type EventSheetState } from "@/components/event-sheet";
import { GlassCard } from "@/components/glass-card";
import { RecipeStrip } from "@/components/recipe-strip";
import { WeatherPanel } from "@/components/weather-panel";
import { WeekGrid } from "@/components/week-grid";
import { greeting, shiftDateKey, todayKey, toDateTimeLocal, weekKeys } from "@/lib/time";
import type { CalendarEvent, DashboardPayload } from "@/lib/types";

export function Dashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<EventSheetState>({ open: false });
  const [now, setNow] = useState(() => new Date());

  const timezone = data?.config.weather.timezone || "America/Los_Angeles";
  const today = todayKey(timezone);
  const start = weekStart || today;
  const days = useMemo(
    () => weekKeys(start, data?.config.weekStartsOn ?? 0, timezone),
    [start, data?.config.weekStartsOn, timezone],
  );

  const load = useCallback(
    async (week?: string, sync = false) => {
      setError(null);
      const key = week || weekStart || undefined;
      try {
        if (sync) {
          setRefreshing(true);
          const response = await fetch(`/api/sync?week=${key || ""}`, {
            method: "POST",
            cache: "no-store",
          });
          if (!response.ok) throw new Error("Sync failed");
          setData(await response.json());
          return;
        }
        const response = await fetch(`/api/dashboard?week=${key || ""}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load the household board");
        setData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the household board");
      } finally {
        setRefreshing(false);
      }
    },
    [weekStart],
  );

  useEffect(() => {
    void load(start, false);
    const id = window.setInterval(() => void load(start, false), 30_000);
    return () => window.clearInterval(id);
  }, [load, start]);

  useEffect(() => {
    void load(undefined, true);
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error && !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-xl">The board could not load.</p>
        <p className="text-white/70">{error}</p>
        <button type="button" className="underline" onClick={() => void load(start, true)}>
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-white/70">Loading the week…</div>
    );
  }

  const clock = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 lg:h-full lg:overflow-hidden lg:p-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
            {greeting(timezone, now)}, {data.config.familyName}!
          </h1>
          <p className="text-sm text-white/65">{dateLabel}</p>
        </div>
        <p className="text-3xl font-semibold tracking-tight lg:text-4xl">{clock}</p>
      </header>

      {error && <p className="shrink-0 rounded-xl bg-red-500/20 px-3 py-2 text-sm">{error}</p>}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)_auto]">
        <GlassCard className="flex min-h-0 flex-col overflow-hidden p-3 lg:row-start-1">
          <WeekGrid
            days={days}
            today={today}
            events={data.events}
            meals={data.meals}
            people={data.config.people}
            timeZone={timezone}
            compact
            onToday={() => setWeekStart(today)}
            onDay={(day) => setSheet({ open: true, day, view: "day" })}
            onEvent={(event: CalendarEvent) =>
              setSheet({
                open: true,
                day: event.allDay
                  ? event.startIso.slice(0, 10)
                  : toDateTimeLocal(event.startIso, timezone).slice(0, 10),
                event,
                view: "form",
              })
            }
            onAdd={(day) => setSheet({ open: true, day, view: "form" })}
            onPrev={() => setWeekStart(shiftDateKey(days[0], -7))}
            onNext={() => setWeekStart(shiftDateKey(days[0], 7))}
          />
        </GlassCard>
        <GlassCard className="min-h-0 overflow-hidden max-lg:min-h-[22rem] lg:col-start-2 lg:row-span-2">
          <WeatherPanel
            weather={data.weather}
            locationLabel={data.config.weather.locationLabel}
            onRefresh={() => void load(start, true)}
            refreshing={refreshing}
          />
        </GlassCard>
        <GlassCard className="shrink-0 overflow-hidden lg:col-start-1 lg:row-start-2">
          <RecipeStrip recipes={data.recipes} compact />
        </GlassCard>
      </div>

      <EventSheet
        state={sheet}
        onClose={() => setSheet({ open: false })}
        events={data.events}
        meals={data.meals}
        people={data.config.people}
        timeZone={timezone}
        onChanged={() => load(start, true)}
      />
    </div>
  );
}
