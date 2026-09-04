import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, requirePermission } from "@/lib/permissions";
import { getFollowUpRows, getFollowUpBucketCounts, createFollowUp } from "@/lib/followups";
import { readPagination } from "@/lib/format";

// GET /api/follow-ups/recurring — recurring follow-ups (claude.md API structure):
// every follow_ups row with is_recurring = true, plus the same Pending/Upcoming
// counts the non-recurring list uses.
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const supabase = await createClient();
  try {
    const options = { isRecurring: true as const };
    const [{ rows, total }, counts] = await Promise.all([
      getFollowUpRows(supabase, { ...options, sort: "due-asc", pagination: readPagination(searchParams) }),
      getFollowUpBucketCounts(supabase, options),
    ]);
    return NextResponse.json({ data: rows, total, counts });
  } catch (err) {
    console.error("GET /api/follow-ups/recurring failed", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to load recurring follow-ups." } },
      { status: 500 }
    );
  }
}

// POST /api/follow-ups/recurring — same as POST /api/follow-ups but forces
// is_recurring = true and requires a recurrence rule (freeform text, e.g. "Weekly"
// / "Every 2 weeks" — there's no separate recurrence-frequency enum in the schema).
export async function POST(request: Request) {
  const guard = await requirePermission("manage_follow_ups");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  const dueAt = typeof body?.dueAt === "string" ? body.dueAt : "";
  const recurrenceRule = typeof body?.recurrenceRule === "string" ? body.recurrenceRule.trim() : "";
  const assignTo = typeof body?.assignTo === "string" && body.assignTo ? body.assignTo : guard.id;

  if (!applicationId || !dueAt || Number.isNaN(new Date(dueAt).getTime()) || !recurrenceRule) {
    return NextResponse.json(
      {
        error: {
          code: "bad_request",
          message: "applicationId, a valid dueAt, and recurrenceRule are required.",
        },
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  try {
    const result = await createFollowUp(supabase, {
      applicationId,
      dueAt: new Date(dueAt).toISOString(),
      assignTo,
      assignedBy: guard.id,
      note: typeof body?.note === "string" ? body.note : undefined,
      isRecurring: true,
      recurrenceRule,
    });
    if ("error" in result) {
      return NextResponse.json(
        { error: { code: result.error, message: "That application does not exist." } },
        { status: 400 }
      );
    }
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    console.error("POST /api/follow-ups/recurring failed", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to schedule recurring follow-up." } },
      { status: 500 }
    );
  }
}
