import { createClient } from "@/lib/supabase/server";
import { formatSince, getLiveStatusRows, getAgentCallTimeStats, getLatestHeartbeats } from "@/lib/team";
import TeamLiveStatusClient from "./TeamLiveStatusClient";

export default async function TeamLiveStatusPage() {
  const supabase = await createClient();
  const [rows, callTimeStats, heartbeats] = await Promise.all([
    getLiveStatusRows(supabase),
    getAgentCallTimeStats(supabase),
    getLatestHeartbeats(supabase),
  ]);

  const statsByUser = new Map(callTimeStats.map((s) => [s.userId, s]));

  const rowsWithMeta = rows.map((r) => ({
    ...r,
    sinceLabel: formatSince(r.liveStatusSince),
    callTimeStats: statsByUser.get(r.id) ?? null,
    heartbeatActive: heartbeats.get(r.id)?.isActive ?? null,
    lastHeartbeatAt: heartbeats.get(r.id)?.heartbeatAt ?? null,
  }));

  return <TeamLiveStatusClient initialRows={rowsWithMeta} />;
}
