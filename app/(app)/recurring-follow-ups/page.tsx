"use client";

import { useState } from "react";

type RfuTab = "pending" | "upcoming";

export default function RecurringFollowUpsPage() {
  const [rfuTab, setRfuTab] = useState<RfuTab>("pending");

  // Mirrors the source prototype: both counts are hard-coded to 0 — this screen has
  // no seeded recurring-follow-up data, so it always renders the empty state.
  const rfuPendingCount = 0;
  const rfuUpcomingCount = 0;

  const tabStyle = (active: boolean): React.CSSProperties =>
    active
      ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" }
      : { color: "#4B5565", borderBottom: "2px solid transparent" };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 18 }}>
        Recurring Follow-Ups
      </div>
      <div style={{ display: "flex", gap: 28, marginBottom: 2, borderBottom: "1px solid #E7E9EE" }}>
        <div
          onClick={() => setRfuTab("pending")}
          style={{
            paddingBottom: 10,
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            ...tabStyle(rfuTab === "pending"),
          }}
        >
          Pending Followups{" "}
          <span
            style={{
              background: "#EEF0F5",
              color: "#4B5565",
              borderRadius: 10,
              padding: "1px 8px",
              fontSize: 12,
            }}
          >
            {rfuPendingCount}
          </span>
        </div>
        <div
          onClick={() => setRfuTab("upcoming")}
          style={{
            paddingBottom: 10,
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            ...tabStyle(rfuTab === "upcoming"),
          }}
        >
          Upcoming Followups{" "}
          <span
            style={{
              background: "#EEF0F5",
              color: "#4B5565",
              borderRadius: 10,
              padding: "1px 8px",
              fontSize: 12,
            }}
          >
            {rfuUpcomingCount}
          </span>
        </div>
      </div>
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E7E9EE",
          borderTop: "none",
          borderRadius: "0 0 10px 10px",
          padding: "70px 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <svg width="70" height="70" viewBox="0 0 70 70">
          <rect x="12" y="10" width="40" height="50" rx="3" fill="none" stroke="#D9DCE3" strokeWidth="2" />
          <line x1="19" y1="22" x2="45" y2="22" stroke="#D9DCE3" strokeWidth="2" />
          <line x1="19" y1="32" x2="45" y2="32" stroke="#D9DCE3" strokeWidth="2" />
          <line x1="19" y1="42" x2="35" y2="42" stroke="#D9DCE3" strokeWidth="2" />
          <circle cx="47" cy="47" r="13" fill="#FFFFFF" stroke="#FF9F80" strokeWidth="2" />
          <path d="M42 47h10M47 42v10" stroke="#FF9F80" strokeWidth="2" />
        </svg>
        <div style={{ fontSize: 13.5, color: "#9AA1AC" }}>No Data to display</div>
      </div>
    </div>
  );
}
