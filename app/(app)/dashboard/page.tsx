import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getDashboardData } from "@/lib/dashboard";
import DashboardClient from "./DashboardClient";

// Server-renders the "Today" tab; the client component refetches through
// /api/dashboard as the range tab changes. Scope (own vs org-wide) is resolved inside
// getDashboardData from the signed-in profile's permissions — Dashboard itself has no
// permission gate (claude.md Phase 2 As-Built Notes: left ungated for any signed-in
// user).
export default async function DashboardPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const initialData = await getDashboardData(supabase, profile, "today");

  return <DashboardClient initialData={initialData} />;
}
