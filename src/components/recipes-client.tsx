"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { mediaSrc } from "@/lib/media";
import type { PublicConfig, RecipeDetail, RecipeSummary } from "@/lib/types";

export function RecipesClient() {
  const params = useSearchParams();
  const openSlug = params.get("open");
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [detail, setDetail] = useState<RecipeDetail | null>(null);

  async function search(next = query) {
    setError(null);
    try {
      const response = await fetch(`/api/recipes?q=${encodeURIComponent(next)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      setRecipes(data.recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }

  async function openRecipe(slug: string) {
    try {
      const response = await fetch(`/api/recipes/${encodeURIComponent(slug)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Recipe missing");
      setDetail(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recipe missing");
    }
  }

  useEffect(() => {
    void search("");
    void fetch("/api/config")
      .then((res) => res.json())
      .then(setConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (openSlug) void openRecipe(openSlug);
  }, [openSlug]);

  const empty = recipes && recipes.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Mealie</p>
          <h1 className="text-3xl font-semibold">Recipes</h1>
        </div>
        <Link href="/mealie" className={buttonVariants({ className: "h-12 px-4 text-base" })}>
          Open Mealie
          <ExternalLink className="size-4" />
        </Link>
      </header>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search(query);
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the recipe box"
            className="h-14 pl-11 text-lg"
          />
        </div>
        <Button className="h-14 px-6 text-base" type="submit">
          Search
        </Button>
      </form>
      {error && <p className="text-destructive">{error}</p>}
      {!recipes && <p className="text-muted-foreground">Loading recipes…</p>}
      {empty && (
        <p className="rounded-2xl bg-card px-4 py-8 text-center text-muted-foreground ring-1 ring-foreground/10">
          No recipes match that search.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {recipes?.map((recipe) => {
          const src = mediaSrc(recipe.imageUrl);
          return (
            <button
              key={recipe.id}
              type="button"
              onClick={() => void openRecipe(recipe.slug)}
              className="flex gap-3 rounded-2xl bg-card p-3 text-left ring-1 ring-foreground/10"
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="size-20 rounded-xl object-cover" />
              ) : (
                <div className="size-20 rounded-xl bg-secondary" />
              )}
              <span className="min-w-0">
                <span className="block text-lg font-medium leading-snug">{recipe.name}</span>
                {recipe.totalTime && (
                  <span className="text-sm text-muted-foreground">{recipe.totalTime}</span>
                )}
                {recipe.description && (
                  <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                    {recipe.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-xl data-[side=right]:sm:max-w-xl">
          {detail && <RecipeBody recipe={detail} mealieOpen={Boolean(config?.mealieOpenUrl)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RecipeBody({ recipe, mealieOpen }: { recipe: RecipeDetail; mealieOpen: boolean }) {
  const src = mediaSrc(recipe.imageUrl);
  const mealieHref = useMemo(() => recipe.mealieUrl || "/mealie", [recipe.mealieUrl]);
  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-2xl">{recipe.name}</SheetTitle>
        <SheetDescription>
          {recipe.totalTime ? `${recipe.totalTime}` : "From your Mealie library"}
          {recipe.servings ? ` · Serves ${recipe.servings}` : ""}
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="mb-4 h-40 w-full rounded-2xl object-cover" />
        )}
        {recipe.description && <p className="mb-4 text-muted-foreground">{recipe.description}</p>}
        <h3 className="text-lg font-medium">Ingredients</h3>
        {recipe.ingredients.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No ingredients listed.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {recipe.ingredients.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <h3 className="mt-6 text-lg font-medium">Steps</h3>
        {recipe.instructions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No steps listed.</p>
        ) : (
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            {recipe.instructions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        )}
      </div>
      {mealieOpen && (
        <SheetFooter>
          <Link href={mealieHref.startsWith("http") ? "/mealie" : mealieHref} className={buttonVariants({ className: "h-12 text-base" })}>
            Open in Mealie
          </Link>
        </SheetFooter>
      )}
    </>
  );
}
