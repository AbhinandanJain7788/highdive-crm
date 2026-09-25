import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getLiveStatusRows, getAgentCallTimeStats, getLatestHeartbeats } from "@/lib/team";
import type { Database } from "@/types/supabase";

type LiveStatus = Database["public"]["Enums"]["live_status"];
const LIVE_STATUSES: LiveStatus[] = ["on_call", "idle", "on_break", "offline"];

export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const trackingParam = searchParams.get("callTracking");
  const recordingParam = searchParams.get("callRecording");
  const versionParam = searchParams.get("version");

  const supabase = await createClient();
  try {
    const [rows, callTimeStats, heartbeats] = await Promise.all([
      getLiveStatusRows(supabase, {
        liveStatus: LIVE_STATUSES.includes(statusParam as LiveStatus) ? (statusParam as LiveStatus) : undefined,
        callTracking: trackingParam === "true" ? true : trackingParam === "false" ? false : undefined,
        callRecording: recordingParam === "true" ? true : recordingParam === "false" ? false : undefined,
        version: versionParam ?? undefined,
      }),
      getAgentCallTimeStats(supabase),
      getLatestHeartbeats(supabase),
    ]);

    const statsByUser = new Map(callTimeStats.map((s) => [s.userId, s]));
    const enriched = rows.map((r) => ({
      ...r,
      callTimeStats: statsByUser.get(r.id) ?? null,
      heartbeatActive: heartbeats.get(r.id)?.isActive ?? null,
      lastHeartbeatAt: heartbeats.get(r.id)?.heartbeatAt ?? null,
    }));

    return NextResponse.json({ data: enriched });
  } catch {
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load live status." } }, { status: 500 });
  }
}
