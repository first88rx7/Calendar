import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google";
import { browserOrigin } from "@/lib/http";
import { runSync } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = browserOrigin(request);
  if (!code) {
    return NextResponse.redirect(`${origin}/settings?error=google-denied`);
  }
  try {
    await exchangeCode(code, origin);
    await runSync();
    return NextResponse.redirect(`${origin}/settings?connected=1`);
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(`${origin}/settings?error=google-exchange`);
  }
}
