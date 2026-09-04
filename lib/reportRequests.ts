import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { formatDisplayDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/server";
import {
  REPORT_TYPES,
  UNBACKED_REPORT_TYPES,
  type ReportType,
  type ReportDateBasis,
  type ReportStatus,
  type ReportRequestRow,
} from "@/lib/reportRequests.shared";

export {
  REPORT_TYPES,
  UNBACKED_REPORT_TYPES,
  type ReportType,
  type ReportDateBasis,
  type ReportStatus,
  type ReportRequestRow,
} from "@/lib/reportRequests.shared";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  return lines.join("\r\n");
}

// No Storage bucket / Edge Function was provisioned for this phase (see the "queued ->
// ready" note below) — the generated CSV is embedded directly as a data: URI in
// report_requests.file_url. Small enough for this dataset's volumes, and genuinely
// downloadable/openable from a browser with zero extra infrastructure.
function toDataUrl(csv: string): string {
  const base64 = Buffer.from(csv, "utf-8").toString("base64");
  return `data:text/csv;charset=utf-8;base64,${base64}`;
}

function inRange(value: string | null | undefined, from: string, to: string): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  return t >= new Date(from).getTime() && t <= new Date(to).getTime();
}

// Shared by every report type whose date_basis can be "last_interaction" — one bulk
// fetch of calls grouped by candidate, reused rather than a per-candidate query.
async function lastInteractionByCandidate(supabase: SupabaseClient<Database>): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("calls")
    .select("candidate_id, call_time")
    .not("candidate_id", "is", null)
    .returns<{ candidate_id: string; call_time: string }[]>();
  if (error) throw error;
  const map = new Map<string, string>();
  for (const r of data ?? []) {
    const cur = map.get(r.candidate_id);
    if (!cur || new Date(r.call_time) > new Date(cur)) map.set(r.candidate_id, r.call_time);
  }
  return map;
}

type GenerateParams = { dateFrom: string; dateTo: string; dateBasis: ReportDateBasis };

async function generateCustomers(supabase: SupabaseClient<Database>, params: GenerateParams): Promise<string> {
  const { data, error } = await supabase
    .from("candidates")
    .select(
      `id, name, phone, email, source, created_at,
       applications(status, created_at, job:jobs(title), recruiter:users!applications_assigned_recruiter_id_fkey(name))`
    )
    .is("deleted_at", null)
    .returns<
      {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
        source: string | null;
        created_at: string;
        applications: { status: ApplicationStatus; created_at: string; job: { title: string } | null; recruiter: { name: string } | null }[] | null;
      }[]
    >();
  if (error) throw error;

  let rows = data ?? [];
  if (params.dateBasis === "last_interaction") {
    const lastMap = await lastInteractionByCandidate(supabase);
    rows = rows.filter((c) => inRange(lastMap.get(c.id), params.dateFrom, params.dateTo));
  } else {
    rows = rows.filter((c) => inRange(c.created_at, params.dateFrom, params.dateTo));
  }

  const body = rows.map((c) => {
    const apps = c.applications ?? [];
    const newest = apps.length
      ? apps.reduce((n, a) => (new Date(a.created_at) > new Date(n.created_at) ? a : n))
      : null;
    return [
      c.name,
      c.phone ?? "",
      c.email ?? "",
      c.source ?? "",
      newest?.status ?? "",
      newest?.job?.title ?? "",
      newest?.recruiter?.name ?? "",
      formatDisplayDateTime(c.created_at),
    ];
  });
  return toCsv(["Name", "Phone", "Email", "Source", "Status", "Job", "Recruiter", "CreatedOn"], body);
}

// Call Logs' date basis always reads call_time regardless of the form's Created
// Date/Last Interaction toggle — a call *is* the interaction, so there's no second
// date to distinguish it from (documented divergence from the other report types).
async function generateCallLogs(supabase: SupabaseClient<Database>, params: GenerateParams): Promise<string> {
  const { data, error } = await supabase
    .from("calls")
    .select("id, call_time, duration_seconds, direction_normalized, disposition, candidate_id, candidate:candidates(name, phone, deleted_at), agent:users(name)")
    .gte("call_time", params.dateFrom)
    .lte("call_time", params.dateTo)
    .order("call_time", { ascending: false })
    .returns<
      {
        id: number;
        call_time: string;
        duration_seconds: number | null;
        direction_normalized: string | null;
        disposition: string | null;
        candidate_id: string | null;
        candidate: { name: string; phone: string | null; deleted_at: string | null } | null;
        agent: { name: string } | null;
      }[]
    >();
  if (error) throw error;

  const rows = (data ?? []).filter((r) => !r.candidate || r.candidate.deleted_at === null);
  const body = rows.map((r) => [
    r.candidate?.name ?? "Unknown Caller",
    r.candidate?.phone ?? "",
    r.direction_normalized ?? "",
    (r.duration_seconds ?? 0) > 0 ? "Connected" : "Not Connected",
    r.duration_seconds ?? 0,
    r.disposition ?? "",
    r.agent?.name ?? "",
    formatDisplayDateTime(r.call_time),
  ]);
  return toCsv(["Candidate", "Phone", "Direction", "ConnectionState", "DurationSeconds", "Disposition", "Agent", "CalledAt"], body);
}

