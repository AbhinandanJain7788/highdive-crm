import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { getLoginAnalytics } from "@/lib/analytics";
import { isAnalyticsRangeKey } from "@/lib/dateRanges";
import type { AnalyticsRangeKey } from "@/lib/dateRanges";

// GET /api/analytics/login?range=today|last7|last30 — always the caller's own login
// duration (see lib/analytics.ts's getLoginAnalytics for why).
export async function GET(request: Request) {
  const guard = await requirePermission("view_analytics");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");
  const range: AnalyticsRangeKey = isAnalyticsRangeKey(rangeParam) ? rangeParam : "today";

  try {
    const data = await getLoginAnalytics(guard, range);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/analytics/login failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load login analytics." } }, { status: 500 });
  }
}
