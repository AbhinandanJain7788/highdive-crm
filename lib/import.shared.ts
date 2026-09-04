// Types shared by the server query module and client components — see
// candidates.shared.ts for why these live apart from the server-only module.
export type ImportBatchSummary = {
  id: string;
  filename: string;
  uploadType: "allocations" | "customers";
  status: "uploading" | "validating" | "review" | "completed" | "failed";
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  createdAt: string;
};

export type DuplicateReviewRow = {
  rowId: string;
  raw: Record<string, string>;
  newName: string;
  newPhone: string;
  newJob: string;
  existingCandidateId: string;
  existingName: string;
  existingPhone: string;
  existingStatus: string;
};

// Why a row didn't make it in. Surfaced on the Import Complete card: a bare
// "0 rows imported, 17 skipped" gave no way to tell a wrong upload type from a
// mismatched column name, which is exactly what made a working import look broken.
export type ImportSkipReason =
  | "duplicate_skipped"
  | "missing_name"
  | "insert_failed"
  | "missing_phone"
  | "no_candidate_match"
  | "no_application"
  | "missing_recruiter"
  | "recruiter_not_found"
  | "recruiter_ambiguous"
  | "assignment_failed";

// Phrased as what the operator should change in their sheet, not as what the code
// checked — these are read by someone staring at a CSV, not at a stack trace.
export const SKIP_REASON_LABELS: Record<ImportSkipReason, string> = {
  duplicate_skipped: "Duplicate of an existing candidate, skipped during review",
  missing_name: "No value in the Name column",
  insert_failed: "The database rejected the row",
  missing_phone: "No value in the Phone column",
  no_candidate_match: "No existing candidate has that phone number",
  no_application: "That candidate has no application to allocate",
  missing_recruiter: "No recruiter in the row — add an “Assigned Recruiter” column",
  recruiter_not_found: "No user matches that recruiter name or email",
  recruiter_ambiguous: "Two users share that name — use their email address instead",
  assignment_failed: "Already allocated, or the assignment was rejected",
};

export type ImportSkipSummary = { reason: ImportSkipReason; label: string; count: number };

export type ImportResult = { imported: number; skipped: number; skipReasons: ImportSkipSummary[] };
