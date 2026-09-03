import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { reassign } from "@/lib/assignment";

// POST /api/assignment/reassign — body: { applicationId, recruiterId }. Never updates
// an assignment row in place: flips the current active row to 'reassigned' and
// inserts a fresh active one, so history survives (claude.md).
export async function POST(request: Request) {
  const guard = await requirePermission("manage_assignment");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  const recruiterId = typeof body?.recruiterId === "string" ? body.recruiterId : "";

  if (!applicationId || !recruiterId) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "applicationId and recruiterId are required." } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  try {
    const result = await reassign(supabase, { applicationId, recruiterId, assignedBy: guard.id });
    if (!result.ok) {
      const status = result.code === "conflict" ? 409 : 500;
      return NextResponse.json({ error: { code: result.code, message: result.message } }, { status });
    }
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error("POST /api/assignment/reassign failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to reassign." } }, { status: 500 });
  }
}
