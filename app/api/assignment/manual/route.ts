import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { manualAssign } from "@/lib/assignment";

type ManualEntry = { applicationId: string; recruiterId: string };

// POST /api/assignment/manual — body: { assignments: [{ applicationId, recruiterId }] }.
export async function POST(request: Request) {
  const guard = await requirePermission("manage_assignment");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const assignments: ManualEntry[] = Array.isArray(body?.assignments)
    ? body.assignments.filter(
        (a: unknown): a is ManualEntry =>
          typeof a === "object" &&
          a !== null &&
          typeof (a as ManualEntry).applicationId === "string" &&
          typeof (a as ManualEntry).recruiterId === "string"
      )
    : [];

  if (assignments.length === 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "assignments is required." } }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const result = await manualAssign(supabase, { assignments, assignedBy: guard.id });
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("POST /api/assignment/manual failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to assign." } }, { status: 500 });
  }
}
