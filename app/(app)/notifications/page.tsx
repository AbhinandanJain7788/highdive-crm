import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getNotificationSettings } from "@/lib/notificationSettings";
import NotificationsClient from "./NotificationsClient";

// GET /api/notification-settings is "admin" (claude.md), gated on `view_all_records`
// (the established admin-bypass marker — no dedicated permission key exists for
// notifications). The sidebar leaves this nav item ungated for any signed-in user
// (Phase 2 As-Built Notes), so a non-admin can still land here directly; render a
// permission message instead of a blank/broken form rather than letting the fetch
// silently 403.
export default async function NotificationsPage() {
  const profile = await getCurrentUserProfile();
  const canManage = profile?.permissions.includes("view_all_records") ?? false;

  if (!canManage) {
    return (
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E7E9EE",
          borderRadius: 10,
          padding: 60,
          textAlign: "center",
          fontSize: 13,
          color: "#9AA1AC",
        }}
      >
        You don&apos;t have permission to view notification settings.
      </div>
    );
  }

  const supabase = await createClient();
  const initial = await getNotificationSettings(supabase);
  return <NotificationsClient initial={initial} />;
}
