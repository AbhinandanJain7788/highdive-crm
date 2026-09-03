import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { transferOwnership } from "@/lib/data-management";

// POST /api/data/transfer — body: { fromUserId, toUserId }. Moves every candidate
// `fromUserId` currently holds an active assignment on over to `toUserId`, and logs
// the move. claude.md marks this admin-only; `view_all_records` is the permission
// key that resolves to "admin" without hardcoding a role name (Phase 2/3 convention).
export async function POST(request: Request) {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const fromUserId = typeof body?.fromUserId === "string" ? body.fromUserId : "";
  const toUserId = typeof body?.toUserId === "string" ? body.toUserId : "";

  if (!fromUserId || !toUserId) {
    return NextResponse.json({ error: { code: "bad_request", message: "fromUserId and toUserId are required." } }, { status: 400 });
  }
  if (fromUserId === toUserId) {
    return NextResponse.json({ error: { code: "bad_request", message: "fromUserId and toUserId must differ." } }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const result = await transferOwnership(supabase, { fromUserId, toUserId, performedBy: guard.id });
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("POST /api/data/transfer failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to transfer." } }, { status: 500 });
  }
}
