import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { checkIdleTimers } from "@/lib/team";

// POST /api/idle-timers/check — admin-only. Scans all idle users, creates
// notification entries in activity_logs at 10/12/15-minute thresholds.
export async function POST() {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();
  try {
    const result = await checkIdleTimers(supabase);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: { code: "server_error", message: "Failed to check idle timers." } }, { status: 500 });
  }
}
