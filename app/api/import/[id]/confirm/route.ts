import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { confirmImport } from "@/lib/import";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/import/:id/confirm — finalizes the import and returns the count that
// actually landed, matching Import Complete's own count on the review step.
export async function POST(_request: Request, { params }: RouteParams) {
  const guard = await requirePermission("bulk_import");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = await createClient();
  try {
    const result = await confirmImport(supabase, id, guard.id);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error(`POST /api/import/${id}/confirm failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to confirm import." } }, { status: 500 });
  }
}
