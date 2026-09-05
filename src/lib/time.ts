import {
  addDays,
  addMinutes,
  parseISO,
} from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export function todayKey(timeZone: string, now = new Date()) {
  return formatInTimeZone(now, timeZone, "yyyy-MM-dd");
}

export function formatClock(timeZone: string, now = new Date()) {
  return formatInTimeZone(now, timeZone, "h:mm a");
}

export function formatLongDate(timeZone: string, now = new Date()) {
  return formatInTimeZone(now, timeZone, "EEEE, MMMM d");
}

export function weekdayShort(dateKey: string, timeZone: string) {
  const date = fromZonedTime(`${dateKey}T12:00:00`, timeZone);
  return formatInTimeZone(date, timeZone, "EEE");
}

export function dayNumber(dateKey: string) {
  return dateKey.slice(8, 10).replace(/^0/, "") || dateKey.slice(8, 10);
}

export function monthLabel(dateKey: string, timeZone: string) {
  const date = fromZonedTime(`${dateKey}T12:00:00`, timeZone);
  return formatInTimeZone(date, timeZone, "MMMM yyyy");
}

function jsWeekday(dateKey: string, timeZone: string) {
  const date = fromZonedTime(`${dateKey}T12:00:00`, timeZone);
  const iso = Number(formatInTimeZone(date, timeZone, "i"));
  return iso === 7 ? 0 : iso;
}

export function startOfWeekKey(
  dateKey: string,
  weekStartsOn: 0 | 1,
  timeZone: string,
) {
  const weekday = jsWeekday(dateKey, timeZone);
  const offset =
    weekStartsOn === 0 ? weekday : weekday === 0 ? 6 : weekday - 1;
  return shiftDateKey(dateKey, -offset);
}

export function shiftDateKey(dateKey: string, days: number) {
  return addDays(parseISO(dateKey), days).toISOString().slice(0, 10);
}

export function weekKeys(
  weekStart: string,
  weekStartsOn: 0 | 1,
  timeZone: string,
) {
  const start = startOfWeekKey(weekStart, weekStartsOn, timeZone);
  return Array.from({ length: 7 }, (_, i) => shiftDateKey(start, i));
}

export function eventTouchesDay(
  startIso: string,
  endIso: string,
  allDay: boolean,
  dayKey: string,
  timeZone: string,
) {
  if (allDay) {
    const start = startIso.slice(0, 10);
    const end = endIso.slice(0, 10);
    return dayKey >= start && dayKey <= end;
  }
  const startDay = formatInTimeZone(parseISO(startIso), timeZone, "yyyy-MM-dd");
  const endDate = parseISO(endIso);
  const endDayRaw = formatInTimeZone(endDate, timeZone, "yyyy-MM-dd");
  const endsMidnight =
    formatInTimeZone(endDate, timeZone, "HH:mm:ss") === "00:00:00";
  const lastDay = endsMidnight ? shiftDateKey(endDayRaw, -1) : endDayRaw;
  return dayKey >= startDay && dayKey <= lastDay;
}

export function formatEventTime(
  startIso: string,
  endIso: string,
  allDay: boolean,
  timeZone: string,
) {
  if (allDay) return "All day";
  const start = formatInTimeZone(parseISO(startIso), timeZone, "h:mm a");
  const end = formatInTimeZone(parseISO(endIso), timeZone, "h:mm a");
  return `${start} – ${end}`;
}

export function formatCompactTime(startIso: string, timeZone: string) {
  return formatInTimeZone(parseISO(startIso), timeZone, "h:mm a").replace(
    ":00 ",
    " ",
  );
}

export function defaultEventTimes(dayKey: string, timeZone: string) {
  const start = fromZonedTime(`${dayKey}T09:00:00`, timeZone);
  const end = addMinutes(start, 60);
  return { start, end };
}

export function toDateTimeLocal(iso: string, timeZone: string) {
  return formatInTimeZone(parseISO(iso), timeZone, "yyyy-MM-dd'T'HH:mm");
}

export function fromDateTimeLocal(value: string, timeZone: string) {
  return fromZonedTime(value, timeZone).toISOString();
}

export function isNightHours(
  timeZone: string,
  start: string,
  end: string,
  now = new Date(),
) {
  const current = formatInTimeZone(now, timeZone, "HH:mm");
  if (start <= end) return current >= start && current < end;
  return current >= start || current < end;
}

export function rollingDays(startKey: string, count = 7) {
  return Array.from({ length: count }, (_, i) => shiftDateKey(startKey, i));
}
