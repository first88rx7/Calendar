import { mealieBaseUrl, mealieConfigured, readConfig } from "@/lib/config";
import { getDb } from "@/lib/db";
import { mockRecipeDetail, mockRecipes } from "@/lib/mock";
import { setSyncState } from "@/lib/sync-state";
import type { MealEntry, RecipeDetail, RecipeSummary } from "@/lib/types";

type MealieMealPlan = {
  items?: Array<{
    date: string;
    entryType?: string;
    title?: string;
    recipe?: {
      id?: string;
      name?: string;
      slug?: string;
      image?: string;
    };
  }>;
};

type MealieRecipeList = {
  items?: Array<Record<string, unknown>>;
};

function headers() {
  return {
    Authorization: `Bearer ${process.env.MEALIE_TOKEN}`,
    Accept: "application/json",
  };
}

export async function mealieFetch(path: string, init?: RequestInit) {
  const base = mealieBaseUrl();
  if (!base || !process.env.MEALIE_TOKEN) {
    throw new Error("Mealie is not configured");
  }
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mealie ${response.status}: ${body.slice(0, 180)}`);
  }
  return response;
}

export function mealieMediaUrl(recipeId?: string, image?: string) {
  const base = mealieBaseUrl();
  if (!base || !recipeId) return undefined;
  if (image?.startsWith("http")) return image;
  return `${base}/api/media/recipes/${recipeId}/images/min-original.webp`;
}

export async function syncMeals(from: string, to: string) {
  if (!mealieConfigured()) {
    setSyncState("mealie", "mock");
    return;
  }
  try {
    const params = new URLSearchParams({
      start_date: from,
      end_date: to,
      perPage: "100",
      orderBy: "date",
      orderDirection: "asc",
    });
    const response = await mealieFetch(`/api/households/mealplans?${params}`);
    const data = (await response.json()) as MealieMealPlan;
    const items = data.items ?? [];
    const db = getDb();
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM meals WHERE date >= ? AND date <= ?").run(from, to);
      const insert = db.prepare(
        `INSERT INTO meals (date, entry_type, title, recipe_slug, recipe_id, image_url)
         VALUES (@date, @entryType, @title, @recipeSlug, @recipeId, @imageUrl)`,
      );
      for (const item of items) {
        const title = item.recipe?.name || item.title || "Planned meal";
        insert.run({
          date: item.date,
          entryType: item.entryType || "dinner",
          title,
          recipeSlug: item.recipe?.slug || null,
          recipeId: item.recipe?.id || null,
          imageUrl: mealieMediaUrl(item.recipe?.id, item.recipe?.image) || null,
        });
      }
    });
    tx();
    setSyncState("mealie", "live");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mealie sync failed";
    setSyncState("mealie", "mock", message);
    throw error;
  }
}

export async function searchRecipes(query: string): Promise<RecipeSummary[]> {
  if (!mealieConfigured()) {
    return mockRecipes(query);
  }
  const params = new URLSearchParams({
    search: query,
    perPage: "24",
    orderBy: "name",
    orderDirection: "asc",
  });
  const response = await mealieFetch(`/api/recipes?${params}`);
  const data = (await response.json()) as MealieRecipeList;
  return (data.items ?? []).map(mapSummary);
}

export async function getRecipe(slug: string): Promise<RecipeDetail | null> {
  if (!mealieConfigured()) {
    return mockRecipeDetail(slug);
  }
  try {
    const response = await mealieFetch(`/api/recipes/${encodeURIComponent(slug)}`);
    const data = (await response.json()) as Record<string, unknown>;
    return mapDetail(data);
  } catch {
    return null;
  }
}

function mapSummary(item: Record<string, unknown>): RecipeSummary {
  const id = String(item.id || item.slug || "");
  const image = typeof item.image === "string" ? item.image : undefined;
  return {
    id,
    slug: String(item.slug || id),
    name: String(item.name || "Recipe"),
    description: typeof item.description === "string" ? item.description : undefined,
    totalTime:
      (typeof item.totalTime === "string" && item.totalTime) ||
      (typeof item.performTime === "string" && item.performTime) ||
      undefined,
    imageUrl: mealieMediaUrl(id, image),
  };
}

function mapDetail(item: Record<string, unknown>): RecipeDetail {
  const summary = mapSummary(item);
  const ingredientsRaw = Array.isArray(item.recipeIngredient) ? item.recipeIngredient : [];
  const stepsRaw = Array.isArray(item.recipeInstructions) ? item.recipeInstructions : [];
  const config = readConfig();
  const base = mealieBaseUrl() || config.mealie.publicUrl;
  const ingredients = ingredientsRaw.map((entry) => {
    if (typeof entry === "string") return entry;
    const rec = entry as Record<string, unknown>;
    return String(rec.display || rec.note || rec.title || "");
  }).filter(Boolean);
  const instructions = stepsRaw.map((entry) => {
    if (typeof entry === "string") return entry;
    const rec = entry as Record<string, unknown>;
    return String(rec.text || rec.summary || rec.title || "");
  }).filter(Boolean);
  return {
    ...summary,
    ingredients,
    instructions,
    servings:
      item.recipeYield != null && String(item.recipeYield)
        ? String(item.recipeYield)
        : item.recipeServings != null
          ? String(item.recipeServings)
          : undefined,
    mealieUrl: base
      ? `${base}/g/${config.mealie.groupSlug}/r/${summary.slug}`
      : undefined,
  };
}

export function listMeals(from: string, to: string): MealEntry[] {
  return getDb()
    .prepare(
      `SELECT date, entry_type as entryType, title, recipe_slug as recipeSlug,
              recipe_id as recipeId, image_url as imageUrl
       FROM meals WHERE date >= ? AND date <= ? ORDER BY date, entry_type`,
    )
    .all(from, to) as MealEntry[];
}
