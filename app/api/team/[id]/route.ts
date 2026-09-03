import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import type { Database } from "@/types/supabase";

type UsersUpdate = Database["public"]["Tables"]["users"]["Update"];

// Fields the Team screen's edit affordances are allowed to change. Never
// includes `id`/`email`/`created_at` — email changes go through Supabase Auth,
// not this row.
const PATCHABLE_FIELDS = [
  "name",
  "phone",
  "role_id",
  "process_id",
  "reports_to",
  "status",
  "add_ons",
  "joined_on",
] as const satisfies readonly (keyof UsersUpdate)[];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission("manage_team");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid request body." } }, { status: 400 });
  }

  const update: UsersUpdate = {};
  for (const field of PATCHABLE_FIELDS) {
    if (field in body) (update as Record<string, unknown>)[field] = (body as Record<string, unknown>)[field];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "No updatable fields provided." } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .update(update)
    .eq("id", id)
    .select(
      "id, name, email, phone, status, avatar_color, add_ons, joined_on, created_at, role_id, process_id, reports_to"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: { code: "server_error", message: error.message } }, { status: 500 });
  }
  return NextResponse.json({ data });
}
