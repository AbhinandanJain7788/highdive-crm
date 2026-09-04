import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getDashboardData } from "@/lib/dashboard";
import { isDashboardRangeKey, type DashboardRangeKey } from "@/lib/dateRanges";

// GET /api/dashboard?range=today|yesterday|last7|last30 — left ungated like the rest of
// the Dashboard nav item (claude.md Phase 2 As-Built Notes: "Dashboard ... left
// ungated (visible to any signed-in user)"); scope narrows per-user inside
// getDashboardData, not via a permission gate.
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range");
  const range: DashboardRangeKey = isDashboardRangeKey(rangeParam) ? rangeParam : "today";

  const supabase = await createClient();
  try {
    const data = await getDashboardData(supabase, profile, range);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/dashboard failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load dashboard." } }, { status: 500 });
  }
}
