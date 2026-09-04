import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getGeneralSettings, getCompanyDetails, getActivityLogs } from "@/lib/settings";
import SettingsClient from "./SettingsClient";

// The decoded prototype defines a second, unreachable "Settings" view (isSettings /
// goSettings — a Pipeline Template editor + User Management/Invite panel) that no nav
// element or button anywhere in the template ever triggers. The only reachable Settings
// screen is `isAdminSettings` (wired to the sidebar's "Settings" item via goAdminSettings),
// which is what this page reproduces. See ui-gaps-batch-c.md.
//
// General/Company Details/Activity Logs are "admin" per claude.md (gated on
// `view_all_records`, no dedicated permission key exists); Account (password reset)
// is "any" signed-in user. The sidebar leaves Settings ungated, so a non-admin can
// still land here — General/Company/Activity Logs render a permission notice instead
// of a blank/broken form, while Account still works for everyone.
export default async function SettingsPage() {
  const profile = await getCurrentUserProfile();
  const canManage = profile?.permissions.includes("view_all_records") ?? false;

  if (!canManage) {
    return <SettingsClient canManage={false} general={null} company={null} activityLogs={null} />;
  }

  const supabase = await createClient();
  const [general, company, activityLogs] = await Promise.all([
    getGeneralSettings(supabase),
    getCompanyDetails(supabase),
    getActivityLogs(supabase, { page: 1, pageSize: 25 }),
  ]);

  return <SettingsClient canManage general={general} company={company} activityLogs={activityLogs} />;
}
