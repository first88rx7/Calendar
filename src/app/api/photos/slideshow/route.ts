import { NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { listSlideshowPhotos } from "@/lib/photoprism";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = readConfig();
  const result = await listSlideshowPhotos();
  return NextResponse.json({
    configured: result.configured,
    rotateSec: config.photoRotateSec,
    photos: result.photos,
    error: result.error,
  });
}
