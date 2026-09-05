"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contrastText } from "@/lib/color";
import {
  dayNumber,
  eventTouchesDay,
  formatCompactTime,
  monthLabel,
  weekdayShort,
} from "@/lib/time";
import { cn } from "@/lib/utils";
import type { CalendarEvent, Person } from "@/lib/types";

export function WeekGrid({
  days,
  today,
  events,
  people,
  timeZone,
  onDay,
  onEvent,
  onAdd,
  onPrev,
  onNext,
}: {
  days: string[];
  today: string;
  events: CalendarEvent[];
  people: Person[];
  timeZone: string;
  onDay: (day: string) => void;
  onEvent: (event: CalendarEvent) => void;
  onAdd: (day: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const weekLabel =
    days[0] && days[6]
      ? days[0].slice(0, 7) === days[6].slice(0, 7)
        ? monthLabel(days[0], timeZone)
        : `${monthLabel(days[0], timeZone).split(" ")[0]} – ${monthLabel(days[6], timeZone)}`
      : "";

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <Button type="button" variant="secondary" size="icon-lg" className="size-12" onClick={onPrev}>
          <ChevronLeft className="size-6" />
        </Button>
        <h2 className="flex-1 text-center text-xl font-medium">{weekLabel}</h2>
        <Button type="button" variant="secondary" size="icon-lg" className="size-12" onClick={onNext}>
          <ChevronRight className="size-6" />
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-1.5 md:gap-2">
        {days.map((day) => {
          const isToday = day === today;
          const dayEvents = events
            .filter((event) =>
              eventTouchesDay(event.startIso, event.endIso, event.allDay, day, timeZone),
            )
            .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startIso.localeCompare(b.startIso));
          return (
            <div
              key={day}
              className={cn(
                "flex min-h-0 flex-col rounded-2xl bg-card p-2 ring-1 ring-foreground/10",
                isToday && "ring-2 ring-primary",
              )}
            >
              <div className="flex w-full items-center justify-between rounded-xl px-1 py-1">
                <button
                  type="button"
                  onClick={() => onDay(day)}
                  className="text-left"
                >
                  <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {weekdayShort(day, timeZone)}
                  </span>
                  <span className={cn("text-2xl font-semibold", isToday && "text-primary")}>
                    {dayNumber(day)}
                  </span>
                </button>
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-full bg-secondary"
                  onClick={() => onAdd(day)}
                  aria-label={`Add event on ${day}`}
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                {dayEvents.length === 0 && (
                  <p className="px-1 pt-2 text-xs text-muted-foreground">Tap to add</p>
                )}
                {dayEvents.map((event) => {
                  const person =
                    people.find((item) => item.calendarId === event.calendarId) || people[0];
                  const color = person?.color || "#a3e635";
                  return (
                    <button
                      key={`${event.calendarId}:${event.id}:${day}`}
                      type="button"
                      onClick={() => onEvent(event)}
                      className="rounded-xl px-2 py-1.5 text-left text-sm leading-tight"
                      style={{ backgroundColor: color, color: contrastText(color) }}
                    >
                      <span className="block font-medium">{event.title}</span>
                      <span className="block text-[0.7rem] opacity-80">
                        {event.allDay ? "All day" : formatCompactTime(event.startIso, timeZone)}
                        {person ? ` · ${person.name}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
