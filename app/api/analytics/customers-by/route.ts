import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getCustomersByGroup } from "@/lib/analytics";
import { isAnalyticsRangeKey } from "@/lib/dateRanges";
import type { AnalyticsRangeKey } from "@/lib/dateRanges";
import type { CustomersByField } from "@/lib/analytics.shared";

const CUSTOMERS_BY_FIELDS: CustomersByField[] = ["source", "status", "recruiter", "job"];

// GET /api/analytics/customers-by?range=...&field=source|status|recruiter|job — backs
// "Customers By (Select Field)" (Phase 9 fix; was a permanent static empty state).
export async function GET(request: Request) {
  const guard = await requirePermission("view_analytics");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");
  const range: AnalyticsRangeKey = isAnalyticsRangeKey(rangeParam) ? rangeParam : "today";
  const fieldParam = searchParams.get("field");
  if (!CUSTOMERS_BY_FIELDS.includes(fieldParam as CustomersByField)) {
    return NextResponse.json(
      { error: { code: "bad_request", message: `field must be one of: ${CUSTOMERS_BY_FIELDS.join(", ")}.` } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  try {
    const data = await getCustomersByGroup(supabase, guard, range, fieldParam as CustomersByField);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/analytics/customers-by failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load grouped customers." } }, { status: 500 });
  }
}
