"use client";

import { useState } from "react";
import {
  USER_STATUS_ALERT_KEYS,
  ALLOCATION_ASSIGNMENT_KEYS,
  type UserStatusAlertKey,
  type AllocationAssignmentKey,
  type NotificationSettingsPayload,
} from "@/lib/notificationSettings.shared";

const userStatusLabels: Record<UserStatusAlertKey, string> = {
  breakTime: "Break Time Alert",
  idleTime: "Idle Time Alert",
  inactiveUser: "Inactive User Alert",
  missedCheckIn: "Missed Check-In Alert",
};

const userStatusDescriptions: Record<UserStatusAlertKey, string> = {
  breakTime: "Notify user if he/she has been on break for more than",
  idleTime: "Notify user if he/she has been on idle for more than",
  inactiveUser: "Send an email to the user if he/she hasn't logged in for",
  missedCheckIn: "Notify user if he/she hasn't checked-in for",
};

const allocationAssignmentTitles: Record<AllocationAssignmentKey, string> = {
  api: "API",
  rechurn: "Rechurn",
  bulkUpload: "Web (Bulk Upload)",
};

const allocationAssignmentDescriptions: Record<AllocationAssignmentKey, string> = {
  api: "Notify when an allocation is assigned through APIs",
  rechurn: "Notify when an allocation is assigned through Rechurn",
  bulkUpload: "Notify when an allocation is assigned through Bulk Upload",
};

function Checkbox({ enabled }: { enabled: boolean }) {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        border: `1.6px solid ${enabled ? "#FF5C35" : "#D9DCE3"}`,
        background: enabled ? "#FFF5F2" : "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {enabled && (
        <svg width="11" height="11" viewBox="0 0 12 12">
          <path d="M2 6l3 3 5-6" fill="none" stroke="#FF5C35" strokeWidth="1.8" />
        </svg>
      )}
    </div>
  );
}

export default function NotificationsClient({ initial }: { initial: NotificationSettingsPayload }) {
  const [state, setState] = useState<NotificationSettingsPayload>(initial);
  const [saving, setSaving] = useState<string | null>(null);

  async function persist(patch: Partial<NotificationSettingsPayload>) {
    setSaving("saving");
    try {
      const res = await fetch("/api/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (res.ok) {
        setState(json.data);
        setSaving("saved");
        setTimeout(() => setSaving(null), 1200);
      } else {
        setSaving(null);
      }
    } catch {
      setSaving(null);
    }
  }

  function toggleUserStatusAlert(key: UserStatusAlertKey) {
    const next = { ...state, userStatusAlerts: { ...state.userStatusAlerts, [key]: { ...state.userStatusAlerts[key], enabled: !state.userStatusAlerts[key].enabled } } };
    setState(next);
    persist({ userStatusAlerts: { [key]: next.userStatusAlerts[key] } as NotificationSettingsPayload["userStatusAlerts"] });
  }

  function changeUserStatusAlertValue(key: UserStatusAlertKey, value: string) {
    const num = Number(value);
    const next = { ...state, userStatusAlerts: { ...state.userStatusAlerts, [key]: { ...state.userStatusAlerts[key], value: Number.isFinite(num) ? num : 0 } } };
    setState(next);
    persist({ userStatusAlerts: { [key]: next.userStatusAlerts[key] } as NotificationSettingsPayload["userStatusAlerts"] });
  }

  function changeUserStatusAlertUnit(key: UserStatusAlertKey, unit: string) {
    const next = { ...state, userStatusAlerts: { ...state.userStatusAlerts, [key]: { ...state.userStatusAlerts[key], unit: unit as "Hours" | "Minutes" } } };
    setState(next);
    persist({ userStatusAlerts: { [key]: next.userStatusAlerts[key] } as NotificationSettingsPayload["userStatusAlerts"] });
  }

  function toggleAllocationAlert(key: AllocationAssignmentKey) {
    const next = { ...state, allocationAlerts: { ...state.allocationAlerts, [key]: !state.allocationAlerts[key] } };
    setState(next);
    persist({ allocationAlerts: { [key]: next.allocationAlerts[key] } as NotificationSettingsPayload["allocationAlerts"] });
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E7E9EE",
        borderRadius: 10,
        padding: "30px 36px",
        maxWidth: 820,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>Notifications</div>
        {saving && (
          <div style={{ fontSize: 12, color: saving === "saved" ? "#1E7F43" : "#9AA1AC" }}>
            {saving === "saved" ? "Saved" : "Saving..."}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#4B5565", letterSpacing: 0.5, marginBottom: 16 }}>
        USER STATUS
      </div>
      {USER_STATUS_ALERT_KEYS.map((key) => {
        const al = state.userStatusAlerts[key];
        return (
          <div key={key} style={{ marginBottom: 22 }}>
            <div
              onClick={() => toggleUserStatusAlert(key)}
              style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 10 }}
            >
              <Checkbox enabled={al.enabled} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>{userStatusLabels[key]}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 30, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#4B5565" }}>{userStatusDescriptions[key]}</span>
              <input
                type="number"
                value={al.value}
                onChange={(e) => changeUserStatusAlertValue(key, e.target.value)}
                style={{ width: 52, padding: "8px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 13, color: "#1D2433" }}
              />
              <select
                value={al.unit}
                onChange={(e) => changeUserStatusAlertUnit(key, e.target.value)}
                style={{ padding: "8px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 13, color: "#1D2433", background: "#FFFFFF", minWidth: 96 }}
              >
                <option value="Hours">Hours</option>
                <option value="Minutes">Minutes</option>
              </select>
            </div>
          </div>
        );
      })}

      <div style={{ borderTop: "1px solid #EEF0F4", margin: "6px 0 20px" }} />

      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#4B5565", letterSpacing: 0.5, marginBottom: 16 }}>
        ALLOCATION ASSIGNMENT
      </div>
      {ALLOCATION_ASSIGNMENT_KEYS.map((key) => {
        const enabled = state.allocationAlerts[key];
        return (
          <div key={key} style={{ marginBottom: 18 }}>
            <div
              onClick={() => toggleAllocationAlert(key)}
              style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 6 }}
            >
              <Checkbox enabled={enabled} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>{allocationAssignmentTitles[key]}</span>
            </div>
            <div style={{ fontSize: 13, color: "#4B5565", paddingLeft: 30 }}>{allocationAssignmentDescriptions[key]}</div>
          </div>
        );
      })}
    </div>
  );
}
