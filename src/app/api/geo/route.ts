import { NextRequest, NextResponse } from "next/server";
import { lookupUsZip } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get("zip") || "";
  try {
    return NextResponse.json(await lookupUsZip(zip));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
