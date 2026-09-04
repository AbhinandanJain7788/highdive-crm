import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { createReportRequest, listReportRequests, REPORT_TYPES, type ReportDateBasis } from "@/lib/reportRequests";

// GET /api/report-requests — list requested reports + history (own rows only unless
// view_all_records, enforced by RLS).
export async function GET() {
  const guard = await requirePermission("request_reports");
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();
  try {
    const data = await listReportRequests(supabase);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/report-requests failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load report requests." } }, { status: 500 });
  }
}

// POST /api/report-requests — body: { reportType, dateFrom, dateTo, dateBasis }.
// See lib/reportRequests.ts's createReportRequest for why generation happens
// synchronously in this same request rather than via a deployed Edge Function/pg_cron.
export async function POST(request: Request) {
  const guard = await requirePermission("request_reports");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const reportType = typeof body?.reportType === "string" ? body.reportType : "";
  const dateFrom = typeof body?.dateFrom === "string" ? body.dateFrom : "";
  const dateTo = typeof body?.dateTo === "string" ? body.dateTo : "";
  const dateBasis: ReportDateBasis = body?.dateBasis === "last_interaction" ? "last_interaction" : "created_date";

  if (!reportType || !(REPORT_TYPES as readonly string[]).includes(reportType)) {
    return NextResponse.json({ error: { code: "bad_request", message: "reportType must be one of the known report types." } }, { status: 400 });
  }
  if (!dateFrom || !dateTo || Number.isNaN(new Date(dateFrom).getTime()) || Number.isNaN(new Date(dateTo).getTime())) {
    return NextResponse.json({ error: { code: "bad_request", message: "dateFrom and dateTo are required valid dates." } }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const { row, failureReason } = await createReportRequest(supabase, { reportType, dateFrom, dateTo, dateBasis, requestedBy: guard.id });
    return NextResponse.json({ data: row, ...(failureReason ? { failureReason } : {}) });
  } catch (err) {
    console.error("POST /api/report-requests failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to request report." } }, { status: 500 });
  }
}
