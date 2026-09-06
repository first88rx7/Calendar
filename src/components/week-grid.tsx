"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { contrastText } from "@/lib/color";
import { entryTypeLabel } from "@/lib/media";
import {
  dayNumber,
  eventTouchesDay,
  formatCompactTime,
  formatWeekRange,
  hourInZone,
  weekdayShort,
} from "@/lib/time";
import { cn } from "@/lib/utils";
import type { CalendarEvent, MealEntry, Person } from "@/lib/types";

const MEAL_CHIP = "#C26A3A";

const SLOTS = [8, 10, 12, 14, 16, 18, 20];

function slotLabel(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function slotForHour(hour: number) {
  if (hour < SLOTS[0]) return SLOTS[0];
  let match = SLOTS[0];
  for (const slot of SLOTS) {
    if (hour >= slot) match = slot;
  }
  return match;
}

export function WeekGrid({
  days,
  today,
  events,
  meals = [],
  people,
  timeZone,
  onDay,
  onEvent,
  onAdd,
  onPrev,
  onNext,
  onToday,
  compact = false,
}: {
  days: string[];
  today: string;
  events: CalendarEvent[];
  meals?: MealEntry[];
  people: Person[];
  timeZone: string;
  onDay: (day: string) => void;
  onEvent: (event: CalendarEvent) => void;
  onAdd: (day: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
  compact?: boolean;
}) {
  const rangeLabel = days[0] && days[6] ? formatWeekRange(days[0], days[6], timeZone) : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">Family Calendar</h2>
        <div className="ml-auto flex items-center gap-2">
          {onToday && (
            <button
              type="button"
              onClick={onToday}
              className="h-9 rounded-lg bg-white/10 px-3 text-sm font-medium"
            >
              Today
            </button>
          )}
          <button type="button" className="flex size-9 items-center justify-center rounded-lg bg-white/10" onClick={onPrev}>
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" className="flex size-9 items-center justify-center rounded-lg bg-white/10" onClick={onNext}>
            <ChevronRight className="size-5" />
          </button>
          <span className="min-w-[11rem] rounded-lg bg-white/10 px-3 py-2 text-center text-sm">
            {rangeLabel}
          </span>
        </div>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-auto", compact && "text-[0.9rem]")}>
        <div
          className="grid min-h-full"
          style={{
            gridTemplateColumns: `3.2rem repeat(${days.length}, minmax(0, 1fr))`,
            gridTemplateRows: `auto auto auto repeat(${SLOTS.length}, minmax(${compact ? "2.6rem" : "3.1rem"}, 1fr))`,
          }}
        >
          <div />
          {days.map((day) => {
            const isToday = day === today;
            return (
              <button
                key={day}
                type="button"
                onClick={() => onDay(day)}
                className={cn("pb-2 text-center", isToday && "text-white")}
              >
                <span className="block text-xs font-medium uppercase tracking-wide text-white/55">
                  {weekdayShort(day, timeZone)}
                </span>
                <span
                  className={cn(
                    "mt-1 inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold",
                    isToday && "bg-white text-zinc-900",
                  )}
                >
                  {dayNumber(day)}
                </span>
              </button>
            );
          })}

          <div className="pr-2 pt-1 text-right text-[0.65rem] font-medium uppercase tracking-wide text-white/45">
            All day
          </div>
          {days.map((day) => {
            const allDay = events.filter(
              (event) =>
                event.allDay && eventTouchesDay(event.startIso, event.endIso, true, day, timeZone),
            );
            return (
              <div
                key={`all-${day}`}
                className="min-h-10 border-t border-white/8 px-1 py-1"
                onDoubleClick={() => onAdd(day)}
              >
                <div className="flex flex-col gap-1">
                  {allDay.map((event) => (
                    <EventChip
                      key={`${event.calendarId}:${event.id}`}
                      event={event}
                      people={people}
                      timeZone={timeZone}
                      onEvent={onEvent}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          <div className="pr-2 pt-1 text-right text-[0.65rem] font-medium uppercase tracking-wide text-white/45">
            Meals
          </div>
          {days.map((day) => {
            const dayMeals = meals.filter((meal) => meal.date === day);
            return (
              <button
                key={`meal-${day}`}
                type="button"
                className="min-h-10 border-t border-white/8 px-1 py-1 text-left"
                onClick={() => onDay(day)}
              >
                <div className="flex flex-col gap-1">
                  {dayMeals.map((meal) => (
                    <span
                      key={`${meal.date}-${meal.entryType}-${meal.title}`}
                      className="block rounded-lg px-2 py-1 leading-tight"
                      style={{ backgroundColor: MEAL_CHIP, color: contrastText(MEAL_CHIP) }}
                    >
                      <span className="block truncate text-[0.78rem] font-semibold">
                        {entryTypeLabel(meal.entryType)} · {meal.title}
                      </span>
                    </span>
                  ))}
                </div>
              </button>
            );
          })}

          {SLOTS.map((slot) => (
            <TimeRow
              key={slot}
              slot={slot}
              days={days}
              events={events}
              people={people}
              timeZone={timeZone}
              onAdd={onAdd}
              onEvent={onEvent}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimeRow({
  slot,
  days,
  events,
  people,
  timeZone,
  onAdd,
  onEvent,
}: {
  slot: number;
  days: string[];
  events: CalendarEvent[];
  people: Person[];
  timeZone: string;
  onAdd: (day: string) => void;
  onEvent: (event: CalendarEvent) => void;
}) {
  return (
    <>
      <div className="pr-2 pt-1 text-right text-[0.7rem] text-white/45">{slotLabel(slot)}</div>
      {days.map((day) => {
        const slotEvents = events.filter((event) => {
          if (event.allDay) return false;
          if (!eventTouchesDay(event.startIso, event.endIso, false, day, timeZone)) return false;
          return slotForHour(hourInZone(event.startIso, timeZone)) === slot;
        });
        return (
          <button
            key={`${day}-${slot}`}
            type="button"
            className="border-t border-white/8 px-1 py-1 text-left"
            onClick={() => onAdd(day)}
          >
            <div className="flex flex-col gap-1">
              {slotEvents.map((event) => (
                <EventChip
                  key={`${event.calendarId}:${event.id}`}
                  event={event}
                  people={people}
                  timeZone={timeZone}
                  onEvent={onEvent}
                />
              ))}
            </div>
          </button>
        );
      })}
    </>
  );
}

function EventChip({
  event,
  people,
  timeZone,
  onEvent,
}: {
  event: CalendarEvent;
  people: Person[];
  timeZone: string;
  onEvent: (event: CalendarEvent) => void;
}) {
  const person = people.find((item) => item.calendarId === event.calendarId) || people[0];
  const color = person?.color || "#3B6FDB";
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(click) => {
        click.stopPropagation();
        onEvent(event);
      }}
      onKeyDown={(key) => {
        if (key.key === "Enter") onEvent(event);
      }}
      className="block rounded-lg px-2 py-1 leading-tight"
      style={{ backgroundColor: color, color: contrastText(color) }}
    >
      <span className="block truncate text-[0.78rem] font-semibold">{event.title}</span>
      {!event.allDay && (
        <span className="block text-[0.65rem] opacity-85">{formatCompactTime(event.startIso, timeZone)}</span>
      )}
    </span>
  );
}
