import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getRecruiterRows } from "@/lib/recruiters";

// GET /api/recruiters — the recruiter directory with assignment and conversion
// metrics.
//
// Not in claude.md's API table (which covers the team endpoints but never the
// /recruiters screens Phase 3 Step 4 asks for) — added here and recorded in the
// Phase 3 as-built notes.
//
// Gated on `view_all_records` rather than left open: RLS restricts `assignments`
// reads to the assignment's own recruiter, so for anyone else this endpoint would
// return a directory of colleagues whose counts all silently read 0. A 403 is
// honest; misleading zeros are not.
export async function GET() {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();
  try {
    const rows = await getRecruiterRows(supabase);
    return NextResponse.json({ data: rows, total: rows.length });
  } catch (err) {
    console.error("GET /api/recruiters failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load recruiters." } }, { status: 500 });
  }
}
