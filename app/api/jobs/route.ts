import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getJobRows, JOB_STATUSES } from "@/lib/jobs";
import { readPagination } from "@/lib/format";
import type { Database } from "@/types/supabase";

type JobStatus = Database["public"]["Enums"]["job_status"];

// GET /api/jobs — manager+ (claude.md > API Structure). A recruiter doesn't browse
// the job book; they see the job a candidate applied to, which arrives embedded on
// the candidate record instead.
export async function GET(request: Request) {
  const guard = await requirePermission("manage_jobs");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const statuses = searchParams
    .getAll("status")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value): value is JobStatus => JOB_STATUSES.includes(value as JobStatus));

  const supabase = await createClient();
  try {
    const { rows, total } = await getJobRows(supabase, {
      search: searchParams.get("search") ?? undefined,
      statuses,
      clientId: searchParams.get("clientId") ?? undefined,
      pagination: readPagination(searchParams),
    });
    return NextResponse.json({ data: rows, total });
  } catch (err) {
    console.error("GET /api/jobs failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load jobs." } }, { status: 500 });
  }
}

// POST /api/jobs — create a job. `pipelineTemplateId` is optional; without it the
// job takes the default template, since `jobs.pipeline_template_id` is NOT NULL and
// every job must resolve its own stage list.
export async function POST(request: Request) {
  const guard = await requirePermission("manage_jobs");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  if (!title || !clientId) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Title and clientId are required." } },
      { status: 400 }
    );
  }

  const rawOpenings = Number(body?.openings);
  const openings = Number.isFinite(rawOpenings) && rawOpenings > 0 ? Math.floor(rawOpenings) : 1;
  const status: JobStatus = JOB_STATUSES.includes(body?.status) ? body.status : "open";

  const supabase = await createClient();

  let pipelineTemplateId = typeof body?.pipelineTemplateId === "string" ? body.pipelineTemplateId : "";
  if (!pipelineTemplateId) {
    const { data: template } = await supabase
      .from("pipeline_templates")
      .select("id")
      .eq("is_default", true)
      .maybeSingle();
    if (!template) {
      return NextResponse.json(
        { error: { code: "no_default_pipeline", message: "No default pipeline template exists to assign." } },
        { status: 409 }
      );
    }
    pipelineTemplateId = template.id;
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      title,
      client_id: clientId,
      openings,
      status,
      pipeline_template_id: pipelineTemplateId,
      created_by: guard.id,
    })
    .select("id, title, status, openings, client_id, pipeline_template_id, created_at")
    .single();

  if (error) {
    // 23503 = FK violation: an unknown clientId or pipelineTemplateId is the caller's
    // mistake, not a server fault.
    const badReference = error.code === "23503";
    console.error("POST /api/jobs failed", error);
    return NextResponse.json(
      {
        error: {
          code: badReference ? "bad_request" : "server_error",
          message: badReference ? "Unknown client or pipeline template." : "Failed to create job.",
        },
      },
      { status: badReference ? 400 : 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
