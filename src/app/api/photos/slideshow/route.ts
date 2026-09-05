import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { listSlideshowPhotos } from "@/lib/photoprism";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const config = readConfig();
  const force = request.nextUrl.searchParams.get("force") === "1";
  const result = await listSlideshowPhotos(force);
  return NextResponse.json({
    configured: result.configured,
    rotateSec: config.photoRotateSec,
    photos: result.photos,
    error: result.error,
  });
}
