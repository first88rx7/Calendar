import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google";
import { runSync } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = request.nextUrl.origin;
  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=google-denied", request.url));
  }
  try {
    await exchangeCode(code, origin);
    await runSync();
    return NextResponse.redirect(new URL("/settings?connected=1", request.url));
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/settings?error=google-exchange", request.url));
  }
}
