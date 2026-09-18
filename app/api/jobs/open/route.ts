import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

// GET /api/jobs/open — id/title only, for the CSV Import wizard's "Add to Job"
// picker. Deliberately separate from GET /api/jobs (gated on manage_jobs, and
// carries client names, counts, etc. a bulk-import operator has no reason to see):
// this is gated on bulk_import instead, the same permission the upload step
// already requires, and returns just enough to populate a dropdown.
export async function GET() {
  const guard = await requirePermission("bulk_import");
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title")
    .eq("status", "open")
    .order("title", { ascending: true });

  if (error) {
    console.error("GET /api/jobs/open failed", error);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load jobs." } }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
