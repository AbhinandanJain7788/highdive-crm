import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getRechurnMatches } from "@/lib/rechurn";
import { APPLICATION_STATUSES } from "@/lib/candidates.shared";
import type { RechurnDateBasis, ApplicationStatus } from "@/lib/rechurn.shared";

// POST /api/rechurn/count — body: { status?, dateBasis, dateFrom?, dateTo? }. Returns
// the "Matched Customers" count for the Get Count button.
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

  const supabase = await createClient();
  try {
    const matches = await getRechurnMatches(supabase, { status, dateBasis, dateFrom, dateTo });
    return NextResponse.json({ data: { count: matches.length } });
  } catch (err) {
    console.error("POST /api/rechurn/count failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to count matches." } }, { status: 500 });
  }
}
