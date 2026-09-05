import { NextRequest, NextResponse } from "next/server";
import { searchRecipes } from "@/lib/mealie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  try {
    const recipes = await searchRecipes(query);
    return NextResponse.json({ recipes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recipe search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

