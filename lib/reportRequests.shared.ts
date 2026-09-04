// Types shared by the server query module and client components — free of
// `server-only`/Supabase imports, same reason as lib/allocations.shared.ts.
import type { Database } from "@/types/supabase";

export type ReportDateBasis = Database["public"]["Enums"]["date_basis"];
export type ReportStatus = Database["public"]["Enums"]["report_status"];

// Verbatim from the signed-off HTML's reportTypesList (request-reports/page.tsx).
export const REPORT_TYPES = [
  "Interactions (All)",
  "Interactions (Last/Unique)",
  "Whatsapp Messages",
  "SMS Interactions",
  "Emails",
  "Allocations (Common Pool)",
  "Allocations (Pending)",
  "Allocations (Completed)",
  "Customers",
  "Call Logs (All/Unique)",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

// Report types with no backing data source at all in this schema — no message/SMS/
// email log table exists (whatsapp_templates holds message *templates*, never sent
// messages). Requesting one of these reaches `status: "failed"` with an honest reason
// rather than a fabricated empty/successful file.
export const UNBACKED_REPORT_TYPES: ReportType[] = ["Whatsapp Messages", "SMS Interactions", "Emails"];

// report_requests has no dedicated error-message column (claude.md's Data Schema:
// report_type, date_from, date_to, date_basis, requested_by, status, file_url,
// created_at — nothing else), so a failure reason for an unbacked report type is
// returned only in POST /api/report-requests' immediate response, not persisted —
// a later GET sees status: "failed" with file_url: null, without the "why."
export type ReportRequestRow = {
  id: string;
  reportType: string;
  dateFrom: string;
  dateTo: string;
  dateBasis: ReportDateBasis;
  status: ReportStatus;
  fileUrl: string | null;
  requestedById: string | null;
  createdAt: string;
};
