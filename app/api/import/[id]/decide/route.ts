import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { decideImportRow } from "@/lib/import";
import type { Database } from "@/types/supabase";

type ImportDecision = Database["public"]["Enums"]["import_decision"];
const DECISIONS: ImportDecision[] = ["pending", "skip", "import_anyway"];

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/import/:id/decide — body: { rowId, decision: "skip"|"import_anyway" }.
export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("bulk_import");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const rowId = typeof body?.rowId === "string" ? body.rowId : "";
  const decision: ImportDecision | null = DECISIONS.includes(body?.decision) ? body.decision : null;

  if (!rowId || !decision) {
    return NextResponse.json({ error: { code: "bad_request", message: "rowId and decision are required." } }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    await decideImportRow(supabase, { rowId, decision });
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error(`POST /api/import/${id}/decide failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to record decision." } }, { status: 500 });
  }
}
