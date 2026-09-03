"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  candidatesSeed,
  callLogsSeed,
  statusStyles,
  fmtDuration,
  withinRange,
  withinCandidateRange,
  type ApplicationStatus,
} from "@/lib/mock";

type DashboardRange = "Today" | "Y'day" | "Last 7 Days" | "Last 30 Days";
type CallTab = "overall" | "outbound" | "inbound";
type StatusPanelMode = "Unique" | "All";

function tabStyle(active: boolean): React.CSSProperties {
  return active
    ? { background: "#1D2433", color: "#FFFFFF" }
    : { color: "#4B5565" };
}

function dashTabStyle(active: boolean): React.CSSProperties {
  return active
    ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" }
    : { color: "#4B5565", borderBottom: "2px solid transparent" };
}

export default function DashboardPage() {
  const router = useRouter();
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>("Today");
  const [dashboardCallTab, setDashboardCallTab] = useState<CallTab>("overall");
  const [statusPanelMode, setStatusPanelMode] = useState<StatusPanelMode>("Unique");

  const candidates = useMemo(
    () => candidatesSeed.filter((c) => withinCandidateRange(c.createdOn, dashboardRange)),
    [dashboardRange]
  );
  const callLogs = useMemo(
    () => callLogsSeed.filter((l) => withinRange(l.calledAt, dashboardRange)),
    [dashboardRange]
  );

  const outboundLogs = useMemo(() => callLogs.filter((l) => l.type === "Outgoing"), [callLogs]);
  const inboundLogs = useMemo(() => callLogs.filter((l) => l.type === "Incoming"), [callLogs]);

  const callTabFiltered =
    dashboardCallTab === "outbound" ? outboundLogs : dashboardCallTab === "inbound" ? inboundLogs : callLogs;
  const tabTotal = callTabFiltered.length || 1;
  const tabConnected = callTabFiltered.filter((l) => l.disposition === "Connected").length;
  const tabNotConnected = callTabFiltered.length - tabConnected;
  const tabPersonal = 0;
  const tabConnectedDurations = callTabFiltered
    .filter((l) => l.disposition === "Connected")
    .map((l) => l.durationSeconds);
  const tabAvgSeconds = tabConnectedDurations.length
    ? Math.round(tabConnectedDurations.reduce((a, b) => a + b, 0) / tabConnectedDurations.length)
    : 0;
  const tabTotalSeconds = tabConnectedDurations.reduce((a, b) => a + b, 0);

  const missedCallsCount = callLogs.filter((l) => l.disposition !== "Connected").length;
  const pendingFollowupsCount = candidates.filter((c) => c.status === "interview_scheduled").length;
  const unassignedCount = candidates.filter((c) => c.recruiterId === null).length;

  const candTotal = candidates.length || 1;
  const startCount = candidates.filter((c) => c.status === "new").length;
  const closedWonCount = candidates.filter((c) =>
    (["selected", "joined"] as ApplicationStatus[]).includes(c.status)
  ).length;
  const closedLostCount = candidates.filter((c) =>
    (["rejected", "not_interested", "no_response"] as ApplicationStatus[]).includes(c.status)
  ).length;
  const inProgressCount = candidates.length - startCount - closedWonCount - closedLostCount;

  const bucket = (label: string, count: number, color: string) => ({
    label,
    count,
    color,
    pctLabel: Math.round((count / candTotal) * 100) + "%",
    pct: Math.max(2, Math.round((count / candTotal) * 100)) + "%",
  });
  const candidateStageBuckets = [
    bucket("Start", startCount, "#1A56DB"),
    bucket("In Progress", inProgressCount, "#B15C00"),
    bucket("Closed Won", closedWonCount, "#1E7F43"),
    bucket("Closed Lost", closedLostCount, "#C0392B"),
  ];

  const statusList = Object.keys(statusStyles).map((st) => ({
    label: statusStyles[st].label,
    count: candidates.filter((c) => c.status === st).length,
  }));

  const rangeBtnStyle: React.CSSProperties = {
    padding: "6px 14px",
    borderRadius: 6,
    fontSize: 12.5,
    cursor: "pointer",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>Dashboard</div>
        <div style={{ display: "flex", gap: 4, background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 8, padding: 3 }}>
          <div onClick={() => setDashboardRange("Today")} style={{ ...rangeBtnStyle, ...tabStyle(dashboardRange === "Today") }}>
            Today
          </div>
          <div onClick={() => setDashboardRange("Y'day")} style={{ ...rangeBtnStyle, ...tabStyle(dashboardRange === "Y'day") }}>
            Y&apos;day
          </div>
          <div onClick={() => setDashboardRange("Last 7 Days")} style={{ ...rangeBtnStyle, ...tabStyle(dashboardRange === "Last 7 Days") }}>
            Last 7 Days
          </div>
          <div onClick={() => setDashboardRange("Last 30 Days")} style={{ ...rangeBtnStyle, ...tabStyle(dashboardRange === "Last 30 Days") }}>
            Last 30 Days
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 20, marginBottom: 16, borderBottom: "1px solid #EEF0F4" }}>
              <div
                onClick={() => setDashboardCallTab("overall")}
                style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", ...dashTabStyle(dashboardCallTab === "overall") }}
              >
                Overall - {callLogs.length}
              </div>
              <div
                onClick={() => setDashboardCallTab("outbound")}
                style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", ...dashTabStyle(dashboardCallTab === "outbound") }}
              >
                Outbound - {outboundLogs.length}
              </div>
              <div
                onClick={() => setDashboardCallTab("inbound")}
                style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", ...dashTabStyle(dashboardCallTab === "inbound") }}
              >
                Inbound - {inboundLogs.length}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "#E6F4EA", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "#1D2433" }}>{tabConnected}</span>
                  <span style={{ fontSize: 12, color: "#1E7F43", fontWeight: 600 }}>{Math.round((tabConnected / tabTotal) * 100)}%</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Connected</div>
              </div>
              <div style={{ background: "#FDECEC", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "#1D2433" }}>{tabNotConnected}</span>
                  <span style={{ fontSize: 12, color: "#C0392B", fontWeight: 600 }}>{Math.round((tabNotConnected / tabTotal) * 100)}%</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Not Connected</div>
              </div>
              <div style={{ background: "#EEF0F5", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "#1D2433" }}>{tabPersonal}</span>
                  <span style={{ fontSize: 12, color: "#5B6472", fontWeight: 600 }}>0%</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Personal</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #EEF0F4", paddingTop: 14 }}>
              <div style={{ display: "flex", gap: 28 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1D2433" }}>{fmtDuration(tabAvgSeconds)}</div>
                  <div style={{ fontSize: 11.5, color: "#6B7280" }}>Avg Talk Time</div>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1D2433" }}>{fmtDuration(tabTotalSeconds)}</div>
                  <div style={{ fontSize: 11.5, color: "#6B7280" }}>Total Talk Time</div>
                </div>
              </div>
              <div onClick={() => router.push("/reports")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <rect x="1" y="9" width="3" height="5" fill="#9AA1AC" />
                  <rect x="6.5" y="5" width="3" height="9" fill="#9AA1AC" />
                  <rect x="12" y="2" width="3" height="12" fill="#9AA1AC" />
                </svg>
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <path d="M5 2l6 5-6 5" fill="none" stroke="#FF5C35" strokeWidth="1.6" />
                </svg>
              </div>
            </div>
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Open Actions</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div
                onClick={() => router.push("/assignment")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", cursor: "pointer" }}
              >
                <svg width="22" height="22" viewBox="0 0 16 16">
                  <rect x="2" y="1.5" width="10" height="13" rx="1.4" fill="none" stroke="#7C3AED" strokeWidth="1.3" />
                  <line x1="4.5" y1="5" x2="9.5" y2="5" stroke="#7C3AED" strokeWidth="1.2" />
                  <line x1="4.5" y1="8" x2="9.5" y2="8" stroke="#7C3AED" strokeWidth="1.2" />
                </svg>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1D2433" }}>{unassignedCount}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>Allocations</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px" }}>
                <svg width="22" height="22" viewBox="0 0 16 16">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="1.4" fill="none" stroke="#2563EB" strokeWidth="1.3" />
                  <path d="M4 8l2 2 4-4" fill="none" stroke="#2563EB" strokeWidth="1.3" />
                </svg>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1D2433" }}>{pendingFollowupsCount}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>Followups</div>
              </div>
              <div
                onClick={() => router.push("/call-logs")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", cursor: "pointer" }}
              >
                <svg width="22" height="22" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="6.2" fill="none" stroke="#C0392B" strokeWidth="1.3" />
                  <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#C0392B" strokeWidth="1.3" />
                </svg>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1D2433" }}>{missedCallsCount}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>Missed Calls</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Candidates</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingRight: 20, borderRight: "1px solid #EEF0F4" }}>
                <svg width="26" height="26" viewBox="0 0 16 16">
                  <circle cx="5.5" cy="5.5" r="2.4" fill="none" stroke="#4B5565" strokeWidth="1.2" />
                  <circle cx="11" cy="6.5" r="1.8" fill="none" stroke="#4B5565" strokeWidth="1.2" />
                </svg>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#1D2433" }}>{candidates.length}</div>
                <div style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap" }}>Total Candidates</div>
              </div>
              <div>
                {candidateStageBuckets.map((b) => (
                  <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 80, fontSize: 12.5, color: "#4B5565", flexShrink: 0 }}>{b.label}</div>
                    <div style={{ flex: 1, height: 7, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: b.color, borderRadius: 4, width: b.pct }} />
                    </div>
                    <div style={{ width: 36, textAlign: "right", fontSize: 12, color: "#9AA1AC" }}>{b.pctLabel}</div>
                    <div style={{ width: 22, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "#1D2433" }}>{b.count}</div>
                  </div>
                ))}
              </div>
            </div>
            <div onClick={() => router.push("/reports")} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, cursor: "pointer", marginTop: 8 }}>
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect x="1" y="9" width="3" height="5" fill="#9AA1AC" />
                <rect x="6.5" y="5" width="3" height="9" fill="#9AA1AC" />
                <rect x="12" y="2" width="3" height="12" fill="#9AA1AC" />
              </svg>
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path d="M5 2l6 5-6 5" fill="none" stroke="#FF5C35" strokeWidth="1.6" />
              </svg>
            </div>
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35" }}>Status</div>
              <select
                value={statusPanelMode}
                onChange={(e) => setStatusPanelMode(e.target.value as StatusPanelMode)}
                style={{ padding: "5px 8px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12, color: "#4B5565" }}
              >
                <option value="Unique">Unique</option>
                <option value="All">All</option>
              </select>
            </div>
            <div style={{ maxHeight: 230, overflowY: "auto" }}>
              {statusList.map((st) => (
                <div key={st.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #F4F5F8" }}>
                  <span style={{ fontSize: 12.5, color: "#4B5565" }}>{st.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{st.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
