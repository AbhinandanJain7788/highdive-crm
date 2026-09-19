import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, requirePermission } from "@/lib/permissions";
import { getInterviewRows, createInterview } from "@/lib/interviews";

// GET /api/interviews — list interviews, optionally scoped to a candidate, an
// application or a client (claude.md API structure). RLS (interviews_select)
// scopes this to view_all_records holders, the assigned interviewer, or anyone
// holding the assignment on the underlying application.
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const supabase = await createClient();
  try {
    const rows = await getInterviewRows(supabase, {
      candidateId: searchParams.get("candidateId") ?? undefined,
      applicationId: searchParams.get("applicationId") ?? undefined,
      clientId: searchParams.get("clientId") ?? undefined,
      interviewerId: searchParams.get("interviewerId") ?? undefined,
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error("GET /api/interviews failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load interviews." } }, { status: 500 });
  }
}

// POST /api/interviews — schedule an interview against an application. The
// client is derived from the application's job (jobs.client_id) rather than
// picked separately, since an interview only ever exists in the context of a
// candidate's application to a specific client's job.
export async function POST(request: Request) {
  const guard = await requirePermission("manage_interviews");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  const scheduledAt = typeof body?.scheduledAt === "string" ? body.scheduledAt : "";

  if (!applicationId || !scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "applicationId and a valid scheduledAt are required." } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  try {
    const result = await createInterview(supabase, {
      applicationId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      interviewerId: typeof body?.interviewerId === "string" ? body.interviewerId : undefined,
      scheduledBy: guard.id,
      durationMinutes: typeof body?.durationMinutes === "number" ? body.durationMinutes : undefined,
      location: typeof body?.location === "string" ? body.location : undefined,
      note: typeof body?.note === "string" ? body.note : undefined,
    });
    if ("error" in result) {
      return NextResponse.json(
        { error: { code: result.error, message: "That application does not exist." } },
        { status: 400 }
      );
    }
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    console.error("POST /api/interviews failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to schedule interview." } }, { status: 500 });
  }
}
