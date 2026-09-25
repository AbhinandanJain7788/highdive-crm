"use client";

import { useEffect, useState } from "react";
import { liveStatusColors, liveStatusLabels } from "@/lib/mock";
import type { LiveStatusRow } from "@/lib/team";
import { formatSinceClient } from "./formatSinceClient";

type Row = LiveStatusRow & { sinceLabel: string };

function fmtDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const BUCKET_DEFS: { label: string; dotColor: string; barColor: string; userLiveStatus: LiveStatusRow["liveStatus"] | null }[] = [
  { label: "Idle", dotColor: "#D97706", barColor: "#D9DCE3", userLiveStatus: "idle" },
  { label: "On Call", dotColor: "#16A34A", barColor: "#8FD9A8", userLiveStatus: "on_call" },
  { label: "Wrapping up", dotColor: "#2563EB", barColor: "#B7CCF7", userLiveStatus: null },
  { label: "On Break", dotColor: "#B15C00", barColor: "#F2C79B", userLiveStatus: "on_break" },
  { label: "Checked Out", dotColor: "#5B6472", barColor: "#D9DCE3", userLiveStatus: null },
  { label: "Logged Out", dotColor: "#2563EB", barColor: "#B7CCF7", userLiveStatus: "offline" },
  { label: "Hasn't Logged in", dotColor: "#C0392B", barColor: "#F4C6C0", userLiveStatus: null },
];

const STATUS_OPTIONS: { value: LiveStatusRow["liveStatus"]; label: string }[] = [
  { value: "on_call", label: "On Call" },
  { value: "idle", label: "Idle" },
  { value: "on_break", label: "On Break" },
  { value: "offline", label: "Logged Out" },
];

function HeartbeatDot({ active, sinceLabel }: { active: boolean | null; sinceLabel: string | null }) {
  if (active === null && !sinceLabel) return null;
  const color = active === true ? "#16A34A" : active === false ? "#9AA1AC" : "#D9DCE3";
  return (
    <span title={sinceLabel ? `Last heartbeat: ${sinceLabel}` : "No heartbeat received"} style={{ display: "inline-flex", alignItems: "center", marginLeft: 6 }}>
      <svg width="8" height="8" viewBox="0 0 8 8">
        <circle cx="4" cy="4" r={active === true ? "3.2" : "2.6"} fill={color} />
      </svg>
    </span>
  );
}

