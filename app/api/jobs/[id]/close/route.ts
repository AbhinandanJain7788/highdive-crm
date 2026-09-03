import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/jobs/:id/close — sets status='closed'. A dedicated route rather than a
// PATCH because closing is an action the UI exposes as a button, and keeping it
// separate leaves room for the side effects a close may later need (notifying
// assigned recruiters, settling open applications) without overloading PATCH.
// Applications are deliberately left untouched — claude.md forbids hard-deleting
// them, and a closed job's pipeline stays readable as history.
export async function POST(_request: Request, { params }: RouteParams) {
  const guard = await requirePermission("manage_jobs");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("jobs")
    .update({ status: "closed" })
    .eq("id", id)
    .select("id, title, status")
    .maybeSingle();

  if (error) {
    console.error(`POST /api/jobs/${id}/close failed`, error);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to close job." } }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: { code: "not_found", message: "Job not found." } }, { status: 404 });
  }

  return NextResponse.json({ data });
}
