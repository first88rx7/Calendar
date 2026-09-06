"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Heart, Star } from "lucide-react";
import { mediaSrc } from "@/lib/media";
import type { RecipeSummary } from "@/lib/types";

const VISIBLE = 5;
const ROTATE_MS = 45_000;

function poolKey(recipes: RecipeSummary[]) {
  return recipes
    .map((recipe) => recipe.id)
    .sort()
    .join("|");
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickVisible(pool: RecipeSummary[], previousIds: string[] = []): RecipeSummary[] {
  if (pool.length <= VISIBLE) return pool;
  const previous = new Set(previousIds);
  const shuffled = shuffle(pool);
  const fresh = shuffled.filter((recipe) => !previous.has(recipe.id));
  const reused = shuffled.filter((recipe) => previous.has(recipe.id));
  return [...fresh, ...reused].slice(0, VISIBLE);
}

export function RecipeStrip({
  recipes,
  compact = false,
}: {
  recipes: RecipeSummary[];
  compact?: boolean;
}) {
  const fingerprint = useMemo(() => poolKey(recipes), [recipes]);
  const poolRef = useRef(recipes);
  poolRef.current = recipes;

  const [visible, setVisible] = useState<RecipeSummary[]>(() => pickVisible(recipes));

  useEffect(() => {
    setVisible(pickVisible(poolRef.current));
  }, [fingerprint]);

  useEffect(() => {
    if (recipes.length <= VISIBLE) return;
    const id = window.setInterval(() => {
      setVisible((current) => pickVisible(poolRef.current, current.map((recipe) => recipe.id)));
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [fingerprint, recipes.length]);

  return (
    <div className={compact ? "p-3" : "p-5"}>
      <div className={compact ? "mb-2 flex items-center justify-between" : "mb-3 flex items-center justify-between"}>
        <h2 className={compact ? "text-base font-semibold" : "text-lg font-semibold"}>Recipe Ideas</h2>
        <Link href="/recipes" className="text-sm text-white/70 hover:text-white">
          View All Recipes →
        </Link>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-white/60">No recipes to show yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {visible.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, compact = false }: { recipe: RecipeSummary; compact?: boolean }) {
  const src = mediaSrc(recipe.imageUrl) || recipe.imageUrl;
  return (
    <Link
      href={`/recipes?open=${recipe.slug}`}
      className="group overflow-hidden rounded-2xl bg-black/25 ring-1 ring-white/10"
    >
      <div className={compact ? "relative aspect-[16/9]" : "relative aspect-[4/3]"}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-white/10" />
        )}
        {!compact && (
          <span className="absolute top-2 right-2 rounded-full bg-black/45 p-1.5 text-white">
            <Heart className="size-3.5" />
          </span>
        )}
      </div>
      <div className={compact ? "space-y-0.5 p-2" : "space-y-1 p-3"}>
        <p className={compact ? "truncate text-sm font-semibold" : "line-clamp-2 text-sm font-semibold leading-snug"}>
          {recipe.name}
        </p>
        {!compact && (
          <p className="flex items-center gap-3 text-xs text-white/65">
            {recipe.totalTime && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {recipe.totalTime}
              </span>
            )}
            {recipe.rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3 fill-amber-300 text-amber-300" />
                {recipe.rating.toFixed(1)}
              </span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}
