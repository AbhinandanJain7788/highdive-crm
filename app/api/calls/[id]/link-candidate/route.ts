import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { linkCallToExistingCandidate, getCallById } from "@/lib/calls";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/calls/:id/link-candidate — links a call to a candidate that already
// exists (found by phone-digit match, surfaced as `suggestedCandidate` on the
// unattributed queue) instead of creating a duplicate. Distinct from
// /create-candidate, which is for a call whose caller has no candidate record at
// all.
export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("attribute_calls");
  if (guard instanceof NextResponse) return guard;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid call id." } }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const candidateId = typeof body?.candidateId === "string" ? body.candidateId : "";
  if (!candidateId) {
    return NextResponse.json({ error: { code: "bad_request", message: "candidateId is required." } }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const result = await linkCallToExistingCandidate(supabase, id, candidateId);
    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        call_not_found: "Call not found.",
        already_linked: "This call is already linked to a candidate.",
        candidate_not_found: "Candidate not found.",
        phone_mismatch: "That candidate's phone number doesn't match this call.",
      };
      const status = result.reason === "call_not_found" || result.reason === "candidate_not_found" ? 404 : 400;
      return NextResponse.json({ error: { code: result.reason, message: messages[result.reason] } }, { status });
    }
    const call = await getCallById(supabase, id);
    return NextResponse.json({ data: call });
  } catch (err) {
    console.error(`POST /api/calls/${rawId}/link-candidate failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to link candidate." } }, { status: 500 });
  }
}
