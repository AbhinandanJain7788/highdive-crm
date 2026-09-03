"use client";

import { useState } from "react";
import {
  userStatusAlertsSeed,
  allocationAssignmentSeed,
  type UserStatusAlertKey,
} from "@/lib/mock";

// The mock seed only carries a `label` (used as the alert title) plus the toggle state.
// The sentence that precedes the value/unit inputs isn't part of the mock data shape, so it
// is reproduced here verbatim from the source template (see ui-gaps-batch-c.md).
const userStatusDescriptions: Record<UserStatusAlertKey, string> = {
  breakTime: "Notify user if he/she has been on break for more than",
  idleTime: "Notify user if he/she has been on idle for more than",
  inactiveUser: "Send an email to the user if he/she hasn't logged in for",
  missedCheckIn: "Notify user if he/she hasn't checked-in for",
};

type AllocationAssignmentKey = keyof typeof allocationAssignmentSeed;

// Same gap for the allocation-assignment toggles: the mock's `label` is the description
// sentence, but the source also shows a short title above it. Reproduced verbatim here.
const allocationAssignmentTitles: Record<AllocationAssignmentKey, string> = {
  api: "API",
  rechurn: "Rechurn",
  bulkUpload: "Web (Bulk Upload)",
};

type AlertState = { enabled: boolean; value: number; unit: "Hours" | "Minutes" };

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

export default function NotificationsPage() {
  const [userStatusAlerts, setUserStatusAlerts] = useState<Record<UserStatusAlertKey, AlertState>>(
    () => {
      const initial = {} as Record<UserStatusAlertKey, AlertState>;
      (Object.keys(userStatusAlertsSeed) as UserStatusAlertKey[]).forEach((key) => {
        const seed = userStatusAlertsSeed[key];
        initial[key] = { enabled: seed.enabled, value: seed.value, unit: seed.unit };
      });
      return initial;
    }
  );

  const [allocationAlerts, setAllocationAlerts] = useState<Record<AllocationAssignmentKey, boolean>>(
    () => {
      const initial = {} as Record<AllocationAssignmentKey, boolean>;
      (Object.keys(allocationAssignmentSeed) as AllocationAssignmentKey[]).forEach((key) => {
        initial[key] = allocationAssignmentSeed[key].enabled;
      });
      return initial;
    }
  );

  const toggleUserStatusAlert = (key: UserStatusAlertKey) => {
    setUserStatusAlerts((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !prev[key].enabled } }));
  };
  const changeUserStatusAlertValue = (key: UserStatusAlertKey, value: string) => {
    setUserStatusAlerts((prev) => ({ ...prev, [key]: { ...prev[key], value: Number(value) } }));
  };
  const changeUserStatusAlertUnit = (key: UserStatusAlertKey, unit: string) => {
    setUserStatusAlerts((prev) => ({
      ...prev,
      [key]: { ...prev[key], unit: unit as "Hours" | "Minutes" },
    }));
  };
  const toggleAllocationAlert = (key: AllocationAssignmentKey) => {
    setAllocationAlerts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 22 }}>
        Notifications
      </div>

      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: "#4B5565",
          letterSpacing: 0.5,
          marginBottom: 16,
        }}
      >
        USER STATUS
      </div>
      {(Object.keys(userStatusAlertsSeed) as UserStatusAlertKey[]).map((key) => {
        const seed = userStatusAlertsSeed[key];
        const al = userStatusAlerts[key];
        return (
          <div key={key} style={{ marginBottom: 22 }}>
            <div
              onClick={() => toggleUserStatusAlert(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              <Checkbox enabled={al.enabled} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>{seed.label}</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                paddingLeft: 30,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 13, color: "#4B5565" }}>{userStatusDescriptions[key]}</span>
              <input
                type="number"
                value={al.value}
                onChange={(e) => changeUserStatusAlertValue(key, e.target.value)}
                style={{
                  width: 52,
                  padding: "8px 10px",
                  border: "1px solid #D9DCE3",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "#1D2433",
                }}
              />
              <select
                value={al.unit}
                onChange={(e) => changeUserStatusAlertUnit(key, e.target.value)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid #D9DCE3",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "#1D2433",
                  background: "#FFFFFF",
                  minWidth: 96,
                }}
              >
                <option value="Hours">Hours</option>
                <option value="Minutes">Minutes</option>
              </select>
            </div>
          </div>
        );
      })}

      <div style={{ borderTop: "1px solid #EEF0F4", margin: "6px 0 20px" }} />

      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: "#4B5565",
          letterSpacing: 0.5,
          marginBottom: 16,
        }}
      >
        ALLOCATION ASSIGNMENT
      </div>
      {(Object.keys(allocationAssignmentSeed) as AllocationAssignmentKey[]).map((key) => {
        const seed = allocationAssignmentSeed[key];
        const enabled = allocationAlerts[key];
        return (
          <div key={key} style={{ marginBottom: 18 }}>
            <div
              onClick={() => toggleAllocationAlert(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                marginBottom: 6,
              }}
            >
              <Checkbox enabled={enabled} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>
                {allocationAssignmentTitles[key]}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#4B5565", paddingLeft: 30 }}>{seed.label}</div>
          </div>
        );
      })}
    </div>
  );
}
