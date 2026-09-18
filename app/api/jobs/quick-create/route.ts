import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

// A real client relationship isn't known yet at the moment someone is naming a role
// mid-import — every ad-hoc job made here shares this one placeholder client rather
// than being misattributed to whichever real client happened to be first in a list.
// Whoever manages Clients can rename it or move these jobs onto the real client
// later; nothing about it is special beyond being the fallback.
const FALLBACK_CLIENT_COMPANY = "General (unassigned client)";

// POST /api/jobs/quick-create — body: { title }. The CSV Import wizard's "+ Add a
// new job": unlike POST /api/jobs, this deliberately asks for nothing but a title.
// jobs.client_id is NOT NULL, so it still needs *a* client — it just shouldn't be
// the operator's problem to pick one while they're mid-import.
export async function POST(request: Request) {
  const guard = await requirePermission("manage_jobs");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: { code: "bad_request", message: "Title is required." } }, { status: 400 });
  }

  const supabase = await createClient();

  let { data: fallbackClient } = await supabase
    .from("clients")
    .select("id")
    .eq("company", FALLBACK_CLIENT_COMPANY)
    .maybeSingle();
  if (!fallbackClient) {
    const { data: created, error: clientErr } = await supabase
      .from("clients")
      .insert({ company: FALLBACK_CLIENT_COMPANY })
      .select("id")
      .single();
    if (clientErr || !created) {
      console.error("POST /api/jobs/quick-create fallback client insert failed", clientErr);
      return NextResponse.json({ error: { code: "server_error", message: "Could not create the job." } }, { status: 500 });
    }
    fallbackClient = created;
  }

  const { data: template } = await supabase.from("pipeline_templates").select("id").eq("is_default", true).maybeSingle();
  if (!template) {
    return NextResponse.json(
      { error: { code: "no_default_pipeline", message: "No default pipeline template exists to assign." } },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      title,
      client_id: fallbackClient.id,
      openings: 1,
      status: "open",
      pipeline_template_id: template.id,
      created_by: guard.id,
    })
    .select("id, title")
    .single();

  if (error || !data) {
    console.error("POST /api/jobs/quick-create job insert failed", error);
    return NextResponse.json({ error: { code: "server_error", message: "Could not create the job." } }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
