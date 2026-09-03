"use client";

import { useState } from "react";

type AnalyticsTab = "overall" | "aiCall" | "userPerf";
type AnalyticsRange = "Today" | "Last 7 Days" | "Last 30 Days";
type CallTrendsMode = "overall" | "outbound" | "inbound";

// All figures below are hard-coded literals lifted verbatim from the source prototype's
// component (hourlyCallVolume / hourlyConnectedShare / hourlyTalkMinutes / customerStageCards /
// funnelStages / topUserPerformances / loginAnalyticsRows) — the source itself does not derive
// them from its own candidatesSeed/callLogsSeed, so hard-coding here keeps the screen pixel-for-
// pixel faithful rather than inventing different numbers from the 14-row Phase 1 mock data.
const hourlyCallVolume = [0, 0, 0, 0, 0, 0, 0, 4, 16, 96, 158, 205, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const hourlyConnectedShare = [0, 0, 0, 0, 0, 0, 0, 0.15, 0.3, 0.62, 0.66, 0.66, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const hourlyTalkMinutes = [0, 0, 0, 0, 0, 0, 0, 0, 4, 58, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const callTrendsXLabels = Array.from({ length: 24 }, (_, i) => `${i}h`);
const callTrendsYAxis = ["210", "140", "70", "0"];
const talkTimeYAxis = ["90m", "60m", "30m", "0m"];
const totalTalkTimeAnalytics = "1h 58m";
const analyticsDayLabel = "27 Aug, Thu";

const customerStageCards = [
  { label: "Start", count: 70, pct: 42, color: "#2563EB" },
  { label: "In Progress", count: 66, pct: 40, color: "#FF8A50" },
  { label: "Closed Won", count: 0, pct: 0, color: "#2FB6C4" },
  { label: "Closed Lost", count: 29, pct: 18, color: "#3B2E8A" },
];
const stageAllCount = 165;
const donutGradient = "conic-gradient(#2563EB 0% 42%, #FF8A50 42% 82%, #3B2E8A 82% 100%)";
const funnelStages = [
  { label: "Start", pct: 42, width: "100%", color: "#4C7AE0" },
  { label: "In Progress", pct: 40, width: "62%", color: "#7FA3EC" },
];
const loginAnalyticsRows = [
  { label: "Wrap up Time", value: "2h 52m", dotColor: "#2563EB" },
  { label: "Break Time", value: "0m 0s", dotColor: "#FF8A50" },
  { label: "Idle Time", value: "--", dotColor: "#F5A623" },
];
const topUserPerformances = [
  { name: "Drishti", total: 49, inbound: 7 },
  { name: "Jaspreet", total: 48, inbound: 5 },
  { name: "Sahreen", total: 47, inbound: 4 },
  { name: "Harsh", total: 45, inbound: 3 },
  { name: "Nanika", total: 41, inbound: 3 },
];

const ctMax = 210;
const totalCallsAnalytics = hourlyCallVolume.reduce((a, b) => a + b, 0);
const connectedTotal = Math.round(hourlyCallVolume.reduce((a, v, i) => a + v * hourlyConnectedShare[i], 0));
const notConnectedTotal = totalCallsAnalytics - connectedTotal;
const connectedPctLabel = Math.round((connectedTotal / totalCallsAnalytics) * 100);
const notConnectedPctLabel = Math.round((notConnectedTotal / totalCallsAnalytics) * 100);
const callTrendsBars = hourlyCallVolume.map((v, i) => {
  const connected = v * hourlyConnectedShare[i];
  const notConnected = v - connected;
  return {
    connectedPct: `${Math.round((connected / ctMax) * 100)}%`,
    notConnectedPct: `${Math.round((notConnected / ctMax) * 100)}%`,
  };
});
const talkTimeBars = hourlyTalkMinutes.map((v) => ({ pct: `${Math.round((v / 90) * 100)}%` }));

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16">
      <rect x="2" y="2" width="12" height="12" rx="2" fill="#E8F0FE" />
      <path d="M8 5v5M6 8l2 2 2-2" stroke="#1A56DB" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

function NotificationBell() {
  return (
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
  );
}

function RangeSelect({
  value,
  onChange,
  small,
}: {
  value: AnalyticsRange;
  onChange: (v: AnalyticsRange) => void;
  small?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AnalyticsRange)}
      style={{
        padding: small ? "6px 10px" : "7px 10px",
        border: "1px solid #D9DCE3",
        borderRadius: 6,
        fontSize: small ? 12 : 12.5,
        color: "#4B5565",
        background: "#FFFFFF",
      }}
    >
      <option value="Today">Today</option>
      <option value="Last 7 Days">Last 7 Days</option>
      {!small && <option value="Last 30 Days">Last 30 Days</option>}
    </select>
  );
}

export default function AnalyticsPage() {
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("overall");
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>("Today");
  const [callTrendsMode, setCallTrendsMode] = useState<CallTrendsMode>("overall");

  const analyticsTabStyle = (active: boolean): React.CSSProperties =>
    active ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" } : { color: "#4B5565" };

  const callTrendsModeStyle = (active: boolean): React.CSSProperties =>
    active ? { background: "#FFFFFF", color: "#1D2433", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" } : { color: "#6B7280" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 32, borderBottom: "2px solid transparent" }}>
          <div onClick={() => setAnalyticsTab("overall")} style={{ paddingBottom: 10, fontSize: 16, fontWeight: 700, cursor: "pointer", ...analyticsTabStyle(analyticsTab === "overall") }}>
            Overall Analytics
          </div>
          <div onClick={() => setAnalyticsTab("aiCall")} style={{ paddingBottom: 10, fontSize: 16, fontWeight: 700, cursor: "pointer", ...analyticsTabStyle(analyticsTab === "aiCall") }}>
            AI Call Analytics
          </div>
          <div onClick={() => setAnalyticsTab("userPerf")} style={{ paddingBottom: 10, fontSize: 16, fontWeight: 700, cursor: "pointer", ...analyticsTabStyle(analyticsTab === "userPerf") }}>
            User Performance
          </div>
        </div>
        <NotificationBell />
      </div>

      {analyticsTab === "overall" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4B5565", letterSpacing: 0.4 }}>CALL TRENDS</span>
                  <InfoIcon />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select style={{ padding: "7px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, color: "#4B5565", background: "#FFFFFF" }}>
                    <option>All</option>
                  </select>
                  <RangeSelect value={analyticsRange} onChange={setAnalyticsRange} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, background: "#F4F5F8", borderRadius: 8, padding: 3, width: "fit-content", marginBottom: 16 }}>
                <div onClick={() => setCallTrendsMode("overall")} style={{ padding: "6px 16px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", ...callTrendsModeStyle(callTrendsMode === "overall") }}>
                  Overall
                </div>
                <div onClick={() => setCallTrendsMode("outbound")} style={{ padding: "6px 16px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", ...callTrendsModeStyle(callTrendsMode === "outbound") }}>
                  Outbound
                </div>
                <div onClick={() => setCallTrendsMode("inbound")} style={{ padding: "6px 16px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", ...callTrendsModeStyle(callTrendsMode === "inbound") }}>
                  Inbound
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "#9AA1AC", marginBottom: 4 }}>Total Calls</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#1D2433", marginBottom: 12 }}>{totalCallsAnalytics}</div>
              <div style={{ display: "flex", gap: 8, height: 180, position: "relative", borderTop: "1px solid #F0F1F5" }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "4px 0" }}>
                  {callTrendsYAxis.map((yv) => (
                    <span key={yv} style={{ fontSize: 11, color: "#9AA1AC" }}>
                      {yv}
                    </span>
                  ))}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3 }}>
                  {callTrendsBars.map((hb, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column-reverse", height: "100%" }}>
                      <div style={{ height: hb.connectedPct, background: "#FF8A50", borderRadius: "1px 1px 0 0" }} />
                      <div style={{ height: hb.notConnectedPct, background: "#4C7AE0", borderRadius: "1px 1px 0 0" }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, paddingLeft: 26, marginTop: 2 }}>
                {callTrendsXLabels.map((xl) => (
                  <span key={xl} style={{ flex: 1, fontSize: 9.5, color: "#B7BCC6", textAlign: "center" }}>
                    {xl}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: "#4B5565", margin: "10px 0 14px" }}>{analyticsDayLabel}</div>
              <div style={{ display: "flex", gap: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4B5565" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF8A50" }} />
                  Connected <b style={{ color: "#1D2433" }}>{connectedTotal}</b> {connectedPctLabel}%
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4B5565" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4C7AE0" }} />
                  Not Connected <b style={{ color: "#1D2433" }}>{notConnectedTotal}</b> {notConnectedPctLabel}%
                </div>
              </div>
              <div style={{ borderTop: "1px solid #F0F1F5", marginTop: 18, paddingTop: 16 }}>
                <div style={{ fontSize: 12.5, color: "#9AA1AC", marginBottom: 4 }}>Total Talk Time</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#1D2433", marginBottom: 14 }}>{totalTalkTimeAnalytics}</div>
                <div style={{ display: "flex", gap: 8, height: 150, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "4px 0" }}>
                    {talkTimeYAxis.map((ty) => (
                      <span key={ty} style={{ fontSize: 11, color: "#9AA1AC" }}>
                        {ty}
                      </span>
                    ))}
                  </div>
                  <div style={{ flex: 1, position: "relative" }}>
                    <div style={{ position: "absolute", left: 0, right: 0, top: "38%", borderTop: "1px dashed #C9CED6" }} />
                    <span style={{ position: "absolute", left: 2, top: "30%", fontSize: 10.5, color: "#9AA1AC" }}>avg(39.3)</span>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: "100%" }}>
                      {talkTimeBars.map((tb, i) => (
                        <div key={i} style={{ flex: 1, height: tb.pct, background: "#3D9DA8", borderRadius: "1px 1px 0 0" }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, paddingLeft: 26, marginTop: 2 }}>
                  {callTrendsXLabels.map((xl2) => (
                    <span key={xl2} style={{ flex: 1, fontSize: 9.5, color: "#B7BCC6", textAlign: "center" }}>
                      {xl2}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12.5, color: "#4B5565", margin: "10px 0 6px" }}>{analyticsDayLabel}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4B5565" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3D9DA8" }} />
                  Total Talk time
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
              <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#4B5565", letterSpacing: 0.4, marginBottom: 14 }}>LOGIN ANALYTICS</div>
                <div style={{ marginBottom: 16 }}>
                  <RangeSelect value={analyticsRange} onChange={setAnalyticsRange} small />
                </div>
                <div style={{ fontSize: 12.5, color: "#4B5565", marginBottom: 2 }}>Login Duration</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1D2433", marginBottom: 14 }}>--</div>
                {loginAnalyticsRows.map((lr) => (
                  <div key={lr.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid #F4F5F8" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#4B5565" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: lr.dotColor }} />
                      {lr.label}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{lr.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20, overflowX: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#4B5565", letterSpacing: 0.4 }}>TOP 5 USER PERFORMANCES</span>
                    <InfoIcon />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select style={{ padding: "6px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12, color: "#4B5565", background: "#FFFFFF" }}>
                      <option>All</option>
                    </select>
                    <RangeSelect value={analyticsRange} onChange={setAnalyticsRange} small />
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr",
                    gap: 10,
                    padding: "8px 0",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#9AA1AC",
                    textTransform: "uppercase",
                    borderBottom: "1px solid #EEF0F4",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div>Agent Name</div>
                  <div>Total Calls ↑</div>
                  <div>Inbound Calls ↑</div>
                </div>
                {topUserPerformances.map((up) => (
                  <div key={up.name} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10, padding: "11px 0", borderBottom: "1px solid #F4F5F8", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{up.name}</div>
                    <div style={{ fontSize: 13, color: "#4B5565" }}>{up.total}</div>
                    <div style={{ fontSize: 13, color: "#4B5565" }}>{up.inbound}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4B5565", letterSpacing: 0.4 }}>CUSTOMER STAGES</span>
                  <InfoIcon />
                </div>
                <RangeSelect value={analyticsRange} onChange={setAnalyticsRange} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
                <div style={{ background: "#FAFBFC", border: "1px solid #EEF0F4", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "#9AA1AC" }}>All Stages</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#1D2433" }}>{stageAllCount}</div>
                </div>
                {customerStageCards.map((sc) => (
                  <div key={sc.label} style={{ background: "#FAFBFC", border: "1px solid #EEF0F4", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: "#9AA1AC" }}>{sc.label}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ fontSize: 17, fontWeight: 700, color: "#1D2433" }}>{sc.count}</span>
                      <span style={{ fontSize: 11, color: "#9AA1AC" }}>{sc.pct}%</span>
                    </div>
                    <div style={{ height: 3, background: sc.color, borderRadius: 2, marginTop: 6 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 36, justifyContent: "center", padding: "10px 0" }}>
                <div style={{ width: 200, height: 200, borderRadius: "50%", background: donutGradient, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 104, height: 104, borderRadius: "50%", background: "#FFFFFF" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {customerStageCards.map((lg) => (
                    <div key={lg.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4B5565" }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: lg.color }} />
                      {lg.label}: <b style={{ color: "#1D2433" }}>{lg.count}</b> {lg.pct}%
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#4B5565", letterSpacing: 0.4 }}>CONVERSION FUNNEL</span>
              </div>
              <div style={{ marginBottom: 18 }}>
                <RangeSelect value={analyticsRange} onChange={setAnalyticsRange} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                {funnelStages.map((fs) => (
                  <div key={fs.label} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
                    <span style={{ width: 80, fontSize: 12.5, color: "#4B5565" }}>{fs.label}</span>
                    <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                      <div style={{ width: fs.width, height: 34, background: fs.color, clipPath: "polygon(8% 0,92% 0,100% 100%,0% 100%)" }} />
                    </div>
                    <span style={{ width: 44, textAlign: "right", fontSize: 12.5, color: "#4B5565" }}>{fs.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4B5565", letterSpacing: 0.4 }}>CUSTOMERS BY</span>
                  <InfoIcon />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select style={{ padding: "7px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, color: "#4B5565", background: "#FFFFFF" }}>
                    <option>Select Field</option>
                  </select>
                  <RangeSelect value={analyticsRange} onChange={setAnalyticsRange} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "30px 0" }}>
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <rect x="8" y="20" width="26" height="34" rx="2" fill="none" stroke="#D9DCE3" strokeWidth="2" />
                  <rect x="20" y="10" width="26" height="34" rx="2" fill="#FAFBFC" stroke="#D9DCE3" strokeWidth="2" />
                  <circle cx="33" cy="20" r="5" fill="none" stroke="#FF9F80" strokeWidth="2" />
                  <path d="M31 20l2 2 3-4" stroke="#FF9F80" strokeWidth="1.6" fill="none" />
                </svg>
                <div style={{ fontSize: 13, color: "#9AA1AC" }}>No data to display</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {analyticsTab === "aiCall" && (
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 60, textAlign: "center", fontSize: 13, color: "#9AA1AC" }}>
          AI Call Analytics coming soon.
        </div>
      )}
      {analyticsTab === "userPerf" && (
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 60, textAlign: "center", fontSize: 13, color: "#9AA1AC" }}>
          User Performance report coming soon.
        </div>
      )}
    </div>
  );
}
