import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

// GET /api/clients/open — id/company only, for the "+ Add a new job" mini-form the
// CSV Import wizard offers to anyone who can already create jobs. Gated on
// manage_jobs rather than manage_clients: creating a job (POST /api/jobs) already
// requires manage_jobs and a clientId, so this just lets that same person see
// client names to pick from — it doesn't grant any new access to client data
// beyond company names.
export async function GET() {
  const guard = await requirePermission("manage_jobs");
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, company").order("company", { ascending: true });

  if (error) {
    console.error("GET /api/clients/open failed", error);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load clients." } }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
