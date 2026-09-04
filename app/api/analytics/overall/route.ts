import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getAnalyticsOverall } from "@/lib/analytics";
import { isAnalyticsRangeKey } from "@/lib/dateRanges";
import type { AnalyticsRangeKey } from "@/lib/dateRanges";

// GET /api/analytics/overall?range=today|last7|last30 — gated on `view_analytics`
// (Sidebar's own mapping for the Analytics nav item, Phase 2 As-Built Notes), which
// both seeded roles hold; scope narrows to the caller's own numbers inside
// getAnalyticsOverall for anyone without `view_all_records`.
export async function GET(request: Request) {
  const guard = await requirePermission("view_analytics");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");
  const range: AnalyticsRangeKey = isAnalyticsRangeKey(rangeParam) ? rangeParam : "today";

  const supabase = await createClient();
  try {
    const data = await getAnalyticsOverall(supabase, guard, range);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/analytics/overall failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load analytics." } }, { status: 500 });
  }
}
