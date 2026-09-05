import { NextResponse } from "next/server";
import { getRecipe } from "@/lib/mealie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;
  const recipe = await getRecipe(slug);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }
  return NextResponse.json(recipe);
}
