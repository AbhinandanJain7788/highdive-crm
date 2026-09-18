import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { confirmImport } from "@/lib/import";
import type { ImportAssignOption } from "@/lib/import.shared";

type RouteParams = { params: Promise<{ id: string }> };

const AUTO_METHODS = ["round_robin", "load_balanced"];

// Body is optional — an absent/invalid `assign` falls back to "none" (previous
// behavior: newly-imported customers land unassigned in the common pool).
function parseAssignOption(body: unknown): ImportAssignOption {
  const assign = (body as { assign?: unknown } | null)?.assign as
    | { mode?: unknown; recruiterId?: unknown; method?: unknown }
    | undefined;
  if (assign?.mode === "manual" && typeof assign.recruiterId === "string" && assign.recruiterId) {
    return { mode: "manual", recruiterId: assign.recruiterId };
  }
  if (assign?.mode === "auto" && AUTO_METHODS.includes(assign.method as string)) {
    return { mode: "auto", method: assign.method as "round_robin" | "load_balanced" };
  }
  return { mode: "none" };
}

// POST /api/import/:id/confirm — finalizes the import and returns the count that
// actually landed, matching Import Complete's own count on the review step. Body:
// { assign?: { mode: "none" | "manual" | "auto", recruiterId?, method? }, jobId?: string }.
export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("bulk_import");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const assignOption = parseAssignOption(body);
  // The job every created customer's application attaches to when its own Job
  // column doesn't match an existing job — see confirmImport's `fallbackJobId`.
  const jobIdRaw = (body as { jobId?: unknown } | null)?.jobId;
  const jobId = typeof jobIdRaw === "string" && jobIdRaw ? jobIdRaw : null;

  const supabase = await createClient();
  try {
    const result = await confirmImport(supabase, id, guard.id, assignOption, jobId);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error(`POST /api/import/${id}/confirm failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to confirm import." } }, { status: 500 });
  }
}
