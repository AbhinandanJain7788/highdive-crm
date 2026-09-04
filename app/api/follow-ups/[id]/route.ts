import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { updateFollowUp } from "@/lib/followups";
import type { Database } from "@/types/supabase";

type FollowUpStatus = Database["public"]["Enums"]["follow_up_status"];
const STATUSES: FollowUpStatus[] = ["pending", "completed", "cancelled"];
type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/follow-ups/:id — complete / cancel / reassign (claude.md API
// structure). Completing sets completed_at and (via lib/followups.ts's bucket
// logic) drops the row out of both the Pending and Upcoming tabs.
export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("manage_follow_ups");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { code: "bad_request", message: "A JSON body is required." } }, { status: 400 });
  }

  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: { code: "bad_request", message: `status must be one of: ${STATUSES.join(", ")}.` } },
      { status: 400 }
    );
  }
  if (body.dueAt !== undefined && Number.isNaN(new Date(body.dueAt).getTime())) {
    return NextResponse.json({ error: { code: "bad_request", message: "dueAt is not a valid date." } }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const updated = await updateFollowUp(supabase, id, {
      status: body.status,
      assignTo: typeof body.assignTo === "string" ? body.assignTo : undefined,
      dueAt: body.dueAt ? new Date(body.dueAt).toISOString() : undefined,
      note: "note" in body ? body.note : undefined,
    });
    if (!updated) {
      return NextResponse.json({ error: { code: "not_found", message: "Follow-up not found." } }, { status: 404 });
    }
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(`PATCH /api/follow-ups/${id} failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to update follow-up." } }, { status: 500 });
  }
}
