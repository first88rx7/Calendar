"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { contrastText } from "@/lib/color";
import { entryTypeLabel } from "@/lib/media";
import {
  eventTouchesDay,
  formatEventTime,
  fromDateTimeLocal,
  toDateTimeLocal,
} from "@/lib/time";
import type { CalendarEvent, EventWriteInput, MealEntry, Person } from "@/lib/types";

export type EventSheetState =
  | { open: false }
  | { open: true; day: string; event?: CalendarEvent; view?: "day" | "form" };

export function EventSheet({
  state,
  onClose,
  events,
  meals = [],
  people,
  timeZone,
  onChanged,
}: {
  state: EventSheetState;
  onClose: () => void;
  events: CalendarEvent[];
  meals?: MealEntry[];
  people: Person[];
  timeZone: string;
  onChanged: () => Promise<void> | void;
}) {
  const [view, setView] = useState<"day" | "form">("day");
  const [current, setCurrent] = useState<CalendarEvent | undefined>();

  useEffect(() => {
    if (!state.open) return;
    setCurrent(state.event);
    setView(state.view || (state.event ? "form" : "day"));
  }, [state]);

  const day = state.open ? state.day : "";
  const dayEvents = events.filter((event) =>
    day ? eventTouchesDay(event.startIso, event.endIso, event.allDay, day, timeZone) : false,
  );
  const dayMeals = meals.filter((meal) => meal.date === day);

  return (
    <Sheet open={state.open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-xl data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        {state.open && view === "day" && (
          <>
            <SheetHeader>
              <SheetTitle className="text-2xl">
                {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </SheetTitle>
              <SheetDescription>
                Tap an event to edit. Meals come from Mealie and stay read-only here.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 px-4">
              <div className="flex flex-col gap-2 pb-4">
                {dayEvents.length === 0 && dayMeals.length === 0 && (
                  <p className="rounded-xl bg-secondary px-4 py-6 text-muted-foreground">
                    Nothing on the calendar this day.
                  </p>
                )}
                {dayMeals.length > 0 && (
                  <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Meals
                  </p>
                )}
                {dayMeals.map((meal) => {
                  const body = (
                    <>
                      <p className="text-xs uppercase tracking-wide opacity-80">
                        {entryTypeLabel(meal.entryType)}
                      </p>
                      <p className="text-lg font-medium">{meal.title}</p>
                      {meal.recipeSlug && (
                        <p className="text-sm opacity-80">Open recipe →</p>
                      )}
                    </>
                  );
                  const className = "rounded-xl px-4 py-3 text-left text-white";
                  const style = { backgroundColor: "#C26A3A" };
                  return meal.recipeSlug ? (
                    <Link
                      key={`${meal.date}-${meal.entryType}-${meal.title}`}
                      href={`/recipes?open=${meal.recipeSlug}`}
                      className={className}
                      style={style}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div
                      key={`${meal.date}-${meal.entryType}-${meal.title}`}
                      className={className}
                      style={style}
                    >
                      {body}
                    </div>
                  );
                })}
                {dayEvents.length > 0 && (
                  <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Events
                  </p>
                )}
                {dayEvents.map((event) => {
                  const person = people.find((item) => item.calendarId === event.calendarId);
                  const color = person?.color || "#a3e635";
                  return (
                    <button
                      key={`${event.calendarId}:${event.id}`}
                      type="button"
                      onClick={() => {
                        setCurrent(event);
                        setView("form");
                      }}
                      className="rounded-xl px-4 py-3 text-left"
                      style={{ backgroundColor: color, color: contrastText(color) }}
                    >
                      <p className="text-lg font-medium">{event.title}</p>
                      <p className="text-sm opacity-80">
                        {formatEventTime(event.startIso, event.endIso, event.allDay, timeZone)}
                        {person ? ` · ${person.name}` : ""}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            <SheetFooter>
              <Button
                className="h-12 text-base"
                onClick={() => {
                  setCurrent(undefined);
                  setView("form");
                }}
              >
                Add event
              </Button>
            </SheetFooter>
          </>
        )}
        {state.open && view === "form" && (
          <EventForm
            day={day}
            event={current}
            people={people}
            timeZone={timeZone}
            onBack={() => (current || dayEvents.length ? setView("day") : onClose())}
            onDone={async () => {
              await onChanged();
              onClose();
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function EventForm({
  day,
  event,
  people,
  timeZone,
  onDone,
  onBack,
}: {
  day: string;
  event?: CalendarEvent;
  people: Person[];
  timeZone: string;
  onDone: () => Promise<void> | void;
  onBack: () => void;
}) {
  const writable = people.filter((person) => person.calendarId);
  const [title, setTitle] = useState(event?.title || "");
  const [calendarId, setCalendarId] = useState(event?.calendarId || writable[0]?.calendarId || "");
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startLocal, setStartLocal] = useState(
    event && !event.allDay ? toDateTimeLocal(event.startIso, timeZone) : `${day}T09:00`,
  );
  const [endLocal, setEndLocal] = useState(
    event && !event.allDay ? toDateTimeLocal(event.endIso, timeZone) : `${day}T10:00`,
  );
  const [dateOnly, setDateOnly] = useState(event?.allDay ? event.startIso.slice(0, 10) : day);
  const [endDateOnly, setEndDateOnly] = useState(event?.allDay ? event.endIso.slice(0, 10) : day);
  const [location, setLocation] = useState(event?.location || "");
  const [description, setDescription] = useState(event?.description || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(event?.title || "");
    setCalendarId(event?.calendarId || writable[0]?.calendarId || "");
    setAllDay(event?.allDay ?? false);
    setStartLocal(event && !event.allDay ? toDateTimeLocal(event.startIso, timeZone) : `${day}T09:00`);
    setEndLocal(event && !event.allDay ? toDateTimeLocal(event.endIso, timeZone) : `${day}T10:00`);
    setDateOnly(event?.allDay ? event.startIso.slice(0, 10) : day);
    setEndDateOnly(event?.allDay ? event.endIso.slice(0, 10) : day);
    setLocation(event?.location || "");
    setDescription(event?.description || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, day]);

  const payload = useMemo((): EventWriteInput => {
    if (allDay) {
      return {
        id: event?.id,
        calendarId,
        title,
        location,
        description,
        allDay: true,
        startIso: dateOnly,
        endIso: endDateOnly || dateOnly,
      };
    }
    return {
      id: event?.id,
      calendarId,
      title,
      location,
      description,
      allDay: false,
      startIso: fromDateTimeLocal(startLocal, timeZone),
      endIso: fromDateTimeLocal(endLocal, timeZone),
    };
  }, [
    allDay,
    calendarId,
    dateOnly,
    description,
    endDateOnly,
    endLocal,
    event?.id,
    location,
    startLocal,
    timeZone,
    title,
  ]);

  async function save() {
    if (!title.trim()) {
      toast.error("Give the event a name.");
      return;
    }
    if (!calendarId) {
      toast.error("Pick whose calendar this belongs on.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(event ? `/api/events/${event.id}` : "/api/events", {
        method: event ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed");
      toast.success(event ? "Event updated" : "Event added");
      await onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!event) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/events/${event.id}?calendarId=${encodeURIComponent(event.calendarId)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delete failed");
      toast.success("Event removed");
      await onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-2xl">{event ? "Edit event" : "Add event"}</SheetTitle>
        <SheetDescription>
          Changes write back to Google when the household account is connected.
        </SheetDescription>
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1 px-4">
        <div className="flex flex-col gap-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              className="h-12 text-lg"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Soccer practice"
            />
          </div>
          <div className="space-y-2">
            <Label>Calendar</Label>
            <Select value={calendarId} onValueChange={(value) => setCalendarId(String(value))}>
              <SelectTrigger className="h-12 w-full min-h-12 text-base">
                <SelectValue placeholder="Whose calendar?" />
              </SelectTrigger>
              <SelectContent>
                {writable.map((person) => (
                  <SelectItem key={person.id} value={person.calendarId}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-3">
            <Label htmlFor="all-day">All day</Label>
            <Switch id="all-day" checked={allDay} onCheckedChange={setAllDay} />
          </div>
          {allDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start-date">Starts</Label>
                <Input
                  id="start-date"
                  type="date"
                  className="h-12 text-base"
                  value={dateOnly}
                  onChange={(event) => setDateOnly(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Ends</Label>
                <Input
                  id="end-date"
                  type="date"
                  className="h-12 text-base"
                  value={endDateOnly}
                  onChange={(event) => setEndDateOnly(event.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start">Starts</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  className="h-12 text-base"
                  value={startLocal}
                  onChange={(event) => setStartLocal(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Ends</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  className="h-12 text-base"
                  value={endLocal}
                  onChange={(event) => setEndLocal(event.target.value)}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="location">Where</Label>
            <Input
              id="location"
              className="h-12 text-base"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              className="min-h-24 text-base"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
      </ScrollArea>
      <SheetFooter className="flex-row gap-2">
        <Button variant="secondary" className="h-12 flex-1 text-base" onClick={onBack} disabled={busy}>
          Back
        </Button>
        {event && (
          <Button variant="destructive" className="h-12 text-base" onClick={remove} disabled={busy}>
            Delete
          </Button>
        )}
        <Button className="h-12 flex-1 text-base" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </SheetFooter>
    </>
  );
}
