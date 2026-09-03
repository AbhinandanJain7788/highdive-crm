import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { APPLICATION_STATUSES } from "@/lib/candidates";
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];
type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/applications/:id — status and/or pipeline stage.
// Status lives here rather than on the candidate because a person can hold several
// applications with different statuses (claude.md: "candidate ≠ application").
// A recruiter may update their own; RLS decides which rows that means.
//
// `status` and `pipeline_stage_id` are deliberately NOT auto-synced: they're
// different vocabularies (Phase 0's As-Built Notes record the lossy inference used
// at seed time), and each pipeline template names its stages differently, so
// guessing a stage from a status would write the wrong row for any job not on the
// default template. Callers that want both set send both.
export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("manage_candidates");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { code: "bad_request", message: "A JSON body is required." } }, { status: 400 });
  }

  const patch: Database["public"]["Tables"]["applications"]["Update"] = {};

  if (body.status !== undefined) {
    if (!APPLICATION_STATUSES.includes(body.status as ApplicationStatus)) {
      return NextResponse.json(
        { error: { code: "bad_request", message: `Status must be one of: ${APPLICATION_STATUSES.join(", ")}.` } },
        { status: 400 }
      );
    }
    patch.status = body.status as ApplicationStatus;
  }

  if (body.pipelineStageId !== undefined) {
    patch.pipeline_stage_id = typeof body.pipelineStageId === "string" && body.pipelineStageId ? body.pipelineStageId : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "No editable fields supplied." } }, { status: 400 });
  }

  const supabase = await createClient();

  // A stage must belong to the template the application's own job uses, or the job's
  // pipeline breakdown would silently stop counting this row.
  if (patch.pipeline_stage_id) {
    const { data: application } = await supabase
      .from("applications")
      .select("job:jobs(pipeline_template_id)")
      .eq("id", id)
      .maybeSingle<{ job: { pipeline_template_id: string } | null }>();
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("pipeline_template_id")
      .eq("id", patch.pipeline_stage_id)
      .maybeSingle();

    if (application?.job && stage && stage.pipeline_template_id !== application.job.pipeline_template_id) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "That stage belongs to a different pipeline template than this job." } },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("applications")
    .update(patch)
    .eq("id", id)
    .select("id, status, pipeline_stage_id, candidate_id, job_id")
    .maybeSingle();

  if (error) {
    console.error(`PATCH /api/applications/${id} failed`, error);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to update application." } }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: { code: "not_found", message: "Application not found." } }, { status: 404 });
  }

  return NextResponse.json({ data });
}
