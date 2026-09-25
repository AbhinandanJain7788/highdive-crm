import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";

// POST /api/agent-heartbeats — agent sends their activity heartbeat.
// Authenticated users can only send for themselves.
export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const isActive = body?.is_active;
  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: { code: "bad_request", message: "is_active (boolean) is required." } }, { status: 400 });
  }

  const currentCallId = typeof body?.current_call_id === "string" ? body.current_call_id : null;

  const supabase = await createClient();
  const { error } = await supabase.from("agent_heartbeats").insert({
    user_id: profile.id,
    is_active: isActive,
    current_call_id: currentCallId,
  });

  if (error) {
    return NextResponse.json({ error: { code: "server_error", message: error.message } }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
