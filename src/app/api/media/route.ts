import { NextRequest, NextResponse } from "next/server";
import { mealieBaseUrl } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  const base = mealieBaseUrl();
  if (!target || !base) {
    return NextResponse.json({ error: "Missing image url" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Bad url" }, { status: 400 });
  }
  const allowed = new URL(base);
  if (parsed.origin !== allowed.origin) {
    return NextResponse.json({ error: "Blocked" }, { status: 403 });
  }
  const response = await fetch(parsed.toString(), {
    headers: process.env.MEALIE_TOKEN
      ? { Authorization: `Bearer ${process.env.MEALIE_TOKEN}` }
      : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
  }
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = await response.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
