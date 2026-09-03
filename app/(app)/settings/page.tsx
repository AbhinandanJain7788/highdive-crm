"use client";

import { useState } from "react";

// The decoded prototype defines a second, unreachable "Settings" view (isSettings /
// goSettings — a Pipeline Template editor + User Management/Invite panel) that no nav
// element or button anywhere in the template ever triggers. The only reachable Settings
// screen is `isAdminSettings` (wired to the sidebar's "Settings" item via goAdminSettings),
// which is what this page reproduces. See ui-gaps-batch-c.md.

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

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      style={{
        width: 38,
        height: 20,
        borderRadius: 12,
        background: on ? "#FF5C35" : "#D9DCE3",
        position: "relative",
        flexShrink: 0,
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

const PASSWORD_RULES: { test: (v: string) => boolean; label: string }[] = [
  { test: (v) => v.length >= 8 && v.length <= 15, label: "Password must be 8-15 characters long." },
  { test: (v) => /[A-Z]/.test(v), label: "Include an upperCase character" },
  { test: (v) => /[0-9]/.test(v), label: "Include a number" },
  { test: (v) => /[^A-Za-z0-9]/.test(v), label: "Include a special character" },
];

export default function SettingsPage() {
  const [subView, setSubView] = useState<SubView>("general");

  const [settingsGeneralOpen, setSettingsGeneralOpen] = useState(true);
  const [settingsAccountOpen, setSettingsAccountOpen] = useState(false);
  const [settingsLimitAssignTo, setSettingsLimitAssignTo] = useState(false);
  const [settingsWhatsappNotif, setSettingsWhatsappNotif] = useState(true);
  const [settingsLogoutMobile, setSettingsLogoutMobile] = useState(true);
  const [settingsLogoutWeb, setSettingsLogoutWeb] = useState(true);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const onResetPassword = () => {
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

      {/* Sub-navigation for Company Details / API Configuration / Account & Billing / Usage /
          Activity Logs: the source defines handlers + placeholder markup for these
          (adminOtherLabels / isAdminOther) but never renders a clickable element to reach them
          anywhere in the template. This tab strip (reusing the same border-bottom tab pattern
          used elsewhere in the app, e.g. Data Management) is added purely as a navigation
          affordance so the placeholders are reachable. See ui-gaps.md item 9. */}
      <div style={{ display: "flex", gap: 24, marginBottom: 18, borderBottom: "1px solid #E7E9EE" }}>
        {subTabs.map((t) => (
          <div
            key={t.key}
            onClick={() => setSubView(t.key)}
            style={{
              paddingBottom: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              ...tabStyle(subView === t.key),
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {subView !== "general" ? (
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>
            {subViewLabels[subView]}
          </div>
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
            {subViewLabels[subView]} coming soon.
          </div>
        </div>
      ) : (
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: "26px 30px" }}>
          <div
            onClick={() => setSettingsGeneralOpen((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 18 }}
          >
            <span style={{ fontSize: 13, color: "#6B7280", width: 14 }}>
              {settingsGeneralOpen ? "▾" : "▸"}
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1D2433" }}>General</span>
          </div>

          {settingsGeneralOpen && (
            <div style={{ paddingLeft: 26, marginBottom: 24 }}>
              <div
                onClick={() => setSettingsLimitAssignTo((v) => !v)}
                style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 8 }}
              >
                <Toggle on={settingsLimitAssignTo} />
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "#1D2433" }}>
                  Limit Assign To option in CRM
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#6B7280", paddingLeft: 50, marginBottom: 20 }}>
                When enabled, only the direct reportees, colleagues, manager will be shown under Assign
                To option. When disabled, all the users under current process will be shown under Assign
                to option
              </div>

              <div
                onClick={() => setSettingsWhatsappNotif((v) => !v)}
                style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 8 }}
              >
                <Toggle on={settingsWhatsappNotif} />
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "#1D2433" }}>WhatsApp Notifications</span>
              </div>
              <div style={{ fontSize: 13, color: "#6B7280", paddingLeft: 50, marginBottom: 20 }}>
                I consent to receive important updates and support messages from Runo via WhatsApp
              </div>

              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1D2433", marginBottom: 12 }}>
                Manual Log out Settings
              </div>
              <div style={{ background: "#EFF6FC", borderRadius: 8, padding: "16px 18px" }}>
                <div
                  onClick={() => setSettingsLogoutMobile((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    cursor: "pointer",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ marginTop: 1 }}>
                    <Toggle on={settingsLogoutMobile} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1D2433" }}>
                      Allow Log out on Mobile
                    </div>
                    <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2 }}>
                      When enabled, users can manually logout from the app. Turn this off to prevent
                      mobile logout for uninterrupted call tracking/recording.
                    </div>
                  </div>
                </div>
                <div
                  onClick={() => setSettingsLogoutWeb((v) => !v)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}
                >
                  <div style={{ marginTop: 1 }}>
                    <Toggle on={settingsLogoutWeb} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1D2433" }}>
                      Allow Log out on Web
                    </div>
                    <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2 }}>
                      When enabled, users can manually logout from the browser application.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ borderTop: "1px solid #EEF0F4", paddingTop: 20 }}>
            <div
              onClick={() => setSettingsAccountOpen((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
            >
              <span style={{ fontSize: 13, color: "#6B7280", width: 14 }}>
                {settingsAccountOpen ? "▾" : "▸"}
              </span>
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
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: "1px solid #D9DCE3",
                    borderRadius: 7,
                    fontSize: 13,
                    background: "#FAFAF7",
                    marginBottom: 18,
                  }}
                />

                <div style={{ fontSize: 13.5, color: "#1D2433", marginBottom: 8 }}>
                  New Password<span style={{ color: "#C0392B" }}>*</span>
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter Password"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: "1px solid #D9DCE3",
                    borderRadius: 7,
                    fontSize: 13,
                    background: "#FAFAF7",
                    marginBottom: 8,
                  }}
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
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: "1px solid #D9DCE3",
                    borderRadius: 7,
                    fontSize: 13,
                    background: "#FAFAF7",
                    marginBottom: 20,
                  }}
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
