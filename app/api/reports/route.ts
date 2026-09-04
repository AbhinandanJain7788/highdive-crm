import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getReportsData } from "@/lib/reports";

// GET /api/reports — claude.md's API table marks this "manager+"; gated on
// `view_all_records`, the established manager-bypass marker this codebase already uses
// for /api/recruiters and /api/data/transfer (Phase 3/4 As-Built Notes), since there's
// no dedicated `reports` permission key in the 19-key catalogue and Reports has no
// per-user scoping concept of its own (it's an org-wide audit screen, unscoped by date
// or owner even for an admin).
export async function GET() {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();
  try {
    const data = await getReportsData(supabase);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/reports failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load reports." } }, { status: 500 });
  }
}
