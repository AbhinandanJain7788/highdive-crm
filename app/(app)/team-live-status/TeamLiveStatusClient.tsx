"use client";

import { useState } from "react";
import { liveStatusColors, liveStatusLabels } from "@/lib/mock";
import type { LiveStatusRow } from "@/lib/team";

type Row = LiveStatusRow & { sinceLabel: string };
type SortOrder = "Name: A-Z" | "Name: Z-A";

// The source prototype's board has 7 fixed status buckets (Idle / On Call / Wrapping up /
// On Break / Checked Out / Logged Out / Hasn't Logged in), but the `live_status` enum only
// carries 4 real values (idle / on_call / on_break / offline). We map the 4 real values onto
// their closest bucket (offline -> "Logged Out") and keep the other 3 buckets at 0, exactly
// as the source itself does for buckets its own seed never populates. See ui-gaps.md item 16.
const BUCKET_DEFS: { label: string; dotColor: string; barColor: string; userLiveStatus: Row["liveStatus"] | null }[] = [
  { label: "Idle", dotColor: "#D97706", barColor: "#D9DCE3", userLiveStatus: "idle" },
  { label: "On Call", dotColor: "#16A34A", barColor: "#8FD9A8", userLiveStatus: "on_call" },
  { label: "Wrapping up", dotColor: "#2563EB", barColor: "#B7CCF7", userLiveStatus: null },
  { label: "On Break", dotColor: "#B15C00", barColor: "#F2C79B", userLiveStatus: "on_break" },
  { label: "Checked Out", dotColor: "#5B6472", barColor: "#D9DCE3", userLiveStatus: null },
  { label: "Logged Out", dotColor: "#2563EB", barColor: "#B7CCF7", userLiveStatus: "offline" },
  { label: "Hasn't Logged in", dotColor: "#C0392B", barColor: "#F4C6C0", userLiveStatus: null },
];

