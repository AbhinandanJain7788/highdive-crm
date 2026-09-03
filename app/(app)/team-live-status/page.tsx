import { createClient } from "@/lib/supabase/server";
import { formatSince, getLiveStatusRows } from "@/lib/team";
import TeamLiveStatusClient from "./TeamLiveStatusClient";

export default async function TeamLiveStatusPage() {
  const supabase = await createClient();
  const rows = await getLiveStatusRows(supabase);

  // `formatSince` computes a relative duration from `live_status_since` — done
  // server-side, at fetch time, so the client component stays free of the
  // "server-only" lib/team import.
  const rowsWithSince = rows.map((r) => ({ ...r, sinceLabel: formatSince(r.liveStatusSince) }));

  return <TeamLiveStatusClient initialRows={rowsWithSince} />;
}
