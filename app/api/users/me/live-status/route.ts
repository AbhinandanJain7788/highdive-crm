import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import type { Database } from "@/types/supabase";

type LiveStatus = Database["public"]["Enums"]["live_status"];
const VALID_STATUSES: LiveStatus[] = ["on_call", "idle", "on_break", "offline"];

// PATCH /api/users/me/live-status — self-service: the signed-in user sets
// their own live status. No permission key required beyond being signed in —
// RLS's `id = auth.uid()` self-update policy on `users` already allows this,
// so this route only needs a 401 guard, not requirePermission().
// `live_status_since` is bumped to now() server-side, but only when the
// status value is actually changing.
export async function PATCH(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const liveStatus = body?.liveStatus;
  if (typeof liveStatus !== "string" || !VALID_STATUSES.includes(liveStatus as LiveStatus)) {
    return NextResponse.json(
      { error: { code: "bad_request", message: `liveStatus must be one of: ${VALID_STATUSES.join(", ")}` } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("users")
    .select("live_status")
    .eq("id", profile.id)
    .single();
  if (readError) {
    return NextResponse.json({ error: { code: "server_error", message: readError.message } }, { status: 500 });
  }

  const update: { live_status: LiveStatus; live_status_since?: string } = {
    live_status: liveStatus as LiveStatus,
  };
  if (current.live_status !== liveStatus) {
    update.live_status_since = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("users")
    .update(update)
    .eq("id", profile.id)
    .select("id, live_status, live_status_since")
    .single();

  if (error) {
    return NextResponse.json({ error: { code: "server_error", message: error.message } }, { status: 500 });
  }
  return NextResponse.json({ data });
}
