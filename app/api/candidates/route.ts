import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, requirePermission } from "@/lib/permissions";
import { APPLICATION_STATUSES, createCandidate, getCandidateRows, type CandidateListOptions } from "@/lib/candidates";
import { normalizePhoneDisplay, readPagination } from "@/lib/format";
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];
type SortKey = NonNullable<CandidateListOptions["sort"]>;
const SORT_KEYS: SortKey[] = ["name-asc", "name-desc", "created-new", "created-old"];

// GET /api/candidates — list with search / filters / pagination.
// Any signed-in user may call it; a recruiter sees only the candidates tied to an
// assignment they hold or held. That scoping is RLS's job (Phase 2), never a filter
// bolted on here — see claude.md > Business Logic Rules.
//
// Always assignedOnly: Customers is the working list, not the intake queue — an
// unassigned candidate (e.g. one just brought in by CSV import with no recruiter
// picked) has no owner yet and belongs on Allocations' "New" tab instead. There is
// deliberately no query param to turn this off; Allocations is where unassigned
// records live.
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
      assignedOnly: true,
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

  const result = await createCandidate(supabase, {
    name,
    phone: typeof body?.phone === "string" && body.phone.trim() ? normalizePhoneDisplay(body.phone) : null,
    email: typeof body?.email === "string" ? body.email : null,
    source: typeof body?.source === "string" ? body.source : null,
    notes: typeof body?.notes === "string" ? body.notes : null,
    resumeUrl: typeof body?.resumeUrl === "string" ? body.resumeUrl : null,
    processId: typeof body?.processId === "string" && body.processId ? body.processId : null,
    jobId,
    createdBy: guard.id,
  });

  if ("error" in result) {
    return NextResponse.json({ error: { code: "server_error", message: "Failed to create candidate." } }, { status: 500 });
  }
  if (result.applicationError) {
    const status = result.applicationError.code === "duplicate_application" ? 409 : 207;
    return NextResponse.json(
      { data: { ...result.candidate, application: null }, error: result.applicationError },
      { status }
    );
  }
  return NextResponse.json({ data: { ...result.candidate, application: result.application } }, { status: 201 });
}
