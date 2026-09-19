import { createClient } from "@/lib/supabase/server";
import { getFollowUpCalendarEvents } from "@/lib/followups";
import { getInterviewCalendarEvents } from "@/lib/interviews";
import CalendarClient from "./CalendarClient";

// Server-renders the current real month's events (both helpers already scope the
// window in IST); the client component refetches /api/follow-ups/calendar and
// /api/interviews/calendar as the user navigates months. RLS scopes the
// underlying follow_ups/interviews rows, same convention as every other screen.
export default async function CalendarPage() {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const [events, interviewEvents] = await Promise.all([
    getFollowUpCalendarEvents(supabase, { year, month }),
    getInterviewCalendarEvents(supabase, { year, month }),
  ]);
  return (
    <CalendarClient initialYear={year} initialMonth={month} initialEvents={events} initialInterviewEvents={interviewEvents} />
  );
}
