import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { softDeleteCandidates } from "@/lib/data-management";

// POST /api/data/bulk-delete — body: { candidateIds: string[] }. Soft-delete only
// (claude.md: never hard-delete) via candidates.deleted_at (migration 0029, applied
// 2026-09-04). The migration_pending fallback below is defensive — kept in case
// this ever runs against an environment/branch where the migration hasn't landed.
export async function POST(request: Request) {
  const guard = await requirePermission("bulk_delete");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const candidateIds = Array.isArray(body?.candidateIds)
    ? body.candidateIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (candidateIds.length === 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "candidateIds is required." } }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const result = await softDeleteCandidates(supabase, candidateIds, guard.id);
    return NextResponse.json({ data: result });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    // Postgres itself would raise 42703 (undefined_column); PostgREST's schema
    // cache instead surfaces this as PGRST204 ("column not found in the schema
    // cache") since it never sees the column to begin with. Both mean the same
    // thing here: migration 0029 hasn't been applied yet.
    if (code === "42703" || code === "PGRST204") {
      console.error("POST /api/data/bulk-delete: deleted_at column missing — migration 0029 not yet applied");
      return NextResponse.json(
        {
          error: {
            code: "migration_pending",
            message: "Bulk delete needs a database migration (candidates.deleted_at) that hasn't been applied yet.",
          },
        },
        { status: 501 }
      );
    }
    console.error("POST /api/data/bulk-delete failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to delete." } }, { status: 500 });
  }
}
