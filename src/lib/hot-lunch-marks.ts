import type { HotLunchMark, Person } from "@/lib/types";

export const DEFAULT_HOT_LUNCH_INITIALS = ["I", "D"];

const FALLBACK_COLORS = ["#3B9B5C", "#3B6FDB", "#C26A3A", "#6B5B95"];

export function normalizeHotLunchInitials(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[,\s/]+/)
        .filter(Boolean);
  const out: string[] = [];
  for (const raw of list) {
    const initial = String(raw)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 2);
    if (initial && !out.includes(initial)) out.push(initial);
  }
  return out.length ? out.slice(0, 6) : [...DEFAULT_HOT_LUNCH_INITIALS];
}

export function hotLunchWanted(marks: HotLunchMark[], date: string, initial: string) {
  return marks.some((mark) => mark.date === date && mark.initial === initial);
}

export function withHotLunchMark(
  marks: HotLunchMark[],
  date: string,
  initial: string,
  wanted: boolean,
): HotLunchMark[] {
  const next = marks.filter((mark) => !(mark.date === date && mark.initial === initial));
  if (wanted) next.push({ date, initial });
  return next;
}

export async function saveHotLunchMark(date: string, initial: string, wanted: boolean) {
  const response = await fetch("/api/hot-lunch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, initial, wanted }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Could not save hot lunch");
  }
}

export function hotLunchColor(initial: string, people: Person[], index = 0) {
  const needle = initial.toUpperCase();
  const person = people.find((item) => {
    const name = item.name.trim();
    const first = name.split(/\s+/)[0] || "";
    return first.toUpperCase().startsWith(needle) || name.toUpperCase() === needle;
  });
  return person?.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}
