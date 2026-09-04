import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import { buildChartBuckets, resolveAnalyticsRange, pct, type AnalyticsRangeKey } from "@/lib/dateRanges";
import { getCandidateStageSnapshot, getDefaultPipelineFunnel } from "@/lib/pipeline";
import type { CurrentUserProfile } from "@/lib/permissions";
import type { AnalyticsOverall, CallTrends, TalkTimeTrend, TopUserRow, LoginAnalytics } from "@/lib/analytics.shared";

export type { AnalyticsOverall, CallTrends, TalkTimeTrend, TopUserRow, LoginAnalytics } from "@/lib/analytics.shared";
export type { AnalyticsRangeKey } from "@/lib/dateRanges";
export { ANALYTICS_RANGE_KEYS, isAnalyticsRangeKey } from "@/lib/dateRanges";

type CallDirection = Database["public"]["Enums"]["call_direction"];
type RawCall = {
  direction_normalized: CallDirection | null;
  duration_seconds: number | null;
  call_time: string;
  resolved_agent_id: string | null;
};

function isRecruiterScoped(profile: CurrentUserProfile): boolean {
  return !profile.permissions.includes("view_all_records");
}

async function fetchCallsInRange(
  supabase: SupabaseClient<Database>,
  options: { from: string; to: string; recruiterId?: string }
): Promise<RawCall[]> {
  let query = supabase
    .from("calls")
    .select("direction_normalized, duration_seconds, call_time, resolved_agent_id")
    .gte("call_time", options.from)
    .lte("call_time", options.to);
  if (options.recruiterId) query = query.eq("resolved_agent_id", options.recruiterId);
  const { data, error } = await query.returns<RawCall[]>();
  if (error) throw error;
  return data ?? [];
}

function fmtMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Call Trends + Total Talk Time chart, bucketed hourly (Today) or daily (Last 7/30
// Days) — claude.md Phase 6 checkpoint: "Call Trends totals match GET /api/calls for
// the same range" and "the average reference line ... is computed, not hardcoded."
async function getCallTrendsAndTalkTime(
  supabase: SupabaseClient<Database>,
  profile: CurrentUserProfile,
  rangeKey: AnalyticsRangeKey
): Promise<{ callTrends: CallTrends; talkTime: TalkTimeTrend }> {
  const { from, to } = resolveAnalyticsRange(rangeKey);
  const scoped = isRecruiterScoped(profile);
  const rows = await fetchCallsInRange(supabase, { from, to, recruiterId: scoped ? profile.id : undefined });
  const buckets = buildChartBuckets(rangeKey);

  const points = buckets.map((b) => {
    const bFrom = new Date(b.from).getTime();
    const bTo = new Date(b.to).getTime();
    const inBucket = rows.filter((r) => {
      const t = new Date(r.call_time).getTime();
      return t >= bFrom && t <= bTo;
    });
    const outbound = inBucket.filter((r) => r.direction_normalized === "outbound").length;
    const inbound = inBucket.filter((r) => r.direction_normalized === "inbound").length;
    const connected = inBucket.filter((r) => (r.duration_seconds ?? 0) > 0).length;
    const talkSeconds = inBucket
      .filter((r) => (r.duration_seconds ?? 0) > 0)
      .reduce((a, r) => a + (r.duration_seconds ?? 0), 0);
    return {
      label: b.label,
      outbound,
      inbound,
      total: inBucket.length,
      connected,
      notConnected: inBucket.length - connected,
      talkMinutes: Math.round((talkSeconds / 60) * 10) / 10,
    };
  });

  const totalCalls = rows.length;
  const connectedTotal = rows.filter((r) => (r.duration_seconds ?? 0) > 0).length;
  const notConnectedTotal = totalCalls - connectedTotal;
  const totalTalkSeconds = rows
    .filter((r) => (r.duration_seconds ?? 0) > 0)
    .reduce((a, r) => a + (r.duration_seconds ?? 0), 0);
  const totalMinutes = Math.round((totalTalkSeconds / 60) * 10) / 10;
  const avgMinutes = points.length ? Math.round((totalMinutes / points.length) * 10) / 10 : 0;

  return {
    callTrends: {
      points,
      totalCalls,
      connectedTotal,
      notConnectedTotal,
      connectedPct: pct(connectedTotal, totalCalls),
      notConnectedPct: pct(notConnectedTotal, totalCalls),
    },
    talkTime: {
      points: points.map((p) => ({ label: p.label, minutes: p.talkMinutes })),
      totalMinutes,
      totalLabel: fmtMinutes(totalMinutes),
      avgMinutes,
    },
  };
}

// GET /api/analytics/overall
export async function getAnalyticsOverall(
  supabase: SupabaseClient<Database>,
  profile: CurrentUserProfile,
  rangeKey: AnalyticsRangeKey
): Promise<AnalyticsOverall> {
  const { from, to } = resolveAnalyticsRange(rangeKey);
  const scoped = isRecruiterScoped(profile);
  const recruiterId = scoped ? profile.id : undefined;

  const [{ callTrends, talkTime }, stageSnapshot, funnel] = await Promise.all([
    getCallTrendsAndTalkTime(supabase, profile, rangeKey),
    getCandidateStageSnapshot(supabase, { from, to, recruiterId }),
    getDefaultPipelineFunnel(supabase, { from, to, recruiterId }),
  ]);

  return {
    range: rangeKey,
    scoped,
    callTrends,
    talkTime,
    customerStages: { total: stageSnapshot.total, stages: stageSnapshot.crmStages },
    conversionFunnel: funnel,
  };
}

// GET /api/analytics/top-users — Top 5, ordered by total calls then inbound calls.
// A recruiter-scoped caller only ever has their own calls to group (fetchCallsInRange
// already filters to resolved_agent_id = self), so the list is at most one row —
// correct per claude.md Phase 6: "Recruiters see only their own numbers."
export async function getTopUserPerformances(
  supabase: SupabaseClient<Database>,
  profile: CurrentUserProfile,
  rangeKey: AnalyticsRangeKey
): Promise<TopUserRow[]> {
  const { from, to } = resolveAnalyticsRange(rangeKey);
  const scoped = isRecruiterScoped(profile);
  const rows = await fetchCallsInRange(supabase, { from, to, recruiterId: scoped ? profile.id : undefined });

  const byAgent = new Map<string, { total: number; inbound: number }>();
  for (const r of rows) {
    if (!r.resolved_agent_id) continue;
    const cur = byAgent.get(r.resolved_agent_id) ?? { total: 0, inbound: 0 };
    cur.total += 1;
    if (r.direction_normalized === "inbound") cur.inbound += 1;
    byAgent.set(r.resolved_agent_id, cur);
  }
  const ids = [...byAgent.keys()];
  if (!ids.length) return [];

  const { data: users, error } = await supabase.from("users").select("id, name").in("id", ids);
  if (error) throw error;
  const nameById = new Map((users ?? []).map((u) => [u.id, u.name]));

  return ids
    .map((id) => ({ userId: id, name: nameById.get(id) ?? "Unknown", ...(byAgent.get(id) as { total: number; inbound: number }) }))
    .sort((a, b) => b.total - a.total || b.inbound - a.inbound)
    .slice(0, 5);
}

// GET /api/analytics/login — Login Duration is computed for real from paired
// login/logout `activity_logs` rows (POST /api/auth/login and /api/auth/logout each
// write one, added in this phase specifically to back this widget). It's always the
// CURRENT user's own duration, admin or recruiter — the source HTML renders it as a
// single personal value, not an org list, so there's no "own vs org-wide" branch here
// the way the other widgets have one.
//
// Wrap up Time / Break Time / Idle Time stay a genuine "--": nothing in this schema
// logs a history of live_status transitions (users.live_status/live_status_since only
// holds the *current* state, not a timeline), so there is no real duration to compute
// for them — same "honest placeholder, not a fabricated number" reasoning as Q2's AI
// stub.
//
// Reads via the service-role client rather than the request-scoped one: activity_logs'
// RLS is insert-own/admin-only-read (Phase 2 As-Built Notes), which would silently
// return zero rows for a recruiter reading their *own* login history. The query below
// is always hard-filtered to `actor_id = profile.id` before it runs, so bypassing RLS
// here can never expose anyone else's rows — it only unblocks a user reading their own.
export async function getLoginAnalytics(
  profile: CurrentUserProfile,
  rangeKey: AnalyticsRangeKey
): Promise<LoginAnalytics> {
  const { from, to } = resolveAnalyticsRange(rangeKey);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("activity_logs")
    .select("action, created_at")
    .eq("actor_id", profile.id)
    .in("action", ["login", "logout"])
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: true })
    .returns<{ action: string; created_at: string }[]>();
  if (error) throw error;

  let totalMs = 0;
  let openLoginAt: string | null = null;
  for (const e of data ?? []) {
    if (e.action === "login") openLoginAt = e.created_at;
    else if (e.action === "logout" && openLoginAt) {
      totalMs += new Date(e.created_at).getTime() - new Date(openLoginAt).getTime();
      openLoginAt = null;
    }
  }
  // A still-open session counts up to the range's own upper bound, not "now" — keeps a
  // fixed date range's answer stable across repeated polls within the same range.
  if (openLoginAt) {
    const upper = Math.min(Date.now(), new Date(to).getTime());
    totalMs += Math.max(0, upper - new Date(openLoginAt).getTime());
  }

  const totalMinutes = Math.round(totalMs / 60000);
  return {
    loginDurationLabel: totalMinutes > 0 ? fmtMinutes(totalMinutes) : "--",
    wrapUpLabel: "--",
    breakLabel: "--",
    idleLabel: "--",
  };
}
