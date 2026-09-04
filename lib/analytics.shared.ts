// Types shared by the server query module and client components — free of
// `server-only`/Supabase imports, same reason as lib/allocations.shared.ts.
import type { AnalyticsRangeKey } from "@/lib/dateRanges";
import type { BucketCount, FunnelStage } from "@/lib/pipeline";

export type { AnalyticsRangeKey } from "@/lib/dateRanges";
export type { BucketCount, FunnelStage } from "@/lib/pipeline";

export type CallTrendPoint = {
  label: string;
  outbound: number;
  inbound: number;
  total: number;
  connected: number;
  notConnected: number;
  talkMinutes: number;
};

export type CallTrends = {
  points: CallTrendPoint[];
  totalCalls: number;
  connectedTotal: number;
  notConnectedTotal: number;
  connectedPct: number;
  notConnectedPct: number;
};

export type TalkTimeTrend = {
  points: { label: string; minutes: number }[];
  totalMinutes: number;
  totalLabel: string;
  // Computed as totalMinutes / number of buckets in the period — genuinely derived
  // from the fetched calls, never a hardcoded literal (claude.md Phase 6 checkpoint).
  avgMinutes: number;
};

export type TopUserRow = { userId: string; name: string; total: number; inbound: number };

export type LoginAnalytics = {
  loginDurationLabel: string;
  wrapUpLabel: string;
  breakLabel: string;
  idleLabel: string;
};

export type AnalyticsOverall = {
  range: AnalyticsRangeKey;
  scoped: boolean;
  callTrends: CallTrends;
  talkTime: TalkTimeTrend;
  customerStages: { total: number; stages: BucketCount[] };
  conversionFunnel: FunnelStage[];
};
