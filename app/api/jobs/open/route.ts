import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";

// GET /api/jobs/open — id/title only, for the CSV Import wizard's "Add to Job"
// picker and the Add Customer form's job picker. Deliberately separate from
// GET /api/jobs (gated on manage_jobs, and carries client names, counts, etc.
// neither caller has a reason to see): gated on holding either bulk_import or
// manage_candidates — whichever the caller already needed to reach this form —
// and returns just enough to populate a dropdown.
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }
  if (!profile.permissions.includes("bulk_import") && !profile.permissions.includes("manage_candidates")) {
    return NextResponse.json({ error: { code: "forbidden", message: "Missing permission." } }, { status: 403 });
  }

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
