import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, requirePermission } from "@/lib/permissions";
import { getCallById, updateCallNotes } from "@/lib/calls";

type RouteParams = { params: Promise<{ id: string }> };

function parseCallId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/calls/:id — detail incl. b2_url for playback (claude.md API structure).
export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = parseCallId(rawId);
  if (id === null) {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid call id." } }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const call = await getCallById(supabase, id);
    if (!call) {
      return NextResponse.json({ error: { code: "not_found", message: "Call not found." } }, { status: 404 });
    }
    return NextResponse.json({ data: call });
  } catch (err) {
    console.error(`GET /api/calls/${rawId} failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load call." } }, { status: 500 });
  }
}

// PATCH /api/calls/:id — CRM-owned fields ONLY: notes. claude.md: "The CRM writes to
// `calls` only for `notes` and `application_id`." application_id is written
// exclusively through POST /api/calls/:id/attribute (and the DB trigger), never
// here — this route's own Update object has no other key it could even set, so a
// caller cannot smuggle `disposition`/`duration_seconds`/`topic`/etc. through it
// regardless of what the request body contains. RLS (calls_update) additionally
// requires the `attribute_calls` permission, gated the same way here for a clean
// 403 instead of a silent zero-row update.
export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("attribute_calls");
  if (guard instanceof NextResponse) return guard;

  const { id: rawId } = await params;
  const id = parseCallId(rawId);
  if (id === null) {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid call id." } }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("notes" in body)) {
    return NextResponse.json({ error: { code: "bad_request", message: "Only `notes` may be updated." } }, { status: 400 });
  }
  const notes = typeof body.notes === "string" ? (body.notes.trim() || null) : null;

  const supabase = await createClient();
  try {
    const call = await updateCallNotes(supabase, id, notes);
    if (!call) {
      return NextResponse.json({ error: { code: "not_found", message: "Call not found." } }, { status: 404 });
    }
    return NextResponse.json({ data: call });
  } catch (err) {
    console.error(`PATCH /api/calls/${rawId} failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to update call notes." } }, { status: 500 });
  }
}
