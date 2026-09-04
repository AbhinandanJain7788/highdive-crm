import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  USER_STATUS_ALERT_KEYS,
  ALLOCATION_ASSIGNMENT_KEYS,
  USER_STATUS_ALERT_DEFAULTS,
  ALLOCATION_ASSIGNMENT_DEFAULTS,
  type NotificationSettingsPayload,
  type ThresholdUnit,
} from "@/lib/notificationSettings.shared";

type Row = Database["public"]["Tables"]["notification_settings"]["Row"];

const unitToDb = (u: "Hours" | "Minutes"): ThresholdUnit => (u === "Hours" ? "hours" : "minutes");
const unitFromDb = (u: ThresholdUnit | null): "Hours" | "Minutes" => (u === "minutes" ? "Minutes" : "Hours");

// The Notifications screen is a single org-wide config form (no per-user selector in
// the signed-off HTML), so this always reads/writes the org-default rows
// (user_id IS NULL) — claude.md marks the whole route "admin", which matches.
export async function getNotificationSettings(
  supabase: SupabaseClient<Database>
): Promise<NotificationSettingsPayload> {
  const { data, error } = await supabase
    .from("notification_settings")
    .select("key, enabled, threshold_value, threshold_unit")
    .is("user_id", null);
  if (error) throw error;

  const byKey = new Map((data ?? []).map((r) => [r.key, r]));

  const userStatusAlerts = {} as NotificationSettingsPayload["userStatusAlerts"];
  for (const key of USER_STATUS_ALERT_KEYS) {
    const row = byKey.get(key);
    userStatusAlerts[key] = row
      ? { enabled: row.enabled, value: row.threshold_value ?? USER_STATUS_ALERT_DEFAULTS[key].value, unit: unitFromDb(row.threshold_unit) }
      : { ...USER_STATUS_ALERT_DEFAULTS[key] };
  }

  const allocationAlerts = {} as NotificationSettingsPayload["allocationAlerts"];
  for (const key of ALLOCATION_ASSIGNMENT_KEYS) {
    const row = byKey.get(key);
    allocationAlerts[key] = row ? row.enabled : ALLOCATION_ASSIGNMENT_DEFAULTS[key];
  }

  return { userStatusAlerts, allocationAlerts };
}

// Upserts by hand rather than .upsert({onConflict:"key"}) — the org-default rows'
// uniqueness lives on a partial index (`key WHERE user_id IS NULL`, migration 0030)
// since a plain UNIQUE(user_id, key) treats every NULL as distinct, and PostgREST's
// upsert can't target a partial index as its conflict source.
async function upsertOrgDefault(
  supabase: SupabaseClient<Database>,
  key: string,
  fields: Pick<Row, "enabled" | "threshold_value" | "threshold_unit">
): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from("notification_settings")
    .select("id")
    .is("user_id", null)
    .eq("key", key)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error } = await supabase.from("notification_settings").update(fields).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("notification_settings").insert({ user_id: null, key, ...fields });
    if (error) throw error;
  }
}

export async function updateNotificationSettings(
  supabase: SupabaseClient<Database>,
  patch: Partial<NotificationSettingsPayload>
): Promise<NotificationSettingsPayload> {
  if (patch.userStatusAlerts) {
    for (const key of USER_STATUS_ALERT_KEYS) {
      const alert = patch.userStatusAlerts[key];
      if (!alert) continue;
      await upsertOrgDefault(supabase, key, {
        enabled: alert.enabled,
        threshold_value: alert.value,
        threshold_unit: unitToDb(alert.unit),
      });
    }
  }
  if (patch.allocationAlerts) {
    for (const key of ALLOCATION_ASSIGNMENT_KEYS) {
      const enabled = patch.allocationAlerts[key];
      if (enabled === undefined) continue;
      await upsertOrgDefault(supabase, key, { enabled, threshold_value: null, threshold_unit: null });
    }
  }
  return getNotificationSettings(supabase);
}
