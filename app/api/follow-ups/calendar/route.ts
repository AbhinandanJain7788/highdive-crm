import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getFollowUpCalendarEvents } from "@/lib/followups";

// GET /api/follow-ups/calendar — month grid + per-day events (claude.md API
// structure). Returns every follow-up due within the requested month (any status);
// the client groups them by day and renders done/pending accordingly, mirroring
// the signed-off Calendar screen's own grouping logic.
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getUTCFullYear();
  const month = Number(searchParams.get("month")) || now.getUTCMonth() + 1;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: { code: "bad_request", message: "year and month (1-12) are required." } }, { status: 400 });
  }

  const supabase = await createClient();
  try {
    const events = await getFollowUpCalendarEvents(supabase, { year, month });
    return NextResponse.json({ data: events });
  } catch (err) {
    console.error("GET /api/follow-ups/calendar failed", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to load the follow-up calendar." } },
      { status: 500 }
    );
  }
}
