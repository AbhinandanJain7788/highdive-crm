// Types shared by the server query module and client components — free of
// `server-only`/Supabase imports, same reason as lib/allocations.shared.ts.
import type { FunnelStage } from "@/lib/pipeline";

export type { FunnelStage } from "@/lib/pipeline";

export type DispositionCount = { key: string; label: string; count: number; pct: number };

export type RecruiterCallStats = {
  recruiterId: string;
  name: string;
  total: number;
  connected: number;
  // Average over connected (duration_seconds > 0) calls only — a not-connected call
  // has no talk time to average in, so including its 0 would understate the figure
  // (claude.md Phase 6 checkpoint: "Avg duration excludes zero-duration calls, or
  // states that it includes them" — this report excludes them).
  avgDurationSeconds: number;
};

export type ReportsData = {
  pipelineFunnel: FunnelStage[];
  callOutcomes: DispositionCount[];
  callsByRecruiter: RecruiterCallStats[];
  // Calls with a null application_id (Phase 5's unattributed queue). Neither
  // callOutcomes (grouped by disposition) nor callsByRecruiter (grouped by agent)
  // is a per-job figure, so an unattributed call isn't excluded from either — it has
  // a real disposition and a real recruiter regardless of whether it's linked to a
  // job yet. This screen has no per-job breakdown at all (matching the signed-off
  // HTML), so there's nothing here for an unattributed call to silently skew; this
  // count is surfaced purely for transparency, matching Call Logs' own Unattributed
  // tab count.
  unattributedCallCount: number;
};
