import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getActivityLogs } from "@/lib/settings";

// GET /api/settings/activity-logs — "admin" per claude.md; gated on `view_all_records`.
// RLS's own `activity_logs_select` policy (view_all_records only) is a second,
// independent enforcement of the same rule.
export async function GET(request: Request) {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = [10, 25, 50].includes(Number(searchParams.get("pageSize")))
    ? Number(searchParams.get("pageSize"))
    : 25;

  const supabase = await createClient();
  try {
    const { rows, total } = await getActivityLogs(supabase, { page, pageSize });
    return NextResponse.json({ data: rows, total });
  } catch (err) {
    console.error("GET /api/settings/activity-logs failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load activity logs." } }, { status: 500 });
  }
}
