import { getDb } from "@/lib/db";
import type { SyncSource, SyncStatus } from "@/lib/types";

export function setSyncState(source: SyncSource, mode: "live" | "mock", error?: string) {
  getDb()
    .prepare(
      `INSERT INTO sync_state (source, last_success_at, last_error, mode)
       VALUES (@source, @lastSuccessAt, @lastError, @mode)
       ON CONFLICT(source) DO UPDATE SET
         last_success_at = CASE WHEN @lastError IS NULL THEN @lastSuccessAt ELSE sync_state.last_success_at END,
         last_error = @lastError,
         mode = @mode`,
    )
    .run({
      source,
      lastSuccessAt: error ? null : new Date().toISOString(),
      lastError: error ?? null,
      mode: error ? mode : mode,
    });
}

export function listSyncStatus(): SyncStatus[] {
  const rows = getDb()
    .prepare("SELECT source, last_success_at as lastSuccessAt, last_error as lastError, mode FROM sync_state")
    .all() as SyncStatus[];
  const bySource = new Map(rows.map((row) => [row.source, row]));
  return (["google", "mealie", "weather"] as const).map((source) => {
    const row = bySource.get(source);
    return {
      source,
      lastSuccessAt: row?.lastSuccessAt ?? null,
      lastError: row?.lastError ?? null,
      mode: row?.mode ?? "mock",
    };
  });
}
