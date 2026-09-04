import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { attributeCall, getCallById } from "@/lib/calls";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/calls/:id/attribute — link a call to one of its candidate's own
// applications (claude.md API structure). The auto-resolution trigger (Phase 5
// Step 1 migration) already links the unambiguous case; this route is exactly the
// "surface it in the unattributed queue" path for the zero/many cases it
// deliberately leaves null — it never guesses either, it only accepts an
// application that genuinely belongs to the call's own candidate.
export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("attribute_calls");
  if (guard instanceof NextResponse) return guard;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid call id." } }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  if (!applicationId) {
    return NextResponse.json({ error: { code: "bad_request", message: "applicationId is required." } }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const result = await attributeCall(supabase, id, applicationId);
    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        call_not_found: "Call not found.",
        no_candidate: "This call has no linked candidate to attribute.",
        application_mismatch: "That application does not belong to this call's candidate.",
      };
      const status = result.reason === "call_not_found" ? 404 : 400;
      return NextResponse.json({ error: { code: result.reason, message: messages[result.reason] } }, { status });
    }
    const call = await getCallById(supabase, id);
    return NextResponse.json({ data: call });
  } catch (err) {
    console.error(`POST /api/calls/${rawId}/attribute failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to attribute call." } }, { status: 500 });
  }
}
