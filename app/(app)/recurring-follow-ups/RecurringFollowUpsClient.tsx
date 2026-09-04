"use client";

import { useState } from "react";
import { avatarLetterFor } from "@/lib/mock";
import { statusStyles, avatarColorFor } from "@/lib/mock/styles";
import type { FollowUpRow } from "@/lib/followups.shared";

type RfuTab = "pending" | "upcoming";

function tabStyle(active: boolean): React.CSSProperties {
  return active
    ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" }
    : { color: "#4B5565", borderBottom: "2px solid transparent" };
}

export default function RecurringFollowUpsClient({
  initialRows,
  initialCounts,
}: {
  initialRows: FollowUpRow[];
  initialCounts: { pending: number; upcoming: number };
}) {
  const [rfuTab, setRfuTab] = useState<RfuTab>("pending");
  const [rows, setRows] = useState<FollowUpRow[]>(initialRows);
  const [counts, setCounts] = useState(initialCounts);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = rows.filter((r) => r.bucket === rfuTab);

  async function completeFollowUp(row: FollowUpRow) {
    setCompletingId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/follow-ups/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not complete follow-up.");
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setCounts((prev) => ({ ...prev, [rfuTab]: Math.max(0, prev[rfuTab] - 1) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete follow-up.");
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 18 }}>Recurring Follow-Ups</div>
      <div style={{ display: "flex", gap: 28, marginBottom: 2, borderBottom: "1px solid #E7E9EE" }}>
        <div
          onClick={() => setRfuTab("pending")}
          style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, ...tabStyle(rfuTab === "pending") }}
        >
          Pending Followups{" "}
          <span style={{ background: "#EEF0F5", color: "#4B5565", borderRadius: 10, padding: "1px 8px", fontSize: 12 }}>{counts.pending}</span>
        </div>
        <div
          onClick={() => setRfuTab("upcoming")}
          style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, ...tabStyle(rfuTab === "upcoming") }}
        >
          Upcoming Followups{" "}
          <span style={{ background: "#EEF0F5", color: "#4B5565", borderRadius: 10, padding: "1px 8px", fontSize: 12 }}>{counts.upcoming}</span>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", borderRadius: 8, padding: "10px 14px", fontSize: 13, margin: "12px 0" }}>
          {error}
        </div>
      )}

      {visible.length > 0 ? (
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.8fr 1.1fr 1.2fr 1.4fr 1.1fr 0.7fr",
              gap: 10,
              padding: "11px 16px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "#9AA1AC",
              textTransform: "uppercase",
              letterSpacing: 0.3,
              borderBottom: "1px solid #EEF0F4",
              background: "#FAFBFC",
            }}
          >
            <div>Name</div>
            <div>Status</div>
            <div>Next Due</div>
            <div>Recurrence</div>
            <div>Assign To</div>
            <div>Actions</div>
          </div>
          {visible.map((fu) => {
            const style = fu.applicationStatus ? statusStyles[fu.applicationStatus] : null;
            return (
              <div
                key={fu.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.8fr 1.1fr 1.2fr 1.4fr 1.1fr 0.7fr",
                  gap: 10,
                  alignItems: "center",
                  padding: "11px 16px",
                  borderBottom: "1px solid #F4F5F8",
                  borderLeft: "3px solid #FF5C35",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: avatarColorFor(fu.candidateName),
                      color: "#FFFFFF",
                      fontSize: 12.5,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {avatarLetterFor(fu.candidateName)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{fu.candidateName}</div>
                    <div style={{ fontSize: 12, color: "#9AA1AC" }}>{fu.phone}</div>
                  </div>
                </div>
                <div>
                  {style ? (
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: style.bg, color: style.color }}>
                      {style.label}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "#9AA1AC" }}>--</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: "#4B5565" }}>{fu.dueAt}</div>
                <div style={{ fontSize: 13, color: "#4B5565" }}>{fu.recurrenceRule ?? "--"}</div>
                <div style={{ fontSize: 13, color: "#4B5565" }}>{fu.assignToName ?? "--"}</div>
                <div>
                  <button
                    onClick={() => completeFollowUp(fu)}
                    disabled={completingId === fu.id}
                    title="Mark Complete"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      border: "1px solid #FFD9CC",
                      background: "#FFF5F2",
                      color: "#FF5C35",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      lineHeight: 1,
                      cursor: completingId === fu.id ? "default" : "pointer",
                      opacity: completingId === fu.id ? 0.6 : 1,
                    }}
                  >
                    {completingId === fu.id ? "…" : "✓"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
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
      )}
    </div>
  );
}
