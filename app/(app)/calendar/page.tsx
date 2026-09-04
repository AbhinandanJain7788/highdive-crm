import { createClient } from "@/lib/supabase/server";
import { getFollowUpCalendarEvents } from "@/lib/followups";
import CalendarClient from "./CalendarClient";

// Server-renders the current real month's events (getFollowUpCalendarEvents already
// scopes the window in IST); the client component refetches
// /api/follow-ups/calendar as the user navigates months. RLS scopes the underlying
// follow_ups rows, same convention as every other screen.
export default async function CalendarPage() {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const events = await getFollowUpCalendarEvents(supabase, { year, month });
  return <CalendarClient initialYear={year} initialMonth={month} initialEvents={events} />;
}
