"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { entryTypeLabel, mediaSrc } from "@/lib/media";
import { rollingDays, shiftDateKey, todayKey, weekdayShort } from "@/lib/time";
import type { DashboardPayload } from "@/lib/types";

export default function MealsPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) throw new Error("Could not load meals");
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load meals");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const timezone = data?.config.weather.timezone || "America/Los_Angeles";
  const today = todayKey(timezone);
  const days = useMemo(() => rollingDays(today, 7), [today]);

  if (error && !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-xl">Meals could not load.</p>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading meals…</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Next seven days</p>
          <h1 className="text-3xl font-semibold">What we are eating</h1>
        </div>
        <Link href="/mealie" className={buttonVariants({ className: "h-12 px-4 text-base" })}>
            Open Mealie
            <ExternalLink className="size-4" />
          </Link>
      </header>
      {!data.config.mealieConfigured && (
        <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Showing sample meals. Add a Mealie URL and API token on the home server to pull your real plan.
        </p>
      )}
      <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((day) => {
          const meals = data.meals.filter((meal) => meal.date === day);
          const isToday = day === today;
          return (
            <section
              key={day}
              className={`flex flex-col rounded-2xl bg-card p-4 ring-1 ring-foreground/10 ${isToday ? "ring-2 ring-primary" : ""}`}
            >
              <h2 className="text-lg font-medium">
                {day === today
                  ? "Today"
                  : day === shiftDateKey(today, 1)
                    ? "Tomorrow"
                    : weekdayShort(day, timezone)}
                <span className="ml-2 text-muted-foreground">{day.slice(5).replace("-", "/")}</span>
              </h2>
              {meals.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Nothing planned.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {meals.map((meal) => {
                    const src = mediaSrc(meal.imageUrl);
                    return (
                      <li key={`${meal.entryType}-${meal.title}`} className="flex gap-3">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="" className="size-16 rounded-xl object-cover" />
                        ) : (
                          <div className="size-16 rounded-xl bg-secondary" />
                        )}
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {entryTypeLabel(meal.entryType)}
                          </p>
                          {meal.recipeSlug ? (
                            <Link
                              href={`/recipes?open=${meal.recipeSlug}`}
                              className="text-base font-medium leading-snug hover:underline"
                            >
                              {meal.title}
                            </Link>
                          ) : (
                            <p className="text-base font-medium leading-snug">{meal.title}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