export default function TeamLiveStatusClient({ initialRows }: { initialRows: Row[] }) {
  const [teamStatusSearch, setTeamStatusSearch] = useState("");
  const [teamStatusSort, setTeamStatusSort] = useState<"Name: A-Z" | "Name: Z-A">("Name: A-Z");
  const [statusFilter, setStatusFilter] = useState<Exclude<LiveStatusRow["liveStatus"], null> | "">("");
  const [trackingFilter, setTrackingFilter] = useState<"" | "true" | "false">("");
  const [recordingFilter, setRecordingFilter] = useState<"" | "true" | "false">("");
  const [versionFilter, setVersionFilter] = useState("");

  const [rows, setRows] = useState<LiveStatusRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const versionOptions = [...new Set(initialRows.map((r) => r.appVersion))].sort();

  const firstRender = useState(() => ({ current: true }))[0];
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (trackingFilter) params.set("callTracking", trackingFilter);
    if (recordingFilter) params.set("callRecording", recordingFilter);
    if (versionFilter) params.set("version", versionFilter);

    setLoading(true);
    fetch(`/api/team/live-status?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => setRows(body.data ?? []))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setRows([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [statusFilter, trackingFilter, recordingFilter, versionFilter, firstRender]);

  const tlTotal = rows.length || 1;
  const liveStatusBuckets = BUCKET_DEFS.map((b) => {
    const count = b.userLiveStatus ? rows.filter((u) => u.liveStatus === b.userLiveStatus).length : 0;
    const barWidth = b.userLiveStatus ? `${Math.max(4, Math.round((count / tlTotal) * 100))}%` : "4%";
    return { ...b, count, barWidth };
  });

  const tlq = teamStatusSearch.trim().toLowerCase();
  const teamLiveRows = rows
    .filter((m) => !tlq || m.name.toLowerCase().includes(tlq))
    .map((m) => {
      const todaySecs = m.callTimeStats?.todaySeconds ?? 0;
      const monthSecs = m.callTimeStats?.monthSeconds ?? 0;
      const callCount = m.callTimeStats?.callCount ?? 0;
      let barColor = "#D9DCE3";
      if (todaySecs > 2 * 3600) barColor = "#16A34A";
      else if (todaySecs > 3600) barColor = "#D97706";
      else if (todaySecs > 30 * 60) barColor = "#2563EB";

      return {
        ...m,
        avatarLetter: m.name.charAt(0).toUpperCase(),
        roleLabel: m.role?.name ?? "--",
        trackLabel: m.callTrackingEnabled ? "Enabled" : "Disabled",
        trackBg: m.callTrackingEnabled ? "#E6F4EA" : "#FDECEC",
        trackColor: m.callTrackingEnabled ? "#1E7F43" : "#C0392B",
        recLabel: m.callRecordingEnabled ? "Enabled" : "Disabled",
        recBg: m.callRecordingEnabled ? "#E6F4EA" : "#FDECEC",
        recColor: m.callRecordingEnabled ? "#1E7F43" : "#C0392B",
        version: m.appVersion,
        liveLabel: m.liveStatus ? liveStatusLabels[m.liveStatus] : "--",
        liveColor: m.liveStatus ? liveStatusColors[m.liveStatus] : "#9AA1AC",
        sinceLabel: formatSinceClient(m.liveStatusSince),
        todayTime: fmtDuration(todaySecs),
        monthTime: fmtDuration(monthSecs),
        callCount,
        timeBarColor: barColor,
        timeBarWidth: `${Math.max(4, Math.min(100, Math.round((todaySecs / (8 * 3600)) * 100)))}%`,
        heartbeatActive: m.heartbeatActive,
        lastHeartbeatSince: m.lastHeartbeatAt ? formatSinceClient(m.lastHeartbeatAt) : null,
      };
    })
    .sort((a, b) => (teamStatusSort === "Name: Z-A" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));

  const selectStyle: React.CSSProperties = { padding: "9px 14px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF" };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>Team Live Status</div>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ background: "#FBF3EB", border: "1px solid #F4E4D3", borderRadius: 12, padding: "26px 22px", display: "flex", flexDirection: "column", gap: 26 }}>
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
            {loading && <span style={{ fontSize: 12, color: "#9AA1AC" }}>Loading…</span>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              style={{ ...selectStyle, minWidth: 180 }}
            >
              <option value="">Status: Select Filters</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={trackingFilter} onChange={(e) => setTrackingFilter(e.target.value as typeof trackingFilter)} style={{ ...selectStyle, minWidth: 160 }}>
              <option value="">Call Tracking: Any</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
            <select value={recordingFilter} onChange={(e) => setRecordingFilter(e.target.value as typeof recordingFilter)} style={{ ...selectStyle, minWidth: 170 }}>
              <option value="">Call Recording: Any</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <select value={versionFilter} onChange={(e) => setVersionFilter(e.target.value)} style={{ ...selectStyle, minWidth: 130 }}>
              <option value="">Version: Any</option>
              {versionOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 13, color: "#9AA1AC" }}>Sort by</span>
            <select
              value={teamStatusSort}
              onChange={(e) => setTeamStatusSort(e.target.value as typeof teamStatusSort)}
              style={{ ...selectStyle, minWidth: 130 }}
            >
              <option value="Name: A-Z">Name: A-Z</option>
              <option value="Name: Z-A">Name: Z-A</option>
            </select>
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,40,0.04)", overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr 1fr 0.8fr",
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
              <div>Call Tracking</div>
              <div>Call Recording</div>
              <div>Version</div>
              <div>Live Status</div>
              <div>Today&apos;s Time</div>
            </div>
            {teamLiveRows.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr 0.8fr 1fr 0.8fr",
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
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{m.name}</div>
                      <HeartbeatDot active={m.heartbeatActive} sinceLabel={m.lastHeartbeatSince} />
                    </div>
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
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1D2433" }}>{m.todayTime}</div>
                  <div style={{ height: 4, background: "#EEF0F5", borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: m.timeBarColor, width: m.timeBarWidth, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: "#9AA1AC", marginTop: 2 }}>
                    {m.callCount > 0 ? `${m.callCount} calls` : "No calls"}
                  </div>
                </div>
              </div>
            ))}
            {teamLiveRows.length === 0 && (
              <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "30px 0" }}>No team members match these filters.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
