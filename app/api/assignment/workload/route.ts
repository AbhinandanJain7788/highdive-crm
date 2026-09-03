import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getWorkload } from "@/lib/assignment";

// GET /api/assignment/workload — Recruiter Workload bars, active recruiters only,
// counts from live active `assignments` rows.
export async function GET() {
  const guard = await requirePermission("manage_assignment");
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();
  try {
    const data = await getWorkload(supabase);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/assignment/workload failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load workload." } }, { status: 500 });
  }
}
