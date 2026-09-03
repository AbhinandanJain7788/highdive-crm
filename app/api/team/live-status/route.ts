import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getLiveStatusRows } from "@/lib/team";

// GET /api/team/live-status — a status board, not sensitive per-user data;
// any authenticated user can read it (RLS already allows read-all on `users`).
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const supabase = await createClient();
  try {
    const rows = await getLiveStatusRows(supabase);
    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load live status." } }, { status: 500 });
  }
}
