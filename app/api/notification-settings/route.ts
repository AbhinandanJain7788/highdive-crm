import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/notificationSettings";
import { USER_STATUS_ALERT_KEYS, ALLOCATION_ASSIGNMENT_KEYS } from "@/lib/notificationSettings.shared";
import type { NotificationSettingsPayload } from "@/lib/notificationSettings.shared";

// GET/PATCH /api/notification-settings — "admin" per claude.md. There's no dedicated
// `manage_notifications` key in the 18-key catalogue, so this uses `view_all_records`
// as the admin-bypass marker, same convention Phase 3/4 used for /api/recruiters and
// /api/data/transfer.
export async function GET() {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const supabase = await createClient();
  try {
    const data = await getNotificationSettings(supabase);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/notification-settings failed", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to load notification settings." } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const guard = await requirePermission("view_all_records");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid request body." } }, { status: 400 });
  }

  const patch: Partial<NotificationSettingsPayload> = {};
  if (body.userStatusAlerts && typeof body.userStatusAlerts === "object") {
    const alerts: Partial<NotificationSettingsPayload["userStatusAlerts"]> = {};
    for (const key of USER_STATUS_ALERT_KEYS) {
      const v = body.userStatusAlerts[key];
      if (!v || typeof v !== "object") continue;
      if (typeof v.enabled !== "boolean" || typeof v.value !== "number" || (v.unit !== "Hours" && v.unit !== "Minutes")) {
        return NextResponse.json(
          { error: { code: "bad_request", message: `Invalid userStatusAlerts.${key}.` } },
          { status: 400 }
        );
      }
      alerts[key] = { enabled: v.enabled, value: v.value, unit: v.unit };
    }
    patch.userStatusAlerts = alerts as NotificationSettingsPayload["userStatusAlerts"];
  }
  if (body.allocationAlerts && typeof body.allocationAlerts === "object") {
    const alerts: Partial<NotificationSettingsPayload["allocationAlerts"]> = {};
    for (const key of ALLOCATION_ASSIGNMENT_KEYS) {
      const v = body.allocationAlerts[key];
      if (typeof v !== "boolean") continue;
      alerts[key] = v;
    }
    patch.allocationAlerts = alerts as NotificationSettingsPayload["allocationAlerts"];
  }

  const supabase = await createClient();
  try {
    const data = await updateNotificationSettings(supabase, patch);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("PATCH /api/notification-settings failed", err);
    return NextResponse.json(
      { error: { code: "server_error", message: "Failed to update notification settings." } },
      { status: 500 }
    );
  }
}
