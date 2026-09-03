import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, requirePermission } from "@/lib/permissions";
import { getCandidateDetail } from "@/lib/candidates";
import { assignNullableText } from "@/lib/format";
import type { Database } from "@/types/supabase";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/candidates/:id — detail, with every application the candidate holds.
// RLS decides whether this recruiter may see the row at all; a row they can't see
// comes back empty and is reported as 404, not 403, so the API never confirms the
// existence of a record the caller has no right to know about.
export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();
  try {
    const candidate = await getCandidateDetail(supabase, id);
    if (!candidate) {
      return NextResponse.json({ error: { code: "not_found", message: "Candidate not found." } }, { status: 404 });
    }
    return NextResponse.json({ data: candidate });
  } catch (err) {
    console.error(`GET /api/candidates/${id} failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load candidate." } }, { status: 500 });
  }
}

// PATCH /api/candidates/:id — candidate-owned fields only.
// Status, pipeline stage and recruiter belong to `applications`, not here: a
// candidate with two applications has two statuses, and writing one onto the person
// would silently pick a winner. Those go through the applications routes.
type CandidateUpdate = Database["public"]["Tables"]["candidates"]["Update"];

export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("manage_candidates");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { code: "bad_request", message: "A JSON body is required." } }, { status: 400 });
  }

  const patch: CandidateUpdate = {};
  if ("name" in body) {
    // `name` is NOT NULL — blanking it would be a constraint violation surfaced as
    // an opaque 500, so reject it here with a message that explains itself.
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: { code: "bad_request", message: "Name cannot be empty." } }, { status: 400 });
    }
    patch.name = name;
  }
  if ("phone" in body) assignNullableText(patch, "phone", body.phone);
  if ("email" in body) assignNullableText(patch, "email", body.email);
  if ("source" in body) assignNullableText(patch, "source", body.source);
  if ("notes" in body) assignNullableText(patch, "notes", body.notes);
  if ("resumeUrl" in body) assignNullableText(patch, "resume_url", body.resumeUrl);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "No editable fields supplied." } }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidates")
    .update(patch)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`PATCH /api/candidates/${id} failed`, error);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to update candidate." } }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: { code: "not_found", message: "Candidate not found." } }, { status: 404 });
  }

  const candidate = await getCandidateDetail(supabase, id);
  return NextResponse.json({ data: candidate });
}
