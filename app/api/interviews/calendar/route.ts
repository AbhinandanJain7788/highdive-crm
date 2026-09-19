import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getInterviewCalendarEvents } from "@/lib/interviews";

// GET /api/interviews/calendar — month grid of scheduled interviews, same
// shape/convention as GET /api/follow-ups/calendar.
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
    const events = await getInterviewCalendarEvents(supabase, { year, month });
    return NextResponse.json({ data: events });
  } catch (err) {
    console.error("GET /api/interviews/calendar failed", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to load the interview calendar." } },
      { status: 500 }
    );
  }
}
