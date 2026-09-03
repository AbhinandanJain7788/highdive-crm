import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, requirePermission } from "@/lib/permissions";
import { APPLICATION_STATUSES, getCandidateRows, type CandidateListOptions } from "@/lib/candidates";
import { readPagination } from "@/lib/format";
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];
type SortKey = NonNullable<CandidateListOptions["sort"]>;
const SORT_KEYS: SortKey[] = ["name-asc", "name-desc", "created-new", "created-old"];

// GET /api/candidates — list with search / filters / pagination.
// Any signed-in user may call it; a recruiter sees only the candidates tied to an
// assignment they hold or held. That scoping is RLS's job (Phase 2), never a filter
// bolted on here — see claude.md > Business Logic Rules.
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statuses = searchParams
    .getAll("status")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value): value is ApplicationStatus => APPLICATION_STATUSES.includes(value as ApplicationStatus));
  const sources = searchParams
    .getAll("source")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const sortParam = searchParams.get("sort");

  const supabase = await createClient();
  try {
    const { rows, total } = await getCandidateRows(supabase, {
      search: searchParams.get("search") ?? undefined,
      statuses,
      sources,
      unassignedOnly: searchParams.get("unassigned") === "true",
      createdFrom: searchParams.get("createdFrom") ?? undefined,
      createdTo: searchParams.get("createdTo") ?? undefined,
      sort: SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : undefined,
      pagination: readPagination(searchParams),
    });
    return NextResponse.json({ data: rows, total });
  } catch (err) {
    console.error("GET /api/candidates failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load candidates." } }, { status: 500 });
  }
}

// POST /api/candidates — create a candidate, optionally with their first application.
// `jobId` is optional: a candidate can exist before they're put forward for a role,
// which is exactly the "new" allocation bucket Phase 4 reads.
export async function POST(request: Request) {
  const guard = await requirePermission("manage_candidates");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: { code: "bad_request", message: "Name is required." } }, { status: 400 });
  }

  const jobId = typeof body?.jobId === "string" && body.jobId ? body.jobId : null;
  const supabase = await createClient();

  const { data: candidate, error: insertError } = await supabase
    .from("candidates")
    .insert({
      name,
      phone: typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
      email: typeof body?.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null,
      source: typeof body?.source === "string" && body.source.trim() ? body.source.trim() : null,
      notes: typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      resume_url: typeof body?.resumeUrl === "string" && body.resumeUrl.trim() ? body.resumeUrl.trim() : null,
      process_id: typeof body?.processId === "string" && body.processId ? body.processId : null,
      created_by: guard.id,
    })
    .select("id, name, phone, email, source, notes, is_duplicate, resume_url, created_at")
    .single();

  if (insertError || !candidate) {
    console.error("POST /api/candidates insert failed", insertError);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to create candidate." } }, { status: 500 });
  }

  if (!jobId) return NextResponse.json({ data: { ...candidate, application: null } }, { status: 201 });

  // The job carries its own pipeline template, so the opening stage is whatever that
  // template's first stage is — never a hardcoded "New" (claude.md > DO NOT).
  const { data: job } = await supabase.from("jobs").select("pipeline_template_id").eq("id", jobId).maybeSingle();
  let firstStageId: string | null = null;
  if (job) {
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_template_id", job.pipeline_template_id)
      .order("sequence_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    firstStageId = stage?.id ?? null;
  }

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .insert({ candidate_id: candidate.id, job_id: jobId, pipeline_stage_id: firstStageId, status: "new" })
    .select("id, status, job_id, pipeline_stage_id, created_at")
    .single();

  if (applicationError) {
    // UNIQUE(candidate_id, job_id) — the candidate row itself was still created, so
    // report the conflict rather than pretending the whole request failed.
    const conflict = applicationError.code === "23505";
    console.error("POST /api/candidates application insert failed", applicationError);
    return NextResponse.json(
      {
        data: { ...candidate, application: null },
        error: {
          code: conflict ? "duplicate_application" : "application_failed",
          message: conflict
            ? "That candidate already has an application for this job."
            : "Candidate created, but the application could not be added.",
        },
      },
      { status: conflict ? 409 : 207 }
    );
  }

  return NextResponse.json({ data: { ...candidate, application } }, { status: 201 });
}
