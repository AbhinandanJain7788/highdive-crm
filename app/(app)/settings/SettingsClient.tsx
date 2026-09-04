"use client";

import { useState } from "react";
import { PASSWORD_RULES, type GeneralSettings, type CompanyDetails, type ActivityLogRow } from "@/lib/settings.shared";
import { formatDisplayDateTimeClient } from "./formatClient";

type SubView = "general" | "companyDetails" | "apiConfiguration" | "accountBilling" | "usage" | "activityLogs";

const subViewLabels: Record<Exclude<SubView, "general">, string> = {
  companyDetails: "Company Details",
  apiConfiguration: "API Configuration",
  accountBilling: "Account & Billing",
  usage: "Usage",
  activityLogs: "Activity Logs",
};

const tabStyle = (active: boolean): React.CSSProperties =>
  active
    ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" }
    : { color: "#4B5565", borderBottom: "2px solid transparent" };

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 38,
        height: 20,
        borderRadius: 12,
        background: on ? "#FF5C35" : "#D9DCE3",
        position: "relative",
        flexShrink: 0,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: on ? 22 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#FFFFFF",
          transition: "left 0.15s",
        }}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  border: "1px solid #D9DCE3",
  borderRadius: 7,
  fontSize: 13,
  background: "#FAFAF7",
  marginBottom: 18,
};

