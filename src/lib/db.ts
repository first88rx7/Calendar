import Database from "better-sqlite3";
import { getDbPath } from "@/lib/paths";

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT NOT NULL,
      calendar_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      location TEXT DEFAULT '',
      start_iso TEXT NOT NULL,
      end_iso TEXT NOT NULL,
      all_day INTEGER NOT NULL DEFAULT 0,
      html_link TEXT,
      updated_at TEXT,
      PRIMARY KEY (calendar_id, id)
    );

    CREATE INDEX IF NOT EXISTS events_start_idx ON events (start_iso, end_iso);

    CREATE TABLE IF NOT EXISTS meals (
      date TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      title TEXT NOT NULL,
      recipe_slug TEXT,
      recipe_id TEXT,
      image_url TEXT,
      PRIMARY KEY (date, entry_type, title)
    );

    CREATE TABLE IF NOT EXISTS weather_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      source TEXT PRIMARY KEY,
      last_success_at TEXT,
      last_error TEXT,
      mode TEXT NOT NULL DEFAULT 'mock'
    );

    CREATE TABLE IF NOT EXISTS oauth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT,
      refresh_token TEXT,
      expiry TEXT,
      email TEXT
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export type EventRow = {
  id: string;
  calendar_id: string;
  title: string;
  description: string;
  location: string;
  start_iso: string;
  end_iso: string;
  all_day: number;
  html_link: string | null;
  updated_at: string | null;
};

export function rowToEvent(row: EventRow) {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    title: row.title,
    description: row.description || "",
    location: row.location || "",
    startIso: row.start_iso,
    endIso: row.end_iso,
    allDay: Boolean(row.all_day),
    htmlLink: row.html_link || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

export function getMeta(key: string) {
  const row = getDb()
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string) {
  getDb()
    .prepare(
      "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}
