import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getUnattributedCalls } from "@/lib/calls";
import { readPagination } from "@/lib/format";

// GET /api/calls/unattributed — calls with null application_id (claude.md API
// structure). Gated on `attribute_calls` rather than the table's literal "manager+"
// note: RLS already scopes calls to a recruiter's own/held rows regardless, the
// Call Logs "Unattributed" tab is sidebar-gated on attribute_calls (Phase 2's own
// nav mapping), and POST .../attribute — the action this queue exists to drive —
// is itself "any (recruiter: own)". Blocking the queue's own read behind a
// manager-only permission would make that action unreachable for the recruiters
// claude.md says should be able to take it.
export async function GET(request: Request) {
  const guard = await requirePermission("attribute_calls");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const supabase = await createClient();
  try {
    const { rows, total } = await getUnattributedCalls(supabase, {
      search: searchParams.get("search") ?? undefined,
      pagination: readPagination(searchParams),
    });
    return NextResponse.json({ data: rows, total });
  } catch (err) {
    console.error("GET /api/calls/unattributed failed", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to load unattributed calls." } },
      { status: 500 }
    );
  }
}
