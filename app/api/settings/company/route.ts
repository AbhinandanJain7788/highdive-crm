import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getCompanyDetails, updateCompanyDetails } from "@/lib/settings";

// GET/PATCH /api/settings/company — "admin" per claude.md; gated on `view_all_records`.
export async function GET() {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();
  try {
    const data = await getCompanyDetails(supabase);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/settings/company failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load company details." } }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid request body." } }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  for (const field of ["companyName", "address", "phone", "email", "website"] as const) {
    if (typeof body[field] === "string") patch[field] = body[field];
  }

  const supabase = await createClient();
  try {
    const data = await updateCompanyDetails(supabase, patch, guard.id);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("PATCH /api/settings/company failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to update company details." } }, { status: 500 });
  }
}
