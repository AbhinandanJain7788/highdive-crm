// Types and constants shared by server queries and client components.
// Deliberately free of `server-only` and of any Supabase import: lib/candidates.ts
// and lib/format.ts are server-side modules, so a "use client" component can't pull
// from them — it reads these instead.
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];
type JobStatus = Database["public"]["Enums"]["job_status"];

// Every list endpoint supports page/pageSize; the UI offers 10/25/50
// (claude.md > Conventions).
export const PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 25;

// The nine values `application_status` actually holds — lives here (not
// lib/candidates.ts) so client components can read it without pulling in a
// `server-only` module.
export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "new",
  "contacted",
  "interview_scheduled",
  "interview_done",
  "selected",
  "rejected",
  "not_interested",
  "no_response",
  "joined",
];

// Field names deliberately mirror lib/mock/candidates.ts's MockCandidate so the list
// screen's existing markup and components/ListFilters.tsx's renderColumnCell keep
// working when the page swaps the seed array for this.
export type CandidateRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: ApplicationStatus | null;
  jobId: string | null;
  jobTitle: string | null;
  recruiterId: string | null;
  recruiterName: string | null;
  source: string;
  createdOn: string;
  createdAt: string;
  isDuplicate: boolean;
  hasResume: boolean;
  notes: string;
  applicationId: string | null;
  stageId: string | null;
  stageName: string | null;
  applicationCount: number;
};

export type CandidateApplication = {
  id: string;
  status: ApplicationStatus;
  createdOn: string;
  createdAt: string;
  job: { id: string; title: string; status: JobStatus } | null;
  recruiter: { id: string; name: string } | null;
  stage: { id: string; name: string; sequenceOrder: number } | null;
};

// Keeps `applicationCount` from CandidateRow — the detail page uses it to decide
// whether to show the "Other Applications" block.
export type CandidateDetail = CandidateRow & {
  resumeUrl: string | null;
  duplicateOf: string | null;
  createdBy: { id: string; name: string } | null;
  applications: CandidateApplication[];
};
