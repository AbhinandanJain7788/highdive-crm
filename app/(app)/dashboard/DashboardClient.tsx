"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDuration } from "@/lib/mock";
import type { DashboardData, DashboardRangeKey } from "@/lib/dashboard.shared";

type CallTab = "overall" | "outbound" | "inbound";

const RANGE_TABS: { key: DashboardRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Y'day" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
];

function tabStyle(active: boolean): React.CSSProperties {
  return active ? { background: "#1D2433", color: "#FFFFFF" } : { color: "#4B5565" };
}

function dashTabStyle(active: boolean): React.CSSProperties {
  return active ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" } : { color: "#4B5565", borderBottom: "2px solid transparent" };
}

const STAGE_COLORS: Record<string, string> = {
  Start: "#1A56DB",
  "In Progress": "#B15C00",
  "Closed Won": "#1E7F43",
  "Closed Lost": "#C0392B",
};

export default function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const [range, setRange] = useState<DashboardRangeKey>("today");
  const [callTab, setCallTab] = useState<CallTab>("overall");
  const [data, setData] = useState<DashboardData>(initialData);
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
        const res = await fetch(`/api/dashboard?range=${range}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Could not load dashboard.");
        const body = await res.json();
        setData(body.data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setLoadError(err instanceof Error ? err.message : "Could not load dashboard.");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [range]);

  const bucket = data.calls[callTab];
  const candTotal = data.candidates.total || 1;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>Dashboard</div>
        <div style={{ display: "flex", gap: 4, background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 8, padding: 3 }}>
          {RANGE_TABS.map((r) => (
            <div
              key={r.key}
              onClick={() => setRange(r.key)}
              style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12.5, cursor: "pointer", ...tabStyle(range === r.key) }}
            >
              {r.label}
            </div>
          ))}
        </div>
      </div>

      {loadError && (
        <div style={{ background: "#FDECEC", color: "#C0392B", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, marginBottom: 12 }}>
          {loadError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start", opacity: loading ? 0.6 : 1 }}>
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 20, marginBottom: 16, borderBottom: "1px solid #EEF0F4" }}>
              <div onClick={() => setCallTab("overall")} style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", ...dashTabStyle(callTab === "overall") }}>
                Overall - {data.calls.overall.total}
              </div>
              <div onClick={() => setCallTab("outbound")} style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", ...dashTabStyle(callTab === "outbound") }}>
                Outbound - {data.calls.outbound.total}
              </div>
              <div onClick={() => setCallTab("inbound")} style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", ...dashTabStyle(callTab === "inbound") }}>
                Inbound - {data.calls.inbound.total}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "#E6F4EA", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "#1D2433" }}>{bucket.connected}</span>
                  <span style={{ fontSize: 12, color: "#1E7F43", fontWeight: 600 }}>{bucket.connectedPct}%</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Connected</div>
              </div>
              <div style={{ background: "#FDECEC", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "#1D2433" }}>{bucket.notConnected}</span>
                  <span style={{ fontSize: 12, color: "#C0392B", fontWeight: 600 }}>{bucket.notConnectedPct}%</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Not Connected</div>
              </div>
              <div style={{ background: "#EEF0F5", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "#1D2433" }}>{bucket.personal}</span>
                  <span style={{ fontSize: 12, color: "#5B6472", fontWeight: 600 }}>{bucket.personalPct}%</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>Personal</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #EEF0F4", paddingTop: 14 }}>
              <div style={{ display: "flex", gap: 28 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1D2433" }}>{fmtDuration(bucket.avgTalkSeconds)}</div>
                  <div style={{ fontSize: 11.5, color: "#6B7280" }}>Avg Talk Time</div>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1D2433" }}>{fmtDuration(bucket.totalTalkSeconds)}</div>
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
                onClick={() => router.push("/allocations")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", cursor: "pointer" }}
              >
                <svg width="22" height="22" viewBox="0 0 16 16">
                  <rect x="2" y="1.5" width="10" height="13" rx="1.4" fill="none" stroke="#7C3AED" strokeWidth="1.3" />
                  <line x1="4.5" y1="5" x2="9.5" y2="5" stroke="#7C3AED" strokeWidth="1.2" />
                  <line x1="4.5" y1="8" x2="9.5" y2="8" stroke="#7C3AED" strokeWidth="1.2" />
                </svg>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1D2433" }}>{data.openActions.unassigned}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>Allocations</div>
              </div>
              <div
                onClick={() => router.push("/follow-ups")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", cursor: "pointer" }}
              >
                <svg width="22" height="22" viewBox="0 0 16 16">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="1.4" fill="none" stroke="#2563EB" strokeWidth="1.3" />
                  <path d="M4 8l2 2 4-4" fill="none" stroke="#2563EB" strokeWidth="1.3" />
                </svg>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1D2433" }}>{data.openActions.pendingFollowUps}</div>
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
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1D2433" }}>{data.openActions.missedCalls}</div>
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
                <div style={{ fontSize: 22, fontWeight: 700, color: "#1D2433" }}>{data.candidates.total}</div>
                <div style={{ fontSize: 11, color: "#6B7280", whiteSpace: "nowrap" }}>Total Candidates</div>
              </div>
              <div>
                {data.candidates.stageBuckets.map((b) => (
                  <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 80, fontSize: 12.5, color: "#4B5565", flexShrink: 0 }}>{b.label}</div>
                    <div style={{ flex: 1, height: 7, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          background: STAGE_COLORS[b.label] ?? "#9AA1AC",
                          borderRadius: 4,
                          width: `${Math.max(b.count > 0 ? 2 : 0, Math.round((b.count / candTotal) * 100))}%`,
                        }}
                      />
                    </div>
                    <div style={{ width: 36, textAlign: "right", fontSize: 12, color: "#9AA1AC" }}>{b.pct}%</div>
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
            </div>
            <div style={{ maxHeight: 230, overflowY: "auto" }}>
              {data.candidates.statusList.map((st) => (
                <div key={st.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #F4F5F8" }}>
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
