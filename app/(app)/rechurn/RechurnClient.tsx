"use client";

import { useState } from "react";
import { statusStyles } from "@/lib/mock/styles";
import { RECHURN_ELIGIBLE_STATUSES, type ApplicationStatus, type RechurnDateBasis } from "@/lib/rechurn.shared";

type RechurnRange = "Today" | "Last 30 Days" | "Select Range";
type RechurnMode = "common" | "specific" | null;

function isoRangeFor(range: RechurnRange, customFrom: string, customTo: string): { from?: string; to?: string } {
  const now = new Date();
  if (range === "Today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (range === "Last 30 Days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: now.toISOString() };
  }
  if (customFrom && customTo) {
    const start = new Date(`${customFrom}T00:00:00`);
    const end = new Date(`${customTo}T23:59:59`);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  return {};
}

export default function RechurnClient({ recruiters, canCommonPool }: { recruiters: { id: string; name: string }[]; canCommonPool: boolean }) {
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "All">("All");
  const [dateBasis, setDateBasis] = useState<RechurnDateBasis>("created_date");
  const [range, setRange] = useState<RechurnRange>("Last 30 Days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [countShown, setCountShown] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  const [mode, setMode] = useState<RechurnMode>(null);
  const [assignTo, setAssignTo] = useState("");

  const [initiating, setInitiating] = useState(false);
  const [result, setResult] = useState<{ matched: number; updated: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rangeBtnStyle = (active: boolean): React.CSSProperties => (active ? { background: "#1D2433", color: "#FFFFFF" } : { color: "#4B5565" });

  function currentFilters() {
    const { from, to } = isoRangeFor(range, customFrom, customTo);
    return {
      status: statusFilter === "All" ? undefined : statusFilter,
      dateBasis,
      dateFrom: from,
      dateTo: to,
    };
  }

  async function getCount() {
    setCounting(true);
    setError(null);
    try {
      const res = await fetch("/api/rechurn/count", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentFilters()) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not get count.");
      setCount(body.data.count);
      setCountShown(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get count.");
    } finally {
      setCounting(false);
    }
  }

  async function initiate() {
    setInitiating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/rechurn/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...currentFilters(), mode, recruiterId: mode === "specific" ? assignTo : undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not initiate rechurn.");
      setResult({ matched: body.data.matched, updated: body.data.updated, skipped: body.data.skipped.length });
      setCountShown(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not initiate rechurn.");
    } finally {
      setInitiating(false);
    }
  }

  const rechurnReady = !!mode && (mode !== "specific" || !!assignTo) && (mode !== "common" || canCommonPool);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>Rechurn Customers</div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as ApplicationStatus | "All");
            setCountShown(false);
          }}
          style={{ padding: "9px 14px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF", minWidth: 170 }}
        >
          <option value="All">Select Status</option>
          {RECHURN_ELIGIBLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusStyles[s]?.label ?? s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ marginTop: 14, fontSize: 12.5, color: "#C0392B", background: "#FDECEC", padding: "9px 12px", borderRadius: 6 }}>{error}</div>
      )}

      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, marginTop: 18, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 22px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, color: "#1D2433" }}>Choose a Date range based on</span>
          <select
            value={dateBasis}
            onChange={(e) => {
              setDateBasis(e.target.value as RechurnDateBasis);
              setCountShown(false);
            }}
            style={{ padding: "8px 12px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF" }}
          >
            <option value="created_date">Created Date</option>
            <option value="last_interaction">Last Interaction</option>
          </select>
          <span style={{ color: "#D9DCE3" }}>:</span>
          <div style={{ display: "flex", gap: 4, background: "#F4F5F8", border: "1px solid #E7E9EE", borderRadius: 8, padding: 3 }}>
            {(["Today", "Last 30 Days", "Select Range"] as RechurnRange[]).map((r) => (
              <div
                key={r}
                onClick={() => {
                  setRange(r);
                  setCountShown(false);
                }}
                style={{ padding: "8px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer", ...rangeBtnStyle(range === r) }}
              >
                {r}
              </div>
            ))}
          </div>
          {range === "Select Range" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setCountShown(false); }} style={{ padding: "8px 10px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13 }} />
              <span style={{ color: "#9AA1AC" }}>–</span>
              <input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setCountShown(false); }} style={{ padding: "8px 10px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13 }} />
            </div>
          )}
        </div>
        <div style={{ borderTop: "1px solid #EEF0F4", padding: "20px 22px" }}>
          <div style={{ fontSize: 13.5, color: "#1D2433", marginBottom: 12 }}>Matched Customers</div>
          <button
            onClick={getCount}
            disabled={counting}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid #FF5C35", color: "#FF5C35", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: counting ? "default" : "pointer" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M13.5 8A5.5 5.5 0 113.6 4.4M13.5 8V3.5M13.5 8H9" fill="none" stroke="#FF5C35" strokeWidth="1.4" />
            </svg>
            {counting ? "Counting…" : countShown ? count : "Get Count"}
          </button>
        </div>
        <div
          onClick={() => canCommonPool && setMode("common")}
          style={{ borderTop: "1px solid #EEF0F4", padding: "18px 22px", cursor: canCommonPool ? "pointer" : "not-allowed", display: "flex", alignItems: "flex-start", gap: 14, opacity: canCommonPool ? 1 : 0.5 }}
        >
          <div style={{ width: 18, height: 18, borderRadius: "50%", border: `1.6px solid ${mode === "common" ? "#FF5C35" : "#C9CED6"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
            {mode === "common" && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF5C35" }} />}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>Assign in Common Pool</div>
            <div style={{ fontSize: 12.5, color: "#9AA1AC", marginTop: 2 }}>
              {canCommonPool ? "Allowed if user has access to bulk import permission" : "Requires the bulk_import permission"}
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #EEF0F4" }}>
          <div onClick={() => setMode("specific")} style={{ padding: "18px 22px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: `1.6px solid ${mode === "specific" ? "#FF5C35" : "#C9CED6"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              {mode === "specific" && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF5C35" }} />}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>Change owner to Specific Users</div>
          </div>
          <div style={{ padding: "0 22px 22px 54px" }}>
            <select
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              style={{ width: "100%", maxWidth: 320, padding: "10px 14px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF" }}
            >
              <option value="">Assign To</option>
              {recruiters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {result && (
        <div style={{ marginTop: 16, fontSize: 12.5, color: "#1E7F43", background: "#E6F4EA", padding: "10px 14px", borderRadius: 6 }}>
          {result.updated} of {result.matched} matched candidate{result.matched === 1 ? "" : "s"} updated.
          {result.skipped > 0 ? ` ${result.skipped} skipped (already reassigned concurrently).` : ""}
        </div>
      )}

      <div style={{ fontSize: 13, color: "#4B5565", margin: "18px 0 14px" }}>On click of initiate, allocations will be created for the matched customers.</div>
      <button
        disabled={!rechurnReady || initiating}
        onClick={initiate}
        style={{
          background: rechurnReady ? "#FF5C35" : "#9AA1AC",
          border: "none",
          color: "#FFFFFF",
          borderRadius: 7,
          padding: "13px 0",
          width: "100%",
          maxWidth: "100%",
          fontSize: 14,
          fontWeight: 700,
          cursor: rechurnReady && !initiating ? "pointer" : "default",
        }}
      >
        {initiating ? "Initiating…" : "Initiate"}
      </button>
    </div>
  );
}
