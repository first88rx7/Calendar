import { NextRequest, NextResponse } from "next/server";
import { fetchPhotoBytes } from "@/lib/photoprism";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get("hash") || "";
  const size = request.nextUrl.searchParams.get("size") || "fit_1920";
  try {
    const { buffer, contentType } = await fetchPhotoBytes(hash, size);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo fetch failed";
    const status = message.includes("Bad photo") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
