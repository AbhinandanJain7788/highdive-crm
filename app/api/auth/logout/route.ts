import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();

  // Best-effort: backs Analytics' Login Duration widget (Phase 6) — paired with the
  // "login" row POST /api/auth/login writes. Read the user before signing out; a
  // logging failure never blocks sign-out.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("activity_logs").insert({
        actor_id: user.id,
        action: "logout",
        entity_type: "user",
        entity_id: user.id,
      });
    }
  } catch (err) {
    console.error("Failed to log logout activity", err);
  }

  await supabase.auth.signOut();
  return NextResponse.json({ data: { ok: true } });
}
