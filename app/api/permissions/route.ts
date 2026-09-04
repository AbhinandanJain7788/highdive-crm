import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";

// GET /api/permissions — full permission catalogue. claude.md marks this "admin";
// the route previously only checked authentication (any signed-in user), a genuine
// drift found by Phase 7 Step 5's permissions sweep — not an intentional decision
// documented anywhere, and nothing in the app calls this route today (the Roles &
// Permissions page reads `permissions` directly via its own server component
// instead), so tightening it to `view_all_records` (the established admin-bypass
// marker) breaks nothing.
export async function GET() {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("permissions")
    .select("id, key, label, category")
    .order("category", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: { code: "server_error", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data ?? [] });
}
