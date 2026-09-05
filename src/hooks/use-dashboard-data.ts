"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { todayKey, weekKeys } from "@/lib/time";
import type { DashboardPayload } from "@/lib/types";

export function useDashboardData() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const timezone = data?.config.weather.timezone || "America/Los_Angeles";
  const today = todayKey(timezone);
  const start = weekStart || today;
  const days = useMemo(
    () => weekKeys(start, data?.config.weekStartsOn ?? 0, timezone),
    [start, data?.config.weekStartsOn, timezone],
  );

  const load = useCallback(
    async (week?: string, sync = false) => {
      setError(null);
      const key = week || weekStart || undefined;
      try {
        if (sync) {
          setRefreshing(true);
          const response = await fetch(`/api/sync?week=${key || ""}`, {
            method: "POST",
            cache: "no-store",
          });
          if (!response.ok) throw new Error("Sync failed");
          setData(await response.json());
          return;
        }
        const response = await fetch(`/api/dashboard?week=${key || ""}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load the household board");
        setData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the household board");
      } finally {
        setRefreshing(false);
      }
    },
    [weekStart],
  );

  useEffect(() => {
    void load(start, false);
    const id = window.setInterval(() => void load(start, false), 30_000);
    return () => window.clearInterval(id);
  }, [load, start]);

  return { data, error, load, refreshing, weekStart, setWeekStart, days, today, timezone, start };
}
