import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getLiveStatusRows } from "@/lib/team";
import type { Database } from "@/types/supabase";

type LiveStatus = Database["public"]["Enums"]["live_status"];
const LIVE_STATUSES: LiveStatus[] = ["on_call", "idle", "on_break", "offline"];

// GET /api/team/live-status — a status board, not sensitive per-user data;
// any authenticated user can read it (RLS already allows read-all on `users`).
// Status/Call Tracking/Call Recording/Version filters were previously decorative
// (Phase 9 finding) — now real query params against real columns.
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
    const rows = await getLiveStatusRows(supabase, {
      liveStatus: LIVE_STATUSES.includes(statusParam as LiveStatus) ? (statusParam as LiveStatus) : undefined,
      callTracking: trackingParam === "true" ? true : trackingParam === "false" ? false : undefined,
      callRecording: recordingParam === "true" ? true : recordingParam === "false" ? false : undefined,
      version: versionParam ?? undefined,
    });
    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load live status." } }, { status: 500 });
  }
}
