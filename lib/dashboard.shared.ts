// Types shared by the server query module and client components — free of
// `server-only`/Supabase imports, same reason as lib/allocations.shared.ts.
import type { DashboardRangeKey } from "@/lib/dateRanges";
import type { BucketCount } from "@/lib/pipeline";

export type { DashboardRangeKey } from "@/lib/dateRanges";
export type { BucketCount } from "@/lib/pipeline";

export type CallBucketStats = {
  total: number;
  connected: number;
  notConnected: number;
  // Always 0 — no schema axis distinguishes a "personal" call from a work call
  // (claude.md Phase 6 As-Built Notes). Kept as a field so the UI's existing
  // three-tile layout (Connected / Not Connected / Personal) still renders.
  personal: number;
  connectedPct: number;
  notConnectedPct: number;
  personalPct: number;
  avgTalkSeconds: number;
  totalTalkSeconds: number;
};

export type DashboardData = {
  range: DashboardRangeKey;
  calls: { overall: CallBucketStats; outbound: CallBucketStats; inbound: CallBucketStats };
  openActions: { unassigned: number; pendingFollowUps: number; missedCalls: number };
  candidates: { total: number; stageBuckets: BucketCount[]; statusList: BucketCount[] };
};
