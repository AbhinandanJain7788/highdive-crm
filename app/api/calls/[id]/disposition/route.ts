import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import type { Database } from "@/types/supabase";

type RouteParams = { params: Promise<{ id: string }> };

type DispositionBody = {
  disposition: "interested" | "callback_later" | "not_reachable";
};

// Maps call_disposition values to application_status values.
// This is the single source of truth — the CRM's applications table is the
// authoritative status, and the call disposition is the trigger that updates it.
const DISPOSITION_TO_STATUS: Record<DispositionBody["disposition"], Database["public"]["Enums"]["application_status"]> = {
  interested: "interview_scheduled",
  callback_later: "contacted",
  not_reachable: "not_interested",
};

const DISPOSITION_LABELS: Record<DispositionBody["disposition"], string> = {
  interested: "Interested",
  callback_later: "Callback Later",
  not_reachable: "Not Reachable",
};

// POST /api/calls/:id/disposition — sets the call's disposition and updates the
// linked application's status in the CRM. Both the Android app (APK) and the CRM
// call this endpoint so there is one shared mapping.
export async function POST(request: Request, { params }: RouteParams) {
  const profile = await requirePermission("manage_follow_ups");
  if (profile instanceof NextResponse) return profile;

  const { id: rawId } = await params;
  const callId = Number(rawId);
  if (!Number.isInteger(callId) || callId <= 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid call id." } }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("disposition" in body)) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "`disposition` is required." } },
      { status: 400 }
    );
  }

  const { disposition } = body as Partial<DispositionBody>;
  if (disposition !== "interested" && disposition !== "callback_later" && disposition !== "not_reachable") {
    return NextResponse.json(
      { error: { code: "bad_request", message: "`disposition` must be `interested`, `callback_later`, or `not_reachable`." } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  try {
    const { data: call, error: callErr } = await supabase
      .from("calls")
      .select("id, candidate_id, application_id")
      .eq("id", callId)
      .maybeSingle();
    if (callErr) throw callErr;
    if (!call) {
      return NextResponse.json({ error: { code: "not_found", message: "Call not found." } }, { status: 404 });
    }

    // Update the call's disposition.
    const { error: updateErr } = await supabase
      .from("calls")
      .update({ disposition })
      .eq("id", callId);
    if (updateErr) throw updateErr;

    // If the call is linked to an application, update the application's status
    // in the CRM. The application table is the single source of truth for status.
    let applicationUpdated = false;
    if (call.application_id) {
      const newStatus = DISPOSITION_TO_STATUS[disposition as DispositionBody["disposition"]];
      const { error: appErr } = await supabase
        .from("applications")
        .update({ status: newStatus })
        .eq("id", call.application_id);
      if (appErr) {
        console.error(`Failed to update application ${call.application_id} status:`, appErr);
      } else {
        applicationUpdated = true;
      }

      // Write a status history entry.
      const { data: app } = await supabase
        .from("applications")
        .select("status")
        .eq("id", call.application_id)
        .maybeSingle();
      await supabase.from("application_status_history").insert({
        application_id: call.application_id,
        changed_by: profile.id,
        from_status: app?.status ?? null,
        to_status: newStatus,
        note: `Updated from call log: disposition set to ${DISPOSITION_LABELS[disposition as DispositionBody["disposition"]]}`,
      });
    }

    return NextResponse.json({
      data: { callId: call.id, disposition, applicationUpdated },
      message: `Disposition set to ${DISPOSITION_LABELS[disposition as DispositionBody["disposition"]]}.`,
    });
  } catch (err) {
    console.error(`POST /api/calls/${rawId}/disposition failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to set disposition." } }, { status: 500 });
  }
}
