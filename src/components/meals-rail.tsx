import Link from "next/link";
import { entryTypeLabel, mediaSrc } from "@/lib/media";
import { weekdayShort } from "@/lib/time";
import type { MealEntry } from "@/lib/types";

export function MealsRail({
  meals,
  days,
  today,
  timeZone,
}: {
  meals: MealEntry[];
  days: string[];
  today: string;
  timeZone: string;
}) {
  const tonight = meals.filter((meal) => meal.date === today);
  const rest = meals.filter((meal) => meal.date > today);

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-3 xl:flex">
      <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Tonight</h2>
          <Link href="/meals" className="text-sm text-primary">
            Full week
          </Link>
        </div>
        {tonight.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No meal planned in Mealie for today.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {tonight.map((meal) => (
              <MealCard key={`${meal.date}-${meal.entryType}-${meal.title}`} meal={meal} />
            ))}
          </ul>
        )}
      </section>
      <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="text-lg font-medium">Coming up</h2>
        {rest.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">The rest of the week is open.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {rest.map((meal) => (
              <li key={`${meal.date}-${meal.entryType}-${meal.title}`}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {meal.date === days[1] ? "Tomorrow" : weekdayShort(meal.date, timeZone)} · {entryTypeLabel(meal.entryType)}
                </p>
                {meal.recipeSlug ? (
                  <Link href={`/recipes?open=${meal.recipeSlug}`} className="font-medium hover:underline">
                    {meal.title}
                  </Link>
                ) : (
                  <p className="font-medium">{meal.title}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function MealCard({ meal }: { meal: MealEntry }) {
  const src = mediaSrc(meal.imageUrl);
  return (
    <li className="flex gap-3">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-14 rounded-xl object-cover" />
      ) : (
        <div className="size-14 rounded-xl bg-secondary" />
      )}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {entryTypeLabel(meal.entryType)}
        </p>
        {meal.recipeSlug ? (
          <Link href={`/recipes?open=${meal.recipeSlug}`} className="font-medium leading-snug hover:underline">
            {meal.title}
          </Link>
        ) : (
          <p className="font-medium leading-snug">{meal.title}</p>
        )}
      </div>
    </li>
  );
}