// Call Tracking / Call Recording / Version aren't part of the users schema — the source
// hard-codes these per member and no such columns exist on `users`. Every row is defaulted
// to the source's common case (Enabled / Enabled / v8.2.1), an intentional, disclosed gap
// (ui-gaps.md item 16) rather than invented schema.
export default function TeamLiveStatusClient({ initialRows }: { initialRows: Row[] }) {
  const [teamStatusSearch, setTeamStatusSearch] = useState("");
  const [teamStatusSort, setTeamStatusSort] = useState<SortOrder>("Name: A-Z");

  const tlTotal = initialRows.length || 1;
  const liveStatusBuckets = BUCKET_DEFS.map((b) => {
    const count = b.userLiveStatus ? initialRows.filter((u) => u.liveStatus === b.userLiveStatus).length : 0;
    const barWidth = b.userLiveStatus ? `${Math.max(4, Math.round((count / tlTotal) * 100))}%` : "4%";
    return { ...b, count, barWidth };
  });

  const tlq = teamStatusSearch.trim().toLowerCase();
  const teamLiveRows = initialRows
    .filter((m) => !tlq || m.name.toLowerCase().includes(tlq))
    .map((m) => ({
      ...m,
      avatarLetter: m.name.charAt(0).toUpperCase(),
      roleLabel: m.role?.name ?? "--",
      trackLabel: "Enabled",
      trackBg: "#E6F4EA",
      trackColor: "#1E7F43",
      recLabel: "Enabled",
      recBg: "#E6F4EA",
      recColor: "#1E7F43",
      version: "v8.2.1",
      liveLabel: m.liveStatus ? liveStatusLabels[m.liveStatus] : "--",
      liveColor: m.liveStatus ? liveStatusColors[m.liveStatus] : "#9AA1AC",
    }))
    .sort((a, b) => (teamStatusSort === "Name: Z-A" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>Team Live Status</div>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ background: "#FBF3EB", borderRadius: 10, padding: "26px 22px", display: "flex", flexDirection: "column", gap: 26 }}>
          {liveStatusBuckets.map((lb) => (
            <div key={lb.label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 170, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="6.4" fill="none" stroke={lb.dotColor} strokeWidth="1.4" />
                </svg>
                <span style={{ fontSize: 13.5, color: "#4B5565" }}>
                  {lb.label} ({lb.count})
                </span>
              </div>
              <div style={{ flex: 1, height: 16, background: "#FFFFFF", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", background: lb.barColor, width: lb.barWidth, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#FFFFFF",
                border: "1px solid #D9DCE3",
                borderRadius: 7,
                padding: "9px 14px",
              }}
            >
              <input
                type="text"
                value={teamStatusSearch}
                onChange={(e) => setTeamStatusSearch(e.target.value)}
                placeholder="Search"
                style={{ border: "none", outline: "none", fontSize: 13, color: "#1D2433", flex: 1, background: "transparent" }}
              />
              <svg width="14" height="14" viewBox="0 0 14 14">
                <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
                <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#9AA1AC" strokeWidth="1.4" />
              </svg>
            </div>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 7,
                border: "1px solid #E7E9EE",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16">
                <path d="M13.5 8A5.5 5.5 0 113.6 4.4M13.5 8V3.5M13.5 8H9" fill="none" stroke="#4B5565" strokeWidth="1.4" />
              </svg>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <select
              style={{ padding: "9px 14px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF", minWidth: 180 }}
            >
              <option>Status: Select Filters</option>
            </select>
            <select
              style={{ padding: "9px 14px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF", minWidth: 160 }}
            >
              <option>Call Tracking: Any</option>
            </select>
            <select
              style={{ padding: "9px 14px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF", minWidth: 170 }}
            >
              <option>Call Recording: Any</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <select
              style={{ padding: "9px 14px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF", minWidth: 130 }}
            >
              <option>Version: Any</option>
            </select>
            <span style={{ fontSize: 13, color: "#9AA1AC" }}>Sort by</span>
            <select
              value={teamStatusSort}
              onChange={(e) => setTeamStatusSort(e.target.value as SortOrder)}
              style={{ padding: "9px 14px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF", minWidth: 130 }}
            >
              <option value="Name: A-Z">Name: A-Z</option>
              <option value="Name: Z-A">Name: Z-A</option>
            </select>
            <div
              style={{
                position: "relative",
                width: 38,
                height: 38,
                borderRadius: 7,
                border: "1px solid #E7E9EE",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16">
                <circle cx="5.5" cy="5.5" r="2.4" fill="none" stroke="#4B5565" strokeWidth="1.2" />
                <circle cx="11" cy="6.5" r="1.8" fill="none" stroke="#4B5565" strokeWidth="1.2" />
              </svg>
              <div
                style={{
                  position: "absolute",
                  top: -7,
                  right: -7,
                  background: "#FF5C35",
                  color: "#FFFFFF",
                  fontSize: 9.5,
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: "1px 5px",
                }}
              >
                11
              </div>
            </div>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 7,
                border: "1px solid #E7E9EE",
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16">
                <path d="M8 1.5v9M4.5 7l3.5 3.5L11.5 7" fill="none" stroke="#4B5565" strokeWidth="1.3" />
                <line x1="2" y1="13.5" x2="14" y2="13.5" stroke="#4B5565" strokeWidth="1.3" />
              </svg>
            </div>
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1.2fr 1.2fr 0.9fr 1.1fr",
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
              <div>Call Tracking Status</div>
              <div>Call Recording Sta...</div>
              <div>Version</div>
              <div>Live Status</div>
            </div>
            {teamLiveRows.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1.2fr 1.2fr 0.9fr 1.1fr",
                  gap: 10,
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: "1px solid #F4F5F8",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: m.avatarColor ?? "#9AA1AC",
                      color: "#FFFFFF",
                      fontSize: 13,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {m.avatarLetter}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "#9AA1AC" }}>{m.roleLabel}</div>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 9px", borderRadius: 6, background: m.trackBg, color: m.trackColor }}>
                    {m.trackLabel}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 9px", borderRadius: 6, background: m.recBg, color: m.recColor }}>
                    {m.recLabel}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "#4B5565" }}>{m.version}</div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: m.liveColor }}>● {m.liveLabel}</div>
                  <div style={{ fontSize: 11.5, color: "#9AA1AC" }}>Since: {m.sinceLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
