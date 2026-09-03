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
