import { getDb } from "@/lib/db";
import { normalizeHotLunchInitials } from "@/lib/hot-lunch-marks";
import { readConfig } from "@/lib/config";
import type { HotLunchMark, HotLunchState } from "@/lib/types";

export function listHotLunch(from: string, to: string): HotLunchMark[] {
  return getDb()
    .prepare(
      `SELECT date, initial FROM hot_lunch
       WHERE date >= ? AND date <= ?
       ORDER BY date, initial`,
    )
    .all(from, to) as HotLunchMark[];
}

export function setHotLunch(date: string, initial: string, wanted: boolean) {
  const key = normalizeHotLunchInitials([initial])[0];
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("That hot lunch mark is invalid.");
  }
  const db = getDb();
  if (wanted) {
    db.prepare(
      `INSERT INTO hot_lunch (date, initial) VALUES (?, ?)
       ON CONFLICT(date, initial) DO NOTHING`,
    ).run(date, key);
  } else {
    db.prepare("DELETE FROM hot_lunch WHERE date = ? AND initial = ?").run(date, key);
  }
}

export function hotLunchState(from: string, to: string): HotLunchState {
  return {
    initials: normalizeHotLunchInitials(readConfig().hotLunch?.initials),
    marks: listHotLunch(from, to),
  };
}
