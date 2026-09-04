import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getDefaultPipelineFunnel } from "@/lib/pipeline";
import { recruiterRoleFilter } from "@/lib/recruiters";
import { callDispositionStyles } from "@/lib/mock/styles";
import { pct } from "@/lib/dateRanges";
import type { ReportsData, DispositionCount, RecruiterCallStats } from "@/lib/reports.shared";

export type { ReportsData, DispositionCount, RecruiterCallStats } from "@/lib/reports.shared";

type CallDisposition = Database["public"]["Enums"]["call_disposition"];
type RawCall = {
  resolved_agent_id: string | null;
  duration_seconds: number | null;
  disposition: CallDisposition | null;
  application_id: string | null;
  candidate: { deleted_at: string | null } | null;
};

const DISPOSITION_ORDER: CallDisposition[] = ["interested", "callback_later", "not_reachable"];

// GET /api/reports — Pipeline Funnel, Call Outcomes (per disposition), Calls by
// Recruiter. No date-range control on this screen in the signed-off HTML, so it's
// unscoped (all-time, org-wide) — an audit-style screen, unlike Dashboard/Analytics.
export async function getReportsData(supabase: SupabaseClient<Database>): Promise<ReportsData> {
  const [pipelineFunnel, callsResult, recruiterIds] = await Promise.all([
    getDefaultPipelineFunnel(supabase),
    supabase
      .from("calls")
      .select("resolved_agent_id, duration_seconds, disposition, application_id, candidate:candidates(deleted_at)")
      .returns<RawCall[]>(),
    recruiterRoleFilter(supabase),
  ]);
  if (callsResult.error) throw callsResult.error;

  // claude.md: exclude soft-deleted candidates from every Reports figure (same
  // convention Phase 4 applied to the derived views). A call with no candidate_id at
  // all (a still-raw Android row) has nothing to exclude and is kept.
  const calls = (callsResult.data ?? []).filter((c) => !c.candidate || c.candidate.deleted_at === null);
  const unattributedCallCount = calls.filter((c) => c.application_id === null).length;

  const dispositionCounts = new Map<string, number>();
  let unsetCount = 0;
  for (const c of calls) {
    if (!c.disposition) {
      unsetCount += 1;
      continue;
    }
    dispositionCounts.set(c.disposition, (dispositionCounts.get(c.disposition) ?? 0) + 1);
  }
  const totalForPct = calls.length;
  const callOutcomes: DispositionCount[] = DISPOSITION_ORDER.map((d) => {
    const count = dispositionCounts.get(d) ?? 0;
    return { key: d, label: callDispositionStyles[d].label, count, pct: pct(count, totalForPct) };
  });
  if (unsetCount > 0) {
    callOutcomes.push({ key: "not_set", label: "Not Set", count: unsetCount, pct: pct(unsetCount, totalForPct) });
  }

  // "Recruiter" here matches /recruiters' own definition (an active user without
  // view_all_records) rather than the source HTML's own hardcoded 6-person cast
  // (ui-gaps.md item 19) — reusing lib/recruiters.ts's role filter keeps this report
  // consistent with the Recruiters directory instead of introducing a third
  // definition of "who counts as a recruiter."
  let usersQuery = supabase.from("users").select("id, name").eq("status", "active");
  if (recruiterIds.length) usersQuery = usersQuery.or(`role_id.is.null,role_id.not.in.(${recruiterIds.join(",")})`);
  const { data: recruiterUsers, error: usersErr } = await usersQuery
    .order("name", { ascending: true })
    .returns<{ id: string; name: string }[]>();
  if (usersErr) throw usersErr;

  const callsByRecruiter: RecruiterCallStats[] = (recruiterUsers ?? []).map((r) => {
    const rCalls = calls.filter((c) => c.resolved_agent_id === r.id);
    const connectedCalls = rCalls.filter((c) => (c.duration_seconds ?? 0) > 0);
    const avgDurationSeconds = connectedCalls.length
      ? Math.round(connectedCalls.reduce((a, c) => a + (c.duration_seconds ?? 0), 0) / connectedCalls.length)
      : 0;
    return {
      recruiterId: r.id,
      name: r.name,
      total: rCalls.length,
      connected: connectedCalls.length,
      avgDurationSeconds,
    };
  });

  return { pipelineFunnel, callOutcomes, callsByRecruiter, unattributedCallCount };
}
