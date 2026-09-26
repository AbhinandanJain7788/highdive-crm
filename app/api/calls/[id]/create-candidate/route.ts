import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { createCandidateFromCall, getCallById } from "@/lib/calls";
import { normalizePhoneDisplay } from "@/lib/format";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/calls/:id/create-candidate — for a call the auto-resolution trigger
// never matched (a genuinely new caller, not just an unattributed application),
// creates the candidate record and links this call to it. Distinct from
// /attribute, which only ever links to a candidate that already exists.
export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("attribute_calls");
  if (guard instanceof NextResponse) return guard;
  if (!guard.permissions.includes("manage_candidates")) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Missing permission: manage_candidates" } },
      { status: 403 }
    );
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid call id." } }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: { code: "bad_request", message: "Name is required." } }, { status: 400 });
  }
  const phone = typeof body?.phone === "string" && body.phone.trim() ? normalizePhoneDisplay(body.phone) : null;

  const supabase = await createClient();
  try {
    const result = await createCandidateFromCall(supabase, id, { name, phone, createdBy: guard.id });
    if (!result.ok) {
      const messages: Record<typeof result.reason, string> = {
        call_not_found: "Call not found.",
        already_linked: "This call is already linked to a candidate.",
        insert_failed: "Failed to create candidate.",
      };
      const status = result.reason === "call_not_found" ? 404 : result.reason === "insert_failed" ? 500 : 400;
      return NextResponse.json({ error: { code: result.reason, message: messages[result.reason] } }, { status });
    }
    const call = await getCallById(supabase, id);
    return NextResponse.json({ data: call }, { status: 201 });
  } catch (err) {
    console.error(`POST /api/calls/${rawId}/create-candidate failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to create candidate." } }, { status: 500 });
  }
}