// v_interactions only exposes one date column (interacted_on = max call_time per
// application), so both date_basis choices filter on it here — "Last/Unique" dedupes
// to the candidate's single most-recent interaction row; "All" keeps every
// candidate+application interaction row in range.
async function generateInteractions(
  supabase: SupabaseClient<Database>,
  params: GenerateParams,
  unique: boolean
): Promise<string> {
  const { data, error } = await supabase
    .from("v_interactions")
    .select("candidate_id, name, phone, application_status, interacted_on")
    .gte("interacted_on", params.dateFrom)
    .lte("interacted_on", params.dateTo)
    .order("interacted_on", { ascending: false })
    .returns<{ candidate_id: string; name: string | null; phone: string | null; application_status: string | null; interacted_on: string | null }[]>();
  if (error) throw error;

  let rows = data ?? [];
  if (unique) {
    const seen = new Set<string>();
    rows = rows.filter((r) => {
      if (seen.has(r.candidate_id)) return false;
      seen.add(r.candidate_id);
      return true;
    });
  }
  const body = rows.map((r) => [r.name ?? "", r.phone ?? "", r.application_status ?? "", formatDisplayDateTime(r.interacted_on)]);
  return toCsv(["Name", "Phone", "Status", "InteractedOn"], body);
}

const TERMINAL_POSITIVE: ApplicationStatus[] = ["selected", "joined"];
const TERMINAL_NEGATIVE: ApplicationStatus[] = ["rejected", "not_interested", "no_response"];

// "Pending"/"Completed" aren't real v_allocations buckets (only "new"/"attempted"
// exist) — interpreted as attempted-but-not-yet-terminal vs. attempted-and-selected/
// joined, since the signed-off HTML never defines these precisely either. Documented
// as this phase's own reasonable call, not extracted from anywhere.
async function generateAllocations(
  supabase: SupabaseClient<Database>,
  params: GenerateParams,
  variant: "common" | "pending" | "completed"
): Promise<string> {
  const bucket = variant === "common" ? "new" : "attempted";
  const { data, error } = await supabase
    .from("v_allocations")
    .select("candidate_id, name, phone, application_status, job_title, created_on")
    .eq("bucket", bucket)
    .returns<{ candidate_id: string; name: string | null; phone: string | null; application_status: string | null; job_title: string | null; created_on: string | null }[]>();
  if (error) throw error;

  let rows = data ?? [];
  if (params.dateBasis === "created_date") {
    rows = rows.filter((r) => inRange(r.created_on, params.dateFrom, params.dateTo));
  } else {
    const lastMap = await lastInteractionByCandidate(supabase);
    rows = rows.filter((r) => inRange(lastMap.get(r.candidate_id), params.dateFrom, params.dateTo));
  }
  if (variant === "pending") {
    rows = rows.filter((r) => !TERMINAL_POSITIVE.includes(r.application_status as ApplicationStatus) && !TERMINAL_NEGATIVE.includes(r.application_status as ApplicationStatus));
  } else if (variant === "completed") {
    rows = rows.filter((r) => TERMINAL_POSITIVE.includes(r.application_status as ApplicationStatus));
  }

  const body = rows.map((r) => [r.name ?? "", r.phone ?? "", r.application_status ?? "", r.job_title ?? "", formatDisplayDateTime(r.created_on)]);
  return toCsv(["Name", "Phone", "Status", "Job", "CreatedOn"], body);
}

