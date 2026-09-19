import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { updateInterview } from "@/lib/interviews";
import { INTERVIEW_STATUSES } from "@/lib/interviews.shared";

type RouteParams = { params: Promise<{ id: string }> };

// PATCH /api/interviews/:id — reschedule, reassign interviewer, or change
// status (complete/cancel/no-show) (claude.md API structure).
export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("manage_interviews");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { code: "bad_request", message: "A JSON body is required." } }, { status: 400 });
  }

  if (body.status !== undefined && !INTERVIEW_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: { code: "bad_request", message: `status must be one of: ${INTERVIEW_STATUSES.join(", ")}.` } },
      { status: 400 }
    );
  }
  if (body.scheduledAt !== undefined && Number.isNaN(new Date(body.scheduledAt).getTime())) {
    return NextResponse.json({ error: { code: "bad_request", message: "scheduledAt is not a valid date." } }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const updated = await updateInterview(supabase, id, {
      status: body.status,
      interviewerId: "interviewerId" in body ? body.interviewerId : undefined,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt).toISOString() : undefined,
      durationMinutes: typeof body.durationMinutes === "number" ? body.durationMinutes : undefined,
      location: "location" in body ? body.location : undefined,
      note: "note" in body ? body.note : undefined,
    });
    if (!updated) {
      return NextResponse.json({ error: { code: "not_found", message: "Interview not found." } }, { status: 404 });
    }
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(`PATCH /api/interviews/${id} failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to update interview." } }, { status: 500 });
  }
}
