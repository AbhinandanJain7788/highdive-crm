import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getTopUserPerformances } from "@/lib/analytics";
import { isAnalyticsRangeKey } from "@/lib/dateRanges";
import type { AnalyticsRangeKey } from "@/lib/dateRanges";

// GET /api/analytics/top-users?range=today|last7|last30[&all=true]
// `all=true` backs the User Performance tab's full list (Phase 9 fix — that tab was a
// "coming soon" placeholder; it reuses this same call/agent aggregation rather than a
// second one, uncapped instead of the Top-5 widget's default).
export async function GET(request: Request) {
  const guard = await requirePermission("view_analytics");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");
  const range: AnalyticsRangeKey = isAnalyticsRangeKey(rangeParam) ? rangeParam : "today";
  const limit = searchParams.get("all") === "true" ? Number.MAX_SAFE_INTEGER : 5;

  const supabase = await createClient();
  try {
    const data = await getTopUserPerformances(supabase, guard, range, limit);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/analytics/top-users failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load top users." } }, { status: 500 });
  }
}
