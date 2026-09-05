import { NextRequest, NextResponse } from "next/server";
import { defaultWeekRange } from "@/lib/dashboard";
import { runSync } from "@/lib/sync";
import { loadDashboard } from "@/lib/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const week = request.nextUrl.searchParams.get("week") || undefined;
  const { from, to } = defaultWeekRange(week);
  await runSync(from, to);
  return NextResponse.json(await loadDashboard(from, to));
}
