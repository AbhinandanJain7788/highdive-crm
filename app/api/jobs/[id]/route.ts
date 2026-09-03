import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, requirePermission } from "@/lib/permissions";
import { getJobDetail, JOB_STATUSES } from "@/lib/jobs";
import type { Database } from "@/types/supabase";

type JobStatus = Database["public"]["Enums"]["job_status"];
type RouteParams = { params: Promise<{ id: string }> };

// GET /api/jobs/:id — detail including the template-driven pipeline breakdown.
// Open to any signed-in user (claude.md > API Structure): a recruiter working a
// candidate needs to see the job they're being put forward for.
export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();
  try {
    const job = await getJobDetail(supabase, id);
    if (!job) {
      return NextResponse.json({ error: { code: "not_found", message: "Job not found." } }, { status: 404 });
    }
    return NextResponse.json({ data: job });
  } catch (err) {
    console.error(`GET /api/jobs/${id} failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load job." } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("manage_jobs");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { code: "bad_request", message: "A JSON body is required." } }, { status: 400 });
  }

  const patch: Database["public"]["Tables"]["jobs"]["Update"] = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: { code: "bad_request", message: "Title cannot be empty." } }, { status: 400 });
    }
    patch.title = title;
  }
  if (body.status !== undefined) {
    if (!JOB_STATUSES.includes(body.status as JobStatus)) {
      return NextResponse.json(
        { error: { code: "bad_request", message: `Status must be one of: ${JOB_STATUSES.join(", ")}.` } },
        { status: 400 }
      );
    }
    patch.status = body.status as JobStatus;
  }
  if (body.openings !== undefined) {
    const openings = Number(body.openings);
    if (!Number.isFinite(openings) || openings < 1) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "Openings must be a positive number." } },
        { status: 400 }
      );
    }
    patch.openings = Math.floor(openings);
  }
  if (typeof body.clientId === "string" && body.clientId) patch.client_id = body.clientId;
  // Changing a job's template changes which stages its applications are counted
  // against; allowed, but the existing `pipeline_stage_id` values are left alone —
  // re-mapping applications across templates is a migration, not a field edit.
  if (typeof body.pipelineTemplateId === "string" && body.pipelineTemplateId) {
    patch.pipeline_template_id = body.pipelineTemplateId;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "No editable fields supplied." } }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("jobs").update(patch).eq("id", id).select("id").maybeSingle();

  if (error) {
    console.error(`PATCH /api/jobs/${id} failed`, error);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to update job." } }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: { code: "not_found", message: "Job not found." } }, { status: 404 });
  }

  return NextResponse.json({ data: await getJobDetail(supabase, id) });
}
