import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserProfile } from "@/lib/permissions";
import { getRechurnMatches, initiateCommonPool, initiateSpecificOwner } from "@/lib/rechurn";
import { APPLICATION_STATUSES } from "@/lib/candidates.shared";
import type { RechurnDateBasis, ApplicationStatus } from "@/lib/rechurn.shared";

// POST /api/rechurn/initiate — body: { status?, dateBasis, dateFrom?, dateTo?,
// mode: "common" | "specific", recruiterId? (required when mode is "specific") }.
// "Assign in Common Pool" additionally requires the `bulk_import` permission, per the
// signed-off HTML's own stated requirement on that option ("Allowed if user has access
// to bulk import permission") — checked here, in addition to the base `manage_rechurn`
// gate every rechurn action needs.
export async function POST(request: Request) {
  const guard = await requirePermission("manage_rechurn");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const statusRaw = typeof body?.status === "string" ? body.status : undefined;
  const status: ApplicationStatus | undefined = APPLICATION_STATUSES.includes(statusRaw as ApplicationStatus)
    ? (statusRaw as ApplicationStatus)
    : undefined;
  const dateBasis: RechurnDateBasis = body?.dateBasis === "last_interaction" ? "last_interaction" : "created_date";
  const dateFrom = typeof body?.dateFrom === "string" ? body.dateFrom : undefined;
  const dateTo = typeof body?.dateTo === "string" ? body.dateTo : undefined;
  const mode = body?.mode === "specific" ? "specific" : body?.mode === "common" ? "common" : null;
  const recruiterId = typeof body?.recruiterId === "string" ? body.recruiterId : "";

  if (!mode) {
    return NextResponse.json({ error: { code: "bad_request", message: "mode must be 'common' or 'specific'." } }, { status: 400 });
  }
  if (mode === "specific" && !recruiterId) {
    return NextResponse.json({ error: { code: "bad_request", message: "recruiterId is required for mode 'specific'." } }, { status: 400 });
  }
  if (mode === "common") {
    const profile = await getCurrentUserProfile();
    if (!profile?.permissions.includes("bulk_import")) {
      return NextResponse.json(
        { error: { code: "forbidden", message: "Assigning to the common pool requires the bulk_import permission." } },
        { status: 403 }
      );
    }
  }

  const supabase = await createClient();
  try {
    const matches = await getRechurnMatches(supabase, { status, dateBasis, dateFrom, dateTo });
    const result =
      mode === "common"
        ? await initiateCommonPool(supabase, matches)
        : await initiateSpecificOwner(supabase, matches, recruiterId, guard.id);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("POST /api/rechurn/initiate failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to initiate rechurn." } }, { status: 500 });
  }
}
