import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { resolveDashboardRange, pct, type DashboardRangeKey } from "@/lib/dateRanges";
import { getFollowUpBucketCounts } from "@/lib/followups";
import { getCandidateStageSnapshot } from "@/lib/pipeline";
import type { CurrentUserProfile } from "@/lib/permissions";
import type { CallBucketStats, DashboardData } from "@/lib/dashboard.shared";

export type { DashboardData, CallBucketStats } from "@/lib/dashboard.shared";
export type { DashboardRangeKey } from "@/lib/dateRanges";
export { DASHBOARD_RANGE_KEYS, isDashboardRangeKey } from "@/lib/dateRanges";

type CallDirection = Database["public"]["Enums"]["call_direction"];
type RawCall = { direction_normalized: CallDirection | null; duration_seconds: number | null };

function summarize(rows: RawCall[]): CallBucketStats {
  const total = rows.length;
  const connectedRows = rows.filter((r) => (r.duration_seconds ?? 0) > 0);
  const connected = connectedRows.length;
  const notConnected = total - connected;
  const personal = 0;
  const totalTalkSeconds = connectedRows.reduce((a, r) => a + (r.duration_seconds ?? 0), 0);
  const avgTalkSeconds = connected ? Math.round(totalTalkSeconds / connected) : 0;
  return {
    total,
    connected,
    notConnected,
    personal,
    connectedPct: pct(connected, total),
    notConnectedPct: pct(notConnected, total),
    personalPct: pct(personal, total),
    avgTalkSeconds,
    totalTalkSeconds,
  };
}

// GET /api/dashboard — Today/Y'day/Last 7 Days/Last 30 Days. `profile` decides scope:
// a `view_all_records` holder (manager/admin) sees the whole org; anyone else sees only
// calls they personally handled (resolved_agent_id) and candidates on their own
// caseload (lib/pipeline.ts's recruiterId scoping) — claude.md Phase 6: "Recruiters see
// only their own numbers." Open Actions and Candidates additionally narrow through RLS
// on the request-scoped client (v_allocations, follow_ups), the same way Allocations
// and Follow-Ups already scope themselves — not re-derived here.
export async function getDashboardData(
  supabase: SupabaseClient<Database>,
  profile: CurrentUserProfile,
  rangeKey: DashboardRangeKey
): Promise<DashboardData> {
  const { from, to } = resolveDashboardRange(rangeKey);
  const isScoped = !profile.permissions.includes("view_all_records");

  let callsQuery = supabase
    .from("calls")
    .select("direction_normalized, duration_seconds")
    .gte("call_time", from)
    .lte("call_time", to);
  if (isScoped) callsQuery = callsQuery.eq("resolved_agent_id", profile.id);

  const [callsResult, followUpCounts, allocNew, stageSnapshot] = await Promise.all([
    callsQuery.returns<RawCall[]>(),
    getFollowUpBucketCounts(supabase, {}),
    supabase.from("v_allocations").select("*", { count: "exact", head: true }).eq("bucket", "new"),
    getCandidateStageSnapshot(supabase, { from, to, recruiterId: isScoped ? profile.id : undefined }),
  ]);
  if (callsResult.error) throw callsResult.error;
  if (allocNew.error) throw allocNew.error;

  const rows = callsResult.data ?? [];
  const outbound = summarize(rows.filter((r) => r.direction_normalized === "outbound"));
  const inbound = summarize(rows.filter((r) => r.direction_normalized === "inbound"));
  const overall = summarize(rows);

  return {
    range: rangeKey,
    calls: { overall, outbound, inbound },
    openActions: {
      unassigned: allocNew.count ?? 0,
      pendingFollowUps: followUpCounts.pending,
      // Mirrors Call Logs' own Connected/Not Connected axis (duration_seconds > 0),
      // scoped to the same selected date range — Call Logs would report the identical
      // count with the same range + Not Connected filter applied there.
      missedCalls: overall.notConnected,
    },
    candidates: {
      total: stageSnapshot.total,
      stageBuckets: stageSnapshot.crmStages,
      statusList: stageSnapshot.statusBreakdown,
    },
  };
}