export default function SettingsClient({
  canManage,
  general,
  company,
  activityLogs,
}: {
  canManage: boolean;
  general: GeneralSettings | null;
  company: CompanyDetails | null;
  activityLogs: { rows: ActivityLogRow[]; total: number } | null;
}) {
  const [subView, setSubView] = useState<SubView>("general");
  const [settingsGeneralOpen, setSettingsGeneralOpen] = useState(true);
  const [settingsAccountOpen, setSettingsAccountOpen] = useState(false);

  const [generalState, setGeneralState] = useState<GeneralSettings | null>(general);
  const [companyState, setCompanyState] = useState<CompanyDetails | null>(company);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyMessage, setCompanyMessage] = useState<string | null>(null);

  const [logs, setLogs] = useState(activityLogs?.rows ?? []);
  const [logsTotal, setLogsTotal] = useState(activityLogs?.total ?? 0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function toggleGeneral(field: keyof GeneralSettings) {
    if (!generalState) return;
    const next = { ...generalState, [field]: !generalState[field] };
    setGeneralState(next);
    const res = await fetch("/api/settings/general", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: next[field] }),
    });
    if (res.ok) {
      const json = await res.json();
      setGeneralState(json.data);
    }
  }

  async function saveCompany() {
    if (!companyState) return;
    setCompanySaving(true);
    setCompanyMessage(null);
    try {
      const res = await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyState),
      });
      const json = await res.json();
      if (res.ok) {
        setCompanyState(json.data);
        setCompanyMessage("Saved.");
      } else {
        setCompanyMessage(json.error?.message ?? "Failed to save.");
      }
    } finally {
      setCompanySaving(false);
    }
  }

  async function loadLogsPage(page: number) {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/settings/activity-logs?page=${page}&pageSize=25`);
      const json = await res.json();
      if (res.ok) {
        setLogs(json.data ?? []);
        setLogsTotal(json.total ?? 0);
        setLogsPage(page);
      }
    } finally {
      setLogsLoading(false);
    }
  }

  const onResetPassword = async () => {
    if (!oldPassword) {
      setResetMessage({ type: "error", text: "Enter your old password." });
      return;
    }
    const failedRule = PASSWORD_RULES.find((rule) => !rule.test(newPassword));
    if (failedRule) {
      setResetMessage({ type: "error", text: failedRule.label });
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetMessage({ type: "error", text: "New password and confirm password do not match." });
      return;
    }
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
    });
    const json = await res.json();
    if (!res.ok) {
      setResetMessage({ type: "error", text: json.error?.message ?? "Failed to reset password." });
      return;
    }
    setResetMessage({ type: "success", text: "Password updated." });
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const subTabs: { key: SubView; label: string }[] = [
    { key: "general", label: "General & Account" },
    { key: "companyDetails", label: "Company Details" },
    { key: "apiConfiguration", label: "API Configuration" },
    { key: "accountBilling", label: "Account & Billing" },
    { key: "usage", label: "Usage" },
    { key: "activityLogs", label: "Activity Logs" },
  ];

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>Settings</div>

      <div style={{ display: "flex", gap: 24, marginBottom: 18, borderBottom: "1px solid #E7E9EE", flexWrap: "wrap" }}>
        {subTabs.map((t) => (
          <div
            key={t.key}
            onClick={() => {
              setSubView(t.key);
              if (t.key === "activityLogs" && canManage) loadLogsPage(1);
            }}
            style={{ paddingBottom: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", ...tabStyle(subView === t.key) }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {subView === "companyDetails" && (
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>Company Details</div>
          {!canManage || !companyState ? (
            <PermissionNotice />
          ) : (
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: "26px 30px", maxWidth: 460 }}>
              {(
                [
                  ["companyName", "Company Name"],
                  ["address", "Address"],
                  ["phone", "Phone"],
                  ["email", "Email"],
                  ["website", "Website"],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <div style={{ fontSize: 13.5, color: "#1D2433", marginBottom: 8 }}>{label}</div>
                  <input
                    value={companyState[field]}
                    onChange={(e) => setCompanyState({ ...companyState, [field]: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              ))}
              {companyMessage && <div style={{ fontSize: 12.5, marginBottom: 14, color: "#1E7F43" }}>{companyMessage}</div>}
              <button
                onClick={saveCompany}
                disabled={companySaving}
                style={{
                  background: "linear-gradient(180deg,#FF7A50,#FF5C35)",
                  border: "none",
                  color: "#FFFFFF",
                  borderRadius: 7,
                  padding: "12px 30px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: companySaving ? "default" : "pointer",
                  opacity: companySaving ? 0.7 : 1,
                }}
              >
                {companySaving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
      )}

      {subView === "activityLogs" && (
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>Activity Logs</div>
          {!canManage ? (
            <PermissionNotice />
          ) : (
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden", opacity: logsLoading ? 0.6 : 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#FAFBFC", borderBottom: "1px solid #E7E9EE" }}>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "#6B7280" }}>Actor</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "#6B7280" }}>Action</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "#6B7280" }}>Entity</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "#6B7280" }}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 30, textAlign: "center", color: "#9AA1AC" }}>
                        No activity yet.
                      </td>
                    </tr>
                  )}
                  {logs.map((l) => (
                    <tr key={l.id} style={{ borderBottom: "1px solid #F4F5F8" }}>
                      <td style={{ padding: "10px 16px", color: "#1D2433" }}>{l.actorName ?? "--"}</td>
                      <td style={{ padding: "10px 16px", color: "#1D2433" }}>{l.action}</td>
                      <td style={{ padding: "10px 16px", color: "#4B5565" }}>
                        {l.entityType} #{l.entityId.slice(0, 8)}
                      </td>
                      <td style={{ padding: "10px 16px", color: "#4B5565" }}>{formatDisplayDateTimeClient(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                <span style={{ fontSize: 12.5, color: "#6B7280" }}>
                  {logsTotal === 0 ? "0" : `${(logsPage - 1) * 25 + 1}-${Math.min(logsPage * 25, logsTotal)}`} of {logsTotal}
                </span>
                <button
                  onClick={() => loadLogsPage(logsPage - 1)}
                  disabled={logsPage <= 1}
                  style={{ border: "1px solid #D9DCE3", borderRadius: 6, background: "#FFFFFF", padding: "5px 10px", cursor: logsPage <= 1 ? "default" : "pointer", opacity: logsPage <= 1 ? 0.5 : 1 }}
                >
                  Prev
                </button>
                <button
                  onClick={() => loadLogsPage(logsPage + 1)}
                  disabled={logsPage * 25 >= logsTotal}
                  style={{ border: "1px solid #D9DCE3", borderRadius: 6, background: "#FFFFFF", padding: "5px 10px", cursor: logsPage * 25 >= logsTotal ? "default" : "pointer", opacity: logsPage * 25 >= logsTotal ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(subView === "apiConfiguration" || subView === "accountBilling" || subView === "usage") && (
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>{subViewLabels[subView]}</div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 60, textAlign: "center", fontSize: 13, color: "#9AA1AC" }}>
            {subViewLabels[subView]} coming soon.
          </div>
        </div>
      )}

      {subView === "general" && (
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: "26px 30px" }}>
          <div
            onClick={() => setSettingsGeneralOpen((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 18 }}
          >
            <span style={{ fontSize: 13, color: "#6B7280", width: 14 }}>{settingsGeneralOpen ? "▾" : "▸"}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1D2433" }}>General</span>
          </div>

          {settingsGeneralOpen && (
            <div style={{ paddingLeft: 26, marginBottom: 24 }}>
              {!canManage || !generalState ? (
                <PermissionNotice />
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <Toggle on={generalState.limitAssignTo} onClick={() => toggleGeneral("limitAssignTo")} />
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: "#1D2433" }}>Limit Assign To option in CRM</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7280", paddingLeft: 50, marginBottom: 20 }}>
                    When enabled, only the direct reportees, colleagues, manager will be shown under Assign To option.
                    When disabled, all the users under current process will be shown under Assign to option
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <Toggle on={generalState.whatsappNotifications} onClick={() => toggleGeneral("whatsappNotifications")} />
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: "#1D2433" }}>WhatsApp Notifications</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7280", paddingLeft: 50, marginBottom: 20 }}>
                    I consent to receive important updates and support messages from Runo via WhatsApp
                  </div>

                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1D2433", marginBottom: 12 }}>Manual Log out Settings</div>
                  <div style={{ background: "#EFF6FC", borderRadius: 8, padding: "16px 18px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                      <div style={{ marginTop: 1 }}>
                        <Toggle on={generalState.logoutMobile} onClick={() => toggleGeneral("logoutMobile")} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1D2433" }}>Allow Log out on Mobile</div>
                        <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2 }}>
                          When enabled, users can manually logout from the app. Turn this off to prevent mobile logout for
                          uninterrupted call tracking/recording.
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ marginTop: 1 }}>
                        <Toggle on={generalState.logoutWeb} onClick={() => toggleGeneral("logoutWeb")} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1D2433" }}>Allow Log out on Web</div>
                        <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2 }}>
                          When enabled, users can manually logout from the browser application.
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ borderTop: "1px solid #EEF0F4", paddingTop: 20 }}>
            <div
              onClick={() => setSettingsAccountOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            >
              <span style={{ fontSize: 13, color: "#6B7280", width: 14 }}>{settingsAccountOpen ? "▾" : "▸"}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1D2433" }}>Account</span>
            </div>

            {settingsAccountOpen && (
              <div style={{ paddingLeft: 26, marginTop: 18, maxWidth: 460 }}>
                <div style={{ fontSize: 13.5, color: "#1D2433", marginBottom: 8 }}>
                  Old Password<span style={{ color: "#C0392B" }}>*</span>
                </div>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter old Password"
                  style={inputStyle}
                />

                <div style={{ fontSize: 13.5, color: "#1D2433", marginBottom: 8 }}>
                  New Password<span style={{ color: "#C0392B" }}>*</span>
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter Password"
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
                <div style={{ fontSize: 12.5, color: "#6B7280", lineHeight: 1.7, marginBottom: 18 }}>
                  • Password must be 8-15 characters long.
                  <br />
                  • Include an upperCase character
                  <br />
                  • Include a number
                  <br />• Include a special character
                </div>

                <div style={{ fontSize: 13.5, color: "#1D2433", marginBottom: 8 }}>
                  Confirm Password<span style={{ color: "#C0392B" }}>*</span>
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter new password again"
                  style={inputStyle}
                />

                {resetMessage && (
                  <div
                    style={{
                      fontSize: 12.5,
                      marginBottom: 14,
                      color: resetMessage.type === "success" ? "#1E7F43" : "#C0392B",
                      background: resetMessage.type === "success" ? "#E6F4EA" : "#FDECEC",
                      padding: "8px 10px",
                      borderRadius: 6,
                    }}
                  >
                    {resetMessage.text}
                  </div>
                )}

                <button
                  onClick={onResetPassword}
                  style={{
                    background: "linear-gradient(180deg,#FF7A50,#FF5C35)",
                    border: "none",
                    color: "#FFFFFF",
                    borderRadius: 7,
                    padding: "12px 30px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Reset Password
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionNotice() {
  return (
    <div style={{ fontSize: 13, color: "#9AA1AC", padding: "20px 0" }}>
      You don&apos;t have permission to view this section.
    </div>
  );
}
