import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, requirePermission } from "@/lib/permissions";
import { APPLICATION_STATUSES } from "@/lib/candidates";
import { escapeFilterValue, phoneSearchPattern, rangeOverflow, readPagination } from "@/lib/format";
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

type RawApplication = {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  candidate: { id: string; name: string; phone: string | null } | null;
  job: { id: string; title: string } | null;
  recruiter: { id: string; name: string } | null;
};

const APPLICATION_SELECT = `
  id, status, created_at,
  candidate:candidates!inner(id, name, phone),
  job:jobs(id, title),
  recruiter:users!applications_assigned_recruiter_id_fkey(id, name)
`;

// GET /api/applications — list (filter/search/paginate), documented in claude.md's API
// table but never actually built until now (Phase 8/9 flagged the gap: application
// creation happens inline through POST /api/candidates, but there was no standalone
// list/create surface for applications themselves). Gated the same as
// PATCH /api/applications/:id (`manage_candidates`) for consistency; RLS's own
// `applications_select` policy is the real per-row scoping authority underneath.
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statuses = searchParams
    .getAll("status")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v): v is ApplicationStatus => APPLICATION_STATUSES.includes(v as ApplicationStatus));
  const jobId = searchParams.get("jobId") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const pagination = readPagination(searchParams);

  const supabase = await createClient();
  let query = supabase.from("applications").select(APPLICATION_SELECT, { count: "exact" });

  if (statuses.length) query = query.in("status", statuses);
  if (jobId) query = query.eq("job_id", jobId);
  if (search?.trim()) {
    const term = escapeFilterValue(search);
    const phonePattern = phoneSearchPattern(search);
    const clauses = [`name.ilike.%${term}%`];
    if (phonePattern) clauses.push(`phone.ilike.${phonePattern}`);
    query = query.or(clauses.join(","), { referencedTable: "candidates" });
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(pagination.from, pagination.to)
    .returns<RawApplication[]>();

  const overflow = rangeOverflow(error);
  if (overflow) return NextResponse.json({ data: [], total: overflow.total });

  if (error) {
    console.error("GET /api/applications failed", error);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load applications." } }, { status: 500 });
  }

  const rows = (data ?? []).map((a) => ({
    id: a.id,
    status: a.status,
    createdAt: a.created_at,
    candidateId: a.candidate?.id ?? null,
    candidateName: a.candidate?.name ?? null,
    candidatePhone: a.candidate?.phone ?? null,
    jobId: a.job?.id ?? null,
    jobTitle: a.job?.title ?? null,
    recruiterId: a.recruiter?.id ?? null,
    recruiterName: a.recruiter?.name ?? null,
  }));

  return NextResponse.json({ data: rows, total: count ?? 0 });
}

// POST /api/applications — create an application for an *existing* candidate against
// a job. This is distinct from POST /api/candidates (which creates a candidate and
// optionally their first application in one call) — this route is what a second
// application for an already-existing candidate goes through (the Ananya Sharma
// multi-application scenario from Phase 0, previously only ever created directly in
// SQL). Opening stage is resolved from the job's own pipeline template, never
// hardcoded, matching POST /api/candidates' identical logic.
export async function POST(request: Request) {
  const guard = await requirePermission("manage_candidates");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const candidateId = typeof body?.candidateId === "string" ? body.candidateId : "";
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  if (!candidateId || !jobId) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "`candidateId` and `jobId` are required." } },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("pipeline_template_id")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) {
    return NextResponse.json({ error: { code: "server_error", message: jobError.message } }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: { code: "bad_request", message: "Job not found." } }, { status: 400 });
  }

  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline_template_id", job.pipeline_template_id)
    .order("sequence_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: application, error: insertError } = await supabase
    .from("applications")
    .insert({ candidate_id: candidateId, job_id: jobId, pipeline_stage_id: stage?.id ?? null, status: "new" })
    .select("id, status, candidate_id, job_id, pipeline_stage_id, created_at")
    .single();

  if (insertError) {
    const conflict = insertError.code === "23505";
    console.error("POST /api/applications failed", insertError);
    return NextResponse.json(
      {
        error: {
          code: conflict ? "duplicate_application" : "server_error",
          message: conflict ? "This candidate already has an application for this job." : "Failed to create application.",
        },
      },
      { status: conflict ? 409 : 500 }
    );
  }

  return NextResponse.json({ data: application }, { status: 201 });
}
