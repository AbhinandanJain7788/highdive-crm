import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getAnalyticsOverall, getTopUserPerformances, getLoginAnalytics } from "@/lib/analytics";
import AnalyticsClient from "./AnalyticsClient";

// Server-renders the "Today" tab; the client component refetches through
// /api/analytics/* as the range/tab changes. Gated the same way the route handlers
// are (view_analytics) — redirect to /login if unauthenticated; an authenticated user
// lacking the permission still reaches this page (Sidebar hides the nav item, but a
// direct visit isn't itself a security boundary) and simply gets 403s from the API,
// same pattern the rest of this app's permission-gated pages use.
export default async function AnalyticsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [overall, topUsers, login] = await Promise.all([
    getAnalyticsOverall(supabase, profile, "today"),
    getTopUserPerformances(supabase, profile, "today"),
    getLoginAnalytics(profile, "today"),
  ]);

  return <AnalyticsClient initialOverall={overall} initialTopUsers={topUsers} initialLogin={login} />;
}
