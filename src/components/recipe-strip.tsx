import Link from "next/link";
import { Clock, Heart, Star } from "lucide-react";
import { mediaSrc } from "@/lib/media";
import type { RecipeSummary } from "@/lib/types";

export function RecipeStrip({ recipes }: { recipes: RecipeSummary[] }) {
  return (
    <div className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recipe Ideas</h2>
        <Link href="/recipes" className="text-sm text-white/70 hover:text-white">
          View All Recipes →
        </Link>
      </div>
      {recipes.length === 0 ? (
        <p className="text-sm text-white/60">No recipes to show yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {recipes.slice(0, 5).map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const src = mediaSrc(recipe.imageUrl) || recipe.imageUrl;
  return (
    <Link
      href={`/recipes?open=${recipe.slug}`}
      className="group overflow-hidden rounded-2xl bg-black/25 ring-1 ring-white/10"
    >
      <div className="relative aspect-[4/3]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-white/10" />
        )}
        <span className="absolute top-2 right-2 rounded-full bg-black/45 p-1.5 text-white">
          <Heart className="size-3.5" />
        </span>
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{recipe.name}</p>
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
      </div>
    </Link>
  );
}
