"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventSheet, type EventSheetState } from "@/components/event-sheet";
import { MealsRail } from "@/components/meals-rail";
import { StatusBar } from "@/components/status-bar";
import { WallClock } from "@/components/wall-clock";
import { WeatherStrip } from "@/components/weather-strip";
import { WeekGrid } from "@/components/week-grid";
import { contrastText } from "@/lib/color";
import { shiftDateKey, todayKey, toDateTimeLocal, weekKeys } from "@/lib/time";
import type { CalendarEvent, DashboardPayload } from "@/lib/types";

export function Dashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<EventSheetState>({ open: false });

  const timezone = data?.config.weather.timezone || "America/Los_Angeles";
  const today = todayKey(timezone);
  const start = weekStart || today;
  const days = useMemo(
    () => weekKeys(start, data?.config.weekStartsOn ?? 0, timezone),
    [start, data?.config.weekStartsOn, timezone],
  );

  const load = useCallback(async (week?: string, sync = false) => {
    setError(null);
    const key = week || weekStart || undefined;
    try {
      if (sync) {
        setRefreshing(true);
        const response = await fetch(`/api/sync?week=${key || ""}`, { method: "POST" });
        if (!response.ok) throw new Error("Sync failed");
        setData(await response.json());
        return;
      }
      const response = await fetch(`/api/dashboard?week=${key || ""}`);
      if (!response.ok) throw new Error("Could not load the household board");
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the household board");
    } finally {
      setRefreshing(false);
    }
  }, [weekStart]);

  useEffect(() => {
    void load(start, false);
    const id = window.setInterval(() => void load(start, false), 30_000);
    return () => window.clearInterval(id);
  }, [load, start]);

  useEffect(() => {
    void load(undefined, true);
    // first live refresh after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error && !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-xl">The board could not load.</p>
        <p className="text-muted-foreground">{error}</p>
        <button type="button" className="text-primary underline" onClick={() => void load(start, true)}>
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading the week…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {data.config.familyName}
          </p>
          <WallClock timeZone={timezone} />
        </div>
        <div className="flex flex-wrap gap-2">
          {data.config.people.map((person) => (
            <span
              key={person.id}
              className="rounded-full px-3 py-1 text-sm font-medium"
              style={{ backgroundColor: person.color, color: contrastText(person.color) }}
            >
              {person.name}
            </span>
          ))}
        </div>
      </header>
      <WeatherStrip weather={data.weather} locationLabel={data.config.weather.locationLabel} />
      {error && (
        <p className="rounded-xl bg-destructive/20 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <StatusBar status={data.status} refreshing={refreshing} onRefresh={() => void load(start, true)} />
      <div className="flex min-h-0 flex-1 gap-3">
        <WeekGrid
          days={days}
          today={today}
          events={data.events}
          people={data.config.people}
          timeZone={timezone}
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
        <MealsRail meals={data.meals} days={days} today={today} timeZone={timezone} />
      </div>
      <EventSheet
        state={sheet}
        onClose={() => setSheet({ open: false })}
        events={data.events}
        people={data.config.people}
        timeZone={timezone}
        onChanged={() => load(start, true)}
      />
    </div>
  );
}
