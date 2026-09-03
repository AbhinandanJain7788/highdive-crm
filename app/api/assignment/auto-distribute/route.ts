import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { autoDistribute } from "@/lib/assignment";

const METHODS = ["round_robin", "load_balanced"] as const;

// POST /api/assignment/auto-distribute — body: { applicationIds: string[], method }.
// Distributes across active recruiters only; each write relies on the DB's partial
// unique index to stay safe under concurrent calls (see lib/assignment.ts).
export async function POST(request: Request) {
  const guard = await requirePermission("manage_assignment");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const applicationIds = Array.isArray(body?.applicationIds)
    ? body.applicationIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];
  const method = METHODS.includes(body?.method) ? body.method : null;

  if (applicationIds.length === 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "applicationIds is required." } }, { status: 400 });
  }
  if (!method) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "method must be round_robin or load_balanced." } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  try {
    const result = await autoDistribute(supabase, { applicationIds, method, assignedBy: guard.id });
    if ("error" in result) {
      return NextResponse.json({ error: { code: "no_recruiters", message: result.error } }, { status: 409 });
    }
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("POST /api/assignment/auto-distribute failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to distribute." } }, { status: 500 });
  }
}
