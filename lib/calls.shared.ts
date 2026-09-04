// Types shared by the server query module and client components — deliberately free
// of `server-only`/Supabase imports (same reason as lib/candidates.shared.ts).
import type { Database } from "@/types/supabase";

export type CallDirection = Database["public"]["Enums"]["call_direction"];
export type CallDisposition = Database["public"]["Enums"]["call_disposition"];

export const PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 25;

// Field names mirror lib/mock/callLogs.ts's MockCallLog shape so Call Logs' existing
// markup keeps working once it swaps the seed array for this — with `connected`
// (duration_seconds > 0) kept separate from `disposition` (the live enum's outcome
// axis), per claude.md Open Question 1's resolution: never merge the two.
export type CallRow = {
  id: number;
  candidateId: string | null;
  candidateName: string;
  phone: string;
  direction: CallDirection | null;
  calledAt: string;
  calledAtRaw: string;
  durationSeconds: number;
  connected: boolean;
  disposition: CallDisposition | null;
  byUserId: string | null;
  byUserName: string | null;
  hasRecording: boolean;
  notes: string | null;
  applicationId: string | null;
  jobTitle: string | null;
};

export type CallDetail = CallRow & {
  b2Url: string | null;
  storagePath: string | null;
  callbackDueAt: string | null;
};

// The unattributed queue's "Attribute to Job" select is populated from the
// candidate's own real applications — not every job in the system — so a
// recruiter can't accidentally link a call to a job the candidate never applied to.
export type CandidateJobOption = { applicationId: string; jobId: string; jobTitle: string };

export type UnattributedCallRow = CallRow & {
  candidateJobs: CandidateJobOption[];
};
