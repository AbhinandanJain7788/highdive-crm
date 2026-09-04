"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalyticsOverall, TopUserRow, LoginAnalytics, AnalyticsRangeKey, CustomersByField, CustomersByGroup } from "@/lib/analytics.shared";

const CUSTOMERS_BY_FIELDS: { key: CustomersByField; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
  { key: "recruiter", label: "Recruiter" },
  { key: "job", label: "Job" },
];

type AnalyticsTab = "overall" | "aiCall" | "userPerf";
type CallTrendsMode = "overall" | "outbound" | "inbound";

const RANGE_OPTIONS: { key: AnalyticsRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
];

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16">
      <rect x="2" y="2" width="12" height="12" rx="2" fill="#E8F0FE" />
      <path d="M8 5v5M6 8l2 2 2-2" stroke="#1A56DB" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

function RangeSelect({ value, onChange, small }: { value: AnalyticsRangeKey; onChange: (v: AnalyticsRangeKey) => void; small?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AnalyticsRangeKey)}
      style={{ padding: small ? "6px 10px" : "7px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: small ? 12 : 12.5, color: "#4B5565", background: "#FFFFFF" }}
    >
      {RANGE_OPTIONS.map((r) => (
        <option key={r.key} value={r.key}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

const DONUT_COLORS = ["#2563EB", "#FF8A50", "#2FB6C4", "#3B2E8A"];

export default function AnalyticsClient({
  initialOverall,
  initialTopUsers,
  initialLogin,
}: {
  initialOverall: AnalyticsOverall;
  initialTopUsers: TopUserRow[];
  initialLogin: LoginAnalytics;
}) {
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("overall");
  const [range, setRange] = useState<AnalyticsRangeKey>("today");
  const [callTrendsMode, setCallTrendsMode] = useState<CallTrendsMode>("overall");
  const [templateId, setTemplateId] = useState<string | null>(initialOverall.activeTemplateId);
  const [customersByField, setCustomersByField] = useState<CustomersByField | "">("");
  const [customersBy, setCustomersBy] = useState<CustomersByGroup[]>([]);
  const [customersByLoading, setCustomersByLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<TopUserRow[] | null>(null);
  const [allUsersLoading, setAllUsersLoading] = useState(false);

  const [overall, setOverall] = useState<AnalyticsOverall>(initialOverall);
  const [topUsers, setTopUsers] = useState<TopUserRow[]>(initialTopUsers);
  const [login, setLogin] = useState<LoginAnalytics>(initialLogin);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const templateParam = templateId ? `&templateId=${templateId}` : "";
        const [overallRes, topUsersRes, loginRes] = await Promise.all([
          fetch(`/api/analytics/overall?range=${range}${templateParam}`, { signal: controller.signal }),
          fetch(`/api/analytics/top-users?range=${range}`, { signal: controller.signal }),
          fetch(`/api/analytics/login?range=${range}`, { signal: controller.signal }),
        ]);
        if (!overallRes.ok || !topUsersRes.ok || !loginRes.ok) throw new Error("Could not load analytics.");
        const [overallBody, topUsersBody, loginBody] = await Promise.all([overallRes.json(), topUsersRes.json(), loginRes.json()]);
        setOverall(overallBody.data);
        if (!templateId) setTemplateId(overallBody.data.activeTemplateId);
        setTopUsers(topUsersBody.data);
        setLogin(loginBody.data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setLoadError(err instanceof Error ? err.message : "Could not load analytics.");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [range, templateId]);

  useEffect(() => {
    if (!customersByField) {
      setCustomersBy([]);
      return;
    }
    const controller = new AbortController();
    setCustomersByLoading(true);
    fetch(`/api/analytics/customers-by?range=${range}&field=${customersByField}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => setCustomersBy(body.data ?? []))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setCustomersBy([]);
      })
      .finally(() => setCustomersByLoading(false));
    return () => controller.abort();
  }, [customersByField, range]);

  useEffect(() => {
    if (analyticsTab !== "userPerf") return;
    const controller = new AbortController();
    setAllUsersLoading(true);
    fetch(`/api/analytics/top-users?range=${range}&all=true`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => setAllUsers(body.data ?? []))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setAllUsers([]);
      })
      .finally(() => setAllUsersLoading(false));
    return () => controller.abort();
  }, [analyticsTab, range]);

  const analyticsTabStyle = (active: boolean): React.CSSProperties =>
    active ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" } : { color: "#4B5565" };
  const callTrendsModeStyle = (active: boolean): React.CSSProperties =>
    active ? { background: "#FFFFFF", color: "#1D2433", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" } : { color: "#6B7280" };

  const points = overall.callTrends.points;
  const trendMax = Math.max(1, ...points.map((p) => p.total));
  const trendYAxis = [trendMax, Math.round((trendMax * 2) / 3), Math.round(trendMax / 3), 0];

  const talkPoints = overall.talkTime.points;
  const talkMax = Math.max(1, ...talkPoints.map((p) => p.minutes), overall.talkTime.avgMinutes);
  const talkYAxis = [talkMax, Math.round((talkMax * 2) / 3), Math.round(talkMax / 3), 0];
  const avgLinePct = Math.min(100, Math.round((overall.talkTime.avgMinutes / talkMax) * 100));

  const modeSeries = (p: (typeof points)[number]) => (callTrendsMode === "outbound" ? p.outbound : callTrendsMode === "inbound" ? p.inbound : p.total);

  const stages = overall.customerStages.stages;
  const donutStops = (() => {
    let acc = 0;
    return stages.map((s, i) => {
      const start = acc;
      acc += s.pct;
      return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${acc}%`;
    });
  })();
  const donutGradient = stages.every((s) => s.count === 0) ? "conic-gradient(#EEF0F5 0% 100%)" : `conic-gradient(${donutStops.join(",")})`;

  const funnel = overall.conversionFunnel;
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

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
      </div>

      {loadError && (
        <div style={{ background: "#FDECEC", color: "#C0392B", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, marginBottom: 12 }}>{loadError}</div>
      )}

      {analyticsTab === "overall" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 18, opacity: loading ? 0.6 : 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4B5565", letterSpacing: 0.4 }}>CALL TRENDS</span>
                  <InfoIcon />
                </div>
                <RangeSelect value={range} onChange={setRange} />
              </div>
              <div style={{ display: "flex", gap: 4, background: "#F4F5F8", borderRadius: 8, padding: 3, width: "fit-content", marginBottom: 16 }}>
                {(["overall", "outbound", "inbound"] as CallTrendsMode[]).map((m) => (
                  <div
                    key={m}
                    onClick={() => setCallTrendsMode(m)}
                    style={{ padding: "6px 16px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", ...callTrendsModeStyle(callTrendsMode === m) }}
                  >
                    {m}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12.5, color: "#9AA1AC", marginBottom: 4 }}>Total Calls</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#1D2433", marginBottom: 12 }}>{overall.callTrends.totalCalls}</div>
              <div style={{ display: "flex", gap: 8, height: 180, position: "relative", borderTop: "1px solid #F0F1F5" }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "4px 0" }}>
                  {trendYAxis.map((yv, i) => (
                    <span key={i} style={{ fontSize: 11, color: "#9AA1AC" }}>
                      {yv}
                    </span>
                  ))}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: points.length > 10 ? 1 : 3 }}>
                  {points.map((p, i) => {
                    const v = modeSeries(p);
                    const pct = Math.round((v / trendMax) * 100);
                    return (
                      <div key={i} title={`${p.label}: ${v}`} style={{ flex: 1, display: "flex", flexDirection: "column-reverse", height: "100%" }}>
                        <div style={{ height: `${pct}%`, background: "#4C7AE0", borderRadius: "1px 1px 0 0" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", gap: points.length > 10 ? 1 : 10, paddingLeft: 26, marginTop: 2 }}>
                {points.map((p, i) => (
                  <span key={i} style={{ flex: 1, fontSize: points.length > 10 ? 8 : 9.5, color: "#B7BCC6", textAlign: "center", whiteSpace: "nowrap" }}>
                    {points.length > 14 && i % 3 !== 0 ? "" : p.label}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 24, marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4B5565" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF8A50" }} />
                  Connected <b style={{ color: "#1D2433" }}>{overall.callTrends.connectedTotal}</b> {overall.callTrends.connectedPct}%
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4B5565" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4C7AE0" }} />
                  Not Connected <b style={{ color: "#1D2433" }}>{overall.callTrends.notConnectedTotal}</b> {overall.callTrends.notConnectedPct}%
                </div>
              </div>
              <div style={{ borderTop: "1px solid #F0F1F5", marginTop: 18, paddingTop: 16 }}>
                <div style={{ fontSize: 12.5, color: "#9AA1AC", marginBottom: 4 }}>Total Talk Time</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#1D2433", marginBottom: 14 }}>{overall.talkTime.totalLabel}</div>
                <div style={{ display: "flex", gap: 8, height: 150, position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "4px 0" }}>
                    {talkYAxis.map((ty, i) => (
                      <span key={i} style={{ fontSize: 11, color: "#9AA1AC" }}>
                        {ty}m
                      </span>
                    ))}
                  </div>
                  <div style={{ flex: 1, position: "relative" }}>
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: `${avgLinePct}%`, borderTop: "1px dashed #C9CED6" }} />
                    <span style={{ position: "absolute", left: 2, bottom: `${avgLinePct}%`, fontSize: 10.5, color: "#9AA1AC" }}>
                      avg({overall.talkTime.avgMinutes})
                    </span>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: talkPoints.length > 10 ? 1 : 3, height: "100%" }}>
                      {talkPoints.map((tp, i) => (
                        <div key={i} title={`${tp.label}: ${tp.minutes}m`} style={{ flex: 1, height: `${Math.round((tp.minutes / talkMax) * 100)}%`, background: "#3D9DA8", borderRadius: "1px 1px 0 0" }} />
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4B5565", marginTop: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3D9DA8" }} />
                  Total Talk time
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
              <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#4B5565", letterSpacing: 0.4, marginBottom: 14 }}>LOGIN ANALYTICS</div>
                <div style={{ marginBottom: 16 }}>
                  <RangeSelect value={range} onChange={setRange} small />
                </div>
                <div style={{ fontSize: 12.5, color: "#4B5565", marginBottom: 2 }}>Login Duration</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1D2433", marginBottom: 14 }}>{login.loginDurationLabel}</div>
                {[
                  { label: "Wrap up Time", value: login.wrapUpLabel, dotColor: "#2563EB" },
                  { label: "Break Time", value: login.breakLabel, dotColor: "#FF8A50" },
                  { label: "Idle Time", value: login.idleLabel, dotColor: "#F5A623" },
                ].map((lr) => (
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
                  <RangeSelect value={range} onChange={setRange} small />
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
                  <div>Total Calls</div>
                  <div>Inbound Calls</div>
                </div>
                {topUsers.length === 0 && <div style={{ padding: "20px 0", fontSize: 12.5, color: "#9AA1AC" }}>No calls in this range yet.</div>}
                {topUsers.map((up) => (
                  <div key={up.userId} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10, padding: "11px 0", borderBottom: "1px solid #F4F5F8", whiteSpace: "nowrap" }}>
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
                <RangeSelect value={range} onChange={setRange} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
                <div style={{ background: "#FAFBFC", border: "1px solid #EEF0F4", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "#9AA1AC" }}>All Stages</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#1D2433" }}>{overall.customerStages.total}</div>
                </div>
                {stages.map((sc, i) => (
                  <div key={sc.key} style={{ background: "#FAFBFC", border: "1px solid #EEF0F4", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: "#9AA1AC" }}>{sc.label}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ fontSize: 17, fontWeight: 700, color: "#1D2433" }}>{sc.count}</span>
                      <span style={{ fontSize: 11, color: "#9AA1AC" }}>{sc.pct}%</span>
                    </div>
                    <div style={{ height: 3, background: DONUT_COLORS[i % DONUT_COLORS.length], borderRadius: 2, marginTop: 6 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 36, justifyContent: "center", padding: "10px 0" }}>
                <div style={{ width: 200, height: 200, borderRadius: "50%", background: donutGradient, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 104, height: 104, borderRadius: "50%", background: "#FFFFFF" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {stages.map((lg, i) => (
                    <div key={lg.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4B5565" }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
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
              <div style={{ marginBottom: 18, display: "flex", gap: 8 }}>
                {overall.pipelineTemplates.length > 1 && (
                  <select
                    value={templateId ?? ""}
                    onChange={(e) => setTemplateId(e.target.value)}
                    style={{ padding: "7px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, color: "#4B5565", background: "#FFFFFF" }}
                  >
                    {overall.pipelineTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                <RangeSelect value={range} onChange={setRange} />
              </div>
              {funnel.length === 0 ? (
                <div style={{ fontSize: 12.5, color: "#9AA1AC", textAlign: "center", padding: "16px 0" }}>No pipeline data.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  {funnel.map((fs) => {
                    const widthPct = Math.max(fs.count > 0 ? 8 : 0, Math.round((fs.count / funnelMax) * 100));
                    return (
                      <div key={fs.id} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
                        <span style={{ width: 110, fontSize: 12.5, color: "#4B5565" }}>{fs.name}</span>
                        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                          <div style={{ width: `${widthPct}%`, height: 28, background: "#4C7AE0", clipPath: "polygon(8% 0,92% 0,100% 100%,0% 100%)" }} />
                        </div>
                        <span style={{ width: 30, textAlign: "right", fontSize: 12.5, color: "#4B5565" }}>{fs.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4B5565", letterSpacing: 0.4 }}>CUSTOMERS BY</span>
                  <InfoIcon />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={customersByField}
                    onChange={(e) => setCustomersByField(e.target.value as CustomersByField | "")}
                    style={{ padding: "7px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, color: "#4B5565", background: "#FFFFFF" }}
                  >
                    <option value="">Select Field</option>
                    {CUSTOMERS_BY_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <RangeSelect value={range} onChange={setRange} />
                </div>
              </div>
              {!customersByField ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "30px 0" }}>
                  <svg width="60" height="60" viewBox="0 0 60 60">
                    <rect x="8" y="20" width="26" height="34" rx="2" fill="none" stroke="#D9DCE3" strokeWidth="2" />
                    <rect x="20" y="10" width="26" height="34" rx="2" fill="#FAFBFC" stroke="#D9DCE3" strokeWidth="2" />
                    <circle cx="33" cy="20" r="5" fill="none" stroke="#FF9F80" strokeWidth="2" />
                    <path d="M31 20l2 2 3-4" stroke="#FF9F80" strokeWidth="1.6" fill="none" />
                  </svg>
                  <div style={{ fontSize: 13, color: "#9AA1AC" }}>No data to display</div>
                </div>
              ) : customersByLoading ? (
                <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "30px 0" }}>Loading…</div>
              ) : customersBy.length === 0 ? (
                <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "30px 0" }}>No candidates in this range.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(() => {
                    const max = Math.max(1, ...customersBy.map((g) => g.count));
                    return customersBy.map((g) => (
                      <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 120, fontSize: 12.5, color: "#4B5565", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
                        <div style={{ flex: 1, height: 10, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", background: "#2FB6C4", borderRadius: 4, width: `${Math.max(4, Math.round((g.count / max) * 100))}%` }} />
                        </div>
                        <span style={{ width: 26, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "#1D2433" }}>{g.count}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
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
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #EEF0F4" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#4B5565", letterSpacing: 0.4 }}>USER PERFORMANCE</span>
            <RangeSelect value={range} onChange={setRange} small />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, padding: "8px 20px", fontSize: 11.5, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", borderBottom: "1px solid #EEF0F4" }}>
            <div>User</div>
            <div>Total Calls</div>
            <div>Outbound</div>
            <div>Inbound</div>
          </div>
          {allUsersLoading ? (
            <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "30px 0" }}>Loading…</div>
          ) : (allUsers ?? []).length === 0 ? (
            <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "30px 0" }}>No call activity in this range.</div>
          ) : (
            (allUsers ?? []).map((u) => (
              <div key={u.userId} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, alignItems: "center", padding: "10px 20px", borderBottom: "1px solid #F4F5F8" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{u.name}</div>
                <div style={{ fontSize: 13, color: "#1D2433" }}>{u.total}</div>
                <div style={{ fontSize: 13, color: "#4B5565" }}>{u.total - u.inbound}</div>
                <div style={{ fontSize: 13, color: "#4B5565" }}>{u.inbound}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
