import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { completeCallAction } from "@/lib/calls";
import type { Database } from "@/types/supabase";

type RouteParams = { params: Promise<{ id: string }> };

type ActionBody =
  | {
      type: "follow_up";
      dueAt: string;
      assignTo: string;
      note?: string | null;
    }
  | {
      type: "interview_scheduled";
      scheduledAt: string;
      interviewerId?: string | null;
      location?: string | null;
      note?: string | null;
    };

// POST /api/calls/:id/complete-action — completes a pending next_action set by
// the Android app. Creates the corresponding follow-up or interview, then clears
// the action fields on the call row.
export async function POST(request: Request, { params }: RouteParams) {
  const profile = await requirePermission("manage_follow_ups");
  if (profile instanceof NextResponse) return profile;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid call id." } }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("type" in body)) {
    return NextResponse.json({ error: { code: "bad_request", message: "`type` is required." } }, { status: 400 });
  }

  const actionType = body.type;
  if (actionType !== "follow_up" && actionType !== "interview_scheduled") {
    return NextResponse.json(
      { error: { code: "bad_request", message: "`type` must be `follow_up` or `interview_scheduled`." } },
      { status: 400 }
    );
  }

  const actionBody = body as ActionBody;

  if (actionType === "follow_up") {
    if (!(body as Record<string, unknown>).dueAt || !(body as Record<string, unknown>).assignTo) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "dueAt and assignTo are required for follow_up." } },
        { status: 400 }
      );
    }
  }

  if (actionType === "interview_scheduled") {
    if (!(body as Record<string, unknown>).scheduledAt) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "scheduledAt is required for interview_scheduled." } },
        { status: 400 }
      );
    }
  }

  const supabase = await createClient();
  try {
    const input =
      actionType === "follow_up"
        ? {
            type: "follow_up" as const,
            dueAt: (body as { dueAt: string }).dueAt,
            assignTo: (body as { assignTo: string }).assignTo === "self" ? profile.id : (body as { assignTo: string }).assignTo,
            assignedBy: profile.id,
            note: (body as { note?: string | null }).note ?? null,
          }
        : {
            type: "interview_scheduled" as const,
            scheduledAt: (body as { scheduledAt: string }).scheduledAt,
            interviewerId: (body as { interviewerId?: string | null }).interviewerId ?? null,
            location: (body as { location?: string | null }).location ?? null,
            note: (body as { note?: string | null }).note ?? null,
          };

    const result = await completeCallAction(supabase, id, input, profile.id);

    if ("error" in result) {
      const messages: Record<string, string> = {
        call_not_found: "Call not found.",
        no_application: "This call is not linked to an application. Please attribute it to a job first.",
        application_not_found: "Application not found.",
        no_candidate: "Call is missing candidate information.",
        action_not_pending: "No pending action on this call.",
      };
      return NextResponse.json(
        { error: { code: "bad_request", message: messages[result.error] ?? "Could not complete action." } },
        { status: 400 }
      );
    }

    if (result.kind === "follow_up_created") {
      return NextResponse.json({
        data: { kind: "follow_up_created", followUpId: result.followUpId },
        message: "Follow-up created.",
      });
    }

    return NextResponse.json({
      data: { kind: "interview_created", interviewId: result.interviewId },
      message: "Interview scheduled.",
    });
  } catch (err) {
    console.error(`POST /api/calls/${rawId}/complete-action failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to complete action." } }, { status: 500 });
  }
}
