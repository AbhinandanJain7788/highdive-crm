"use client";

import { useState } from "react";
import { REPORT_TYPES } from "@/lib/reportRequests.shared";
import type { ReportDateBasis, ReportRequestRow } from "@/lib/reportRequests.shared";

type ReportTab = "basic" | "advanced";

function toIso(date: string, ampm: string): string {
  // The signed-off HTML's date+AM/PM controls never pick an actual hour/minute — kept
  // as a simple, honest interpretation (AM = 00:00 local, PM = 12:00 local) rather
  // than inventing a full time picker the source design doesn't have.
  const hour = ampm === "PM" ? "12" : "00";
  return new Date(`${date}T${hour}:00:00`).toISOString();
}

function statusStyle(status: ReportRequestRow["status"]): { bg: string; color: string; label: string } {
  if (status === "ready") return { bg: "#E6F4EA", color: "#1E7F43", label: "Ready" };
  if (status === "failed") return { bg: "#FDECEC", color: "#C0392B", label: "Failed" };
  return { bg: "#FFF4E5", color: "#B15C00", label: "Queued" };
}

export default function RequestReportsClient({ initialHistory }: { initialHistory: ReportRequestRow[] }) {
  const [reportTab, setReportTab] = useState<ReportTab>("basic");
  const [selectedReportType, setSelectedReportType] = useState<string>(REPORT_TYPES[0]);
  const [dateBasis, setDateBasis] = useState<ReportDateBasis>("created_date");
  const [reportStartDate, setReportStartDate] = useState("2026-08-13");
  const [reportEndDate, setReportEndDate] = useState("2026-09-04");
  const [reportStartAmPm, setReportStartAmPm] = useState("AM");
  const [reportEndAmPm, setReportEndAmPm] = useState("PM");

  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{ row: ReportRequestRow; failureReason?: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [history, setHistory] = useState<ReportRequestRow[]>(initialHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const reportTabStyle = (active: boolean): React.CSSProperties =>
    active ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" } : { color: "#9AA1AC", borderBottom: "2px solid transparent" };

  async function requestReport() {
    setSubmitting(true);
    setSubmitError(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/report-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType: selectedReportType,
          dateFrom: toIso(reportStartDate, reportStartAmPm),
          dateTo: toIso(reportEndDate, reportEndAmPm),
          dateBasis,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not request report.");
      setLastResult({ row: body.data, failureReason: body.failureReason });
      setHistory((h) => [body.data, ...h]);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not request report.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next) {
      setHistoryLoading(true);
      try {
        const res = await fetch("/api/report-requests");
        if (res.ok) {
          const body = await res.json();
          setHistory(body.data ?? []);
        }
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>Request Reports</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={toggleHistory}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: showHistory ? "#F4F5F8" : "#FFFFFF",
              border: "1px solid #D9DCE3",
              color: "#1D2433",
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6.4" fill="none" stroke="#4B5565" strokeWidth="1.2" />
              <path d="M8 4.6V8l2.6 1.6" fill="none" stroke="#4B5565" strokeWidth="1.2" />
            </svg>
            History
          </button>
        </div>
      </div>

      {showHistory && (
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 12 }}>Report History</div>
          {historyLoading && <div style={{ fontSize: 12.5, color: "#9AA1AC" }}>Loading…</div>}
          {!historyLoading && history.length === 0 && <div style={{ fontSize: 12.5, color: "#9AA1AC" }}>No reports requested yet.</div>}
          {history.map((h) => {
            const s = statusStyle(h.status);
            return (
              <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F4F5F8" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{h.reportType}</div>
                  <div style={{ fontSize: 11.5, color: "#9AA1AC" }}>
                    {h.dateBasis === "last_interaction" ? "Last Interaction" : "Created Date"} · {new Date(h.dateFrom).toLocaleDateString()} –{" "}
                    {new Date(h.dateTo).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: s.bg, color: s.color, fontSize: 11.5, fontWeight: 600, borderRadius: 6, padding: "3px 10px" }}>{s.label}</span>
                  {h.status === "ready" && h.fileUrl && (
                    <a href={h.fileUrl} download={`${h.reportType}.csv`} style={{ fontSize: 12.5, color: "#FF5C35", fontWeight: 600, textDecoration: "none" }}>
                      Download
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 26 }}>
        <div style={{ display: "flex", gap: 36, marginBottom: 2, borderBottom: "1px solid #EEF0F4" }}>
          <div onClick={() => setReportTab("basic")} style={{ paddingBottom: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", ...reportTabStyle(reportTab === "basic") }}>
            Basic Reports
          </div>
          <div onClick={() => setReportTab("advanced")} style={{ paddingBottom: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", ...reportTabStyle(reportTab === "advanced") }}>
            Advanced Reports
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 40, marginTop: 22 }}>
          {reportTab === "basic" ? (
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433", marginBottom: 16 }}>Select the report you want to request</div>
              <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 8 }}>
                {REPORT_TYPES.map((rt) => {
                  const selected = selectedReportType === rt;
                  return (
                    <div
                      key={rt}
                      onClick={() => {
                        setSelectedReportType(rt);
                        setLastResult(null);
                        setSubmitError(null);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", cursor: "pointer" }}
                    >
                      <div
                        style={{
                          width: 17,
                          height: 17,
                          borderRadius: "50%",
                          border: `1.6px solid ${selected ? "#FF5C35" : "#C9CED6"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {selected && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF5C35" }} />}
                      </div>
                      <div style={{ fontSize: 13.5, color: "#1D2433" }}>{rt}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: "#9AA1AC", padding: "20px 0" }}>Advanced report options coming soon.</div>
          )}

          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433", marginBottom: 16 }}>Choose Date and Time range</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                style={{ padding: "9px 12px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#1D2433", background: "#FFFFFF" }}
              />
              <select
                value={reportStartAmPm}
                onChange={(e) => setReportStartAmPm(e.target.value)}
                style={{ padding: "9px 10px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#1D2433", background: "#FFFFFF" }}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
              <span style={{ fontSize: 14, color: "#9AA1AC" }}>–</span>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                style={{ padding: "9px 12px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#1D2433", background: "#FFFFFF" }}
              />
              <select
                value={reportEndAmPm}
                onChange={(e) => setReportEndAmPm(e.target.value)}
                style={{ padding: "9px 10px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#1D2433", background: "#FFFFFF" }}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#4B5565" }}>Based on</span>
              <select
                value={dateBasis}
                onChange={(e) => setDateBasis(e.target.value as ReportDateBasis)}
                style={{ padding: "8px 12px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF" }}
              >
                <option value="created_date">Created Date</option>
                <option value="last_interaction">Last Interaction</option>
              </select>
            </div>
            <button
              onClick={requestReport}
              disabled={submitting}
              style={{
                marginTop: 26,
                background: submitting ? "#C9CED6" : "linear-gradient(180deg,#FF7A50,#FF5C35)",
                border: "none",
                color: "#FFFFFF",
                borderRadius: 8,
                padding: "13px 30px",
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? "default" : "pointer",
              }}
            >
              {submitting ? "Requesting…" : "Request Report"}
            </button>

            {submitError && (
              <div style={{ marginTop: 16, fontSize: 12.5, color: "#C0392B", background: "#FDECEC", padding: "9px 12px", borderRadius: 6, display: "inline-block" }}>
                {submitError}
              </div>
            )}

            {lastResult && lastResult.row.status === "ready" && (
              <div style={{ marginTop: 16, fontSize: 12.5, color: "#1E7F43", background: "#E6F4EA", padding: "9px 12px", borderRadius: 6, display: "flex", gap: 12, alignItems: "center" }}>
                <span>
                  Report &quot;{lastResult.row.reportType}&quot; is ready.
                </span>
                {lastResult.row.fileUrl && (
                  <a href={lastResult.row.fileUrl} download={`${lastResult.row.reportType}.csv`} style={{ color: "#1E7F43", fontWeight: 700, textDecoration: "underline" }}>
                    Download CSV
                  </a>
                )}
              </div>
            )}
            {lastResult && lastResult.row.status === "failed" && (
              <div style={{ marginTop: 16, fontSize: 12.5, color: "#C0392B", background: "#FDECEC", padding: "9px 12px", borderRadius: 6, display: "inline-block" }}>
                Report &quot;{lastResult.row.reportType}&quot; failed{lastResult.failureReason ? `: ${lastResult.failureReason}` : "."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
