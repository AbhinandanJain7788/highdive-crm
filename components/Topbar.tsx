"use client";

import { useEffect, useState } from "react";

type Notification = { id: string; label: string; action: string; createdAt: string };

type TopbarProps = {
  userName: string;
  roleName: string;
};

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Topbar({ userName, roleName }: TopbarProps) {
  const initial = userName.trim().charAt(0).toUpperCase() || "?";
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetch("/api/notifications/mine")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => setNotifications(body.data ?? []))
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        height: 64,
        flexShrink: 0,
        background: "#FFFFFF",
        borderBottom: "1px solid #ECEEF2",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 28px",
      }}
    >
      <div style={{ flex: 1 }} />
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(!open)}
          title="Notifications"
          aria-label="Notifications"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "1px solid #E7E9EE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            background: "#FAFBFC",
            position: "relative",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path
              d="M8 2a3 3 0 0 0-3 3v2.2c0 .6-.2 1.2-.6 1.7L3 11h10l-1.4-2.1c-.4-.5-.6-1.1-.6-1.7V5a3 3 0 0 0-3-3z"
              fill="none"
              stroke="#4B5565"
              strokeWidth="1.3"
            />
          </svg>
          {notifications.length > 0 && (
            <span
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                background: notifications.length > 2 ? "#C0392B" : "#FF5C35",
                color: "#FFFFFF",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
                border: "1.5px solid #FFFFFF",
              }}
            >
              {notifications.length}
            </span>
          )}
        </button>
        {open && (
          <div
            style={{
              position: "absolute",
              top: 46,
              right: 0,
              width: 320,
              maxHeight: 380,
              background: "#FFFFFF",
              border: "1px solid #E7E9EE",
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(16,24,40,0.12)",
              overflow: "hidden",
              zIndex: 100,
            }}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #EEF0F4", fontSize: 13, fontWeight: 700, color: "#1D2433" }}>
              Notifications
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {notifications.length === 0 && (
                <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 13, color: "#9AA1AC" }}>
                  No notifications
                </div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #F4F5F8",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: n.action === "idle_15" ? "#C0392B" : "#D97706",
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#1D2433", lineHeight: 1.3 }}>{n.label}</div>
                    <div style={{ fontSize: 11, color: "#9AA1AC", marginTop: 2 }}>{formatTimeAgo(n.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {open && <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", paddingLeft: 6 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#EEEDFE",
            color: "#3C3489",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initial}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433", lineHeight: 1.2 }}>{userName}</div>
          <div style={{ fontSize: 11.5, color: "#9AA1AC", lineHeight: 1.2 }}>{roleName}</div>
        </div>
      </div>
    </div>
  );
}