async function generateReportCsv(supabase: SupabaseClient<Database>, reportType: ReportType, params: GenerateParams): Promise<string> {
  switch (reportType) {
    case "Customers":
      return generateCustomers(supabase, params);
    case "Call Logs (All/Unique)":
      return generateCallLogs(supabase, params);
    case "Interactions (All)":
      return generateInteractions(supabase, params, false);
    case "Interactions (Last/Unique)":
      return generateInteractions(supabase, params, true);
    case "Allocations (Common Pool)":
      return generateAllocations(supabase, params, "common");
    case "Allocations (Pending)":
      return generateAllocations(supabase, params, "pending");
    case "Allocations (Completed)":
      return generateAllocations(supabase, params, "completed");
    default:
      throw new Error(`No generator for report type "${reportType}".`);
  }
}

function toRow(r: Database["public"]["Tables"]["report_requests"]["Row"]): ReportRequestRow {
  return {
    id: r.id,
    reportType: r.report_type,
    dateFrom: r.date_from,
    dateTo: r.date_to,
    dateBasis: r.date_basis,
    status: r.status,
    fileUrl: r.file_url,
    requestedById: r.requested_by,
    createdAt: r.created_at,
  };
}

export type CreateReportRequestParams = {
  reportType: string;
  dateFrom: string;
  dateTo: string;
  dateBasis: ReportDateBasis;
  requestedBy: string;
};

// POST /api/report-requests — inserts a `queued` row, then generates the report
// synchronously within the same request and transitions it to `ready` (file_url set)
// or `failed`, before returning.
//
// claude.md Phase 6 asks for asynchronous generation via an Edge Function or pg_cron.
// Neither was reachable this session: the Supabase MCP connector was unavailable
// (ToolSearch found no `mcp__*Supabase*` tools at all, unlike the session that
// finished Phase 5), and the service-role REST fallback can reach PostgREST but not
// deploy Edge Functions or schedule pg_cron jobs — the same DDL/deploy ceiling Phase
// 3/4's As-Built Notes already ran into for the `not_eligible` enum and
// `deleted_at` column. Per the phase brief's own fallback instruction, this
// implements the queued -> ready|failed transition synchronously instead of leaving
// every request stuck at "queued" forever — a documented simplification, not a
// silent shortcut.
export async function createReportRequest(
  supabase: SupabaseClient<Database>,
  params: CreateReportRequestParams
): Promise<{ row: ReportRequestRow; failureReason?: string }> {
  const { data: inserted, error: insertErr } = await supabase
    .from("report_requests")
    .insert({
      report_type: params.reportType,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      date_basis: params.dateBasis,
      requested_by: params.requestedBy,
      status: "queued",
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;

  const reportType = params.reportType as ReportType;
  let status: ReportStatus = "failed";
  let fileUrl: string | null = null;
  let failureReason: string | undefined;

  if (UNBACKED_REPORT_TYPES.includes(reportType)) {
    failureReason = `No data source exists yet for "${reportType}" in the current schema.`;
  } else if (!(REPORT_TYPES as readonly string[]).includes(reportType)) {
    failureReason = `Unknown report type "${reportType}".`;
  } else {
    try {
      const csv = await generateReportCsv(supabase, reportType, {
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        dateBasis: params.dateBasis,
      });
      fileUrl = toDataUrl(csv);
      status = "ready";
    } catch (err) {
      console.error("Report generation failed", err);
      failureReason = "Report generation failed unexpectedly.";
    }
  }

  // RLS on report_requests grants the requester INSERT (verified: the insert above
  // succeeds under the request-scoped client) but not UPDATE — that transition was
  // designed to be made by a trusted background worker (the Edge Function/pg_cron job
  // claude.md actually asks for), not the requesting user's own session. Discovered
  // live: the request-scoped UPDATE below 500'd with PostgREST's PGRST116 ("0 rows"),
  // i.e. silently matched nothing under RLS. The service-role client stands in for
  // that missing privileged worker for this one write — the same reasoning
  // lib/supabase/server.ts's createAdminClient already documents for
  // admin.inviteUserByEmail, extended here since there's no deployed Edge Function to
  // do it instead.
  const admin = createAdminClient();
  const { data: updated, error: updateErr } = await admin
    .from("report_requests")
    .update({ status, file_url: fileUrl })
    .eq("id", inserted.id)
    .select("*")
    .single();
  if (updateErr) throw updateErr;

  return { row: toRow(updated), failureReason };
}

// GET /api/report-requests — RLS already scopes this to the caller's own rows unless
// they hold view_all_records-equivalent access (Phase 2 As-Built Notes: "report_requests
// (own rows + request_reports to create)"); no extra filtering needed here.
export async function listReportRequests(supabase: SupabaseClient<Database>): Promise<ReportRequestRow[]> {
  const { data, error } = await supabase.from("report_requests").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toRow);
}
