"use client";

import { useState } from "react";
import { EventSheet, type EventSheetState } from "@/components/event-sheet";
import { GlassCard } from "@/components/glass-card";
import { WeekGrid } from "@/components/week-grid";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { shiftDateKey, toDateTimeLocal } from "@/lib/time";
import type { CalendarEvent } from "@/lib/types";

export default function CalendarPage() {
  const { data, error, load, days, today, timezone, start, setWeekStart } = useDashboardData();
  const [sheet, setSheet] = useState<EventSheetState>({ open: false });

  if (error && !data) {
    return <p className="p-8 text-white/70">{error}</p>;
  }
  if (!data) {
    return <p className="p-8 text-white/70">Loading the calendar…</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 lg:p-6">
      <GlassCard className="flex min-h-0 flex-1 flex-col p-4">
        <WeekGrid
          days={days}
          today={today}
          events={data.events}
          people={data.config.people}
          timeZone={timezone}
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
