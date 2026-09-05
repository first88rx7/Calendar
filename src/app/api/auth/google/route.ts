import { NextRequest, NextResponse } from "next/server";
import { googleAuthUrl, isGoogleConfigured } from "@/lib/google";
import { settingsUnlocked } from "@/lib/settings-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await settingsUnlocked()) && process.env.SETTINGS_PIN) {
    return NextResponse.redirect(new URL("/settings", request.url));
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/settings?error=google-config", request.url));
  }
  const origin = request.nextUrl.origin;
  return NextResponse.redirect(googleAuthUrl(origin));
}
