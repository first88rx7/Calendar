import { NextRequest, NextResponse } from "next/server";
import { defaultWeekRange, loadDashboard } from "@/lib/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const week = request.nextUrl.searchParams.get("week") || undefined;
  const { from, to } = defaultWeekRange(week);
  return NextResponse.json(await loadDashboard(from, to));
}
