import { NextRequest, NextResponse } from "next/server";
import { googleAuthUrl, isGoogleConfigured } from "@/lib/google";
import { browserOrigin } from "@/lib/http";
import { settingsUnlocked } from "@/lib/settings-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = browserOrigin(request);
  if (!(await settingsUnlocked()) && process.env.SETTINGS_PIN) {
    return NextResponse.redirect(`${origin}/settings`);
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${origin}/settings?error=google-config`);
  }
  return NextResponse.redirect(googleAuthUrl(origin));
}
