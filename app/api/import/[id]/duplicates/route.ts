import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getImportDuplicates } from "@/lib/import";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/import/:id/duplicates — rows needing dedup review.
export async function GET(_request: Request, { params }: RouteParams) {
  const guard = await requirePermission("bulk_import");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = await createClient();
  try {
    const data = await getImportDuplicates(supabase, id);
    return NextResponse.json({ data });
  } catch (err) {
    console.error(`GET /api/import/${id}/duplicates failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load duplicates." } }, { status: 500 });
  }
}
