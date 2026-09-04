import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getGeneralSettings, updateGeneralSettings } from "@/lib/settings";

// GET/PATCH /api/settings/general — "admin" per claude.md; gated on `view_all_records`,
// same convention as /api/notification-settings.
export async function GET() {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();
  try {
    const data = await getGeneralSettings(supabase);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/settings/general failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load settings." } }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid request body." } }, { status: 400 });
  }

  const patch: Record<string, boolean> = {};
  for (const field of ["limitAssignTo", "whatsappNotifications", "logoutMobile", "logoutWeb"] as const) {
    if (typeof body[field] === "boolean") patch[field] = body[field];
  }

  const supabase = await createClient();
  try {
    const data = await updateGeneralSettings(supabase, patch, guard.id);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("PATCH /api/settings/general failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to update settings." } }, { status: 500 });
  }
}
