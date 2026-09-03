"use client";

import { useState } from "react";

type ReportTab = "basic" | "advanced";

const reportTypesList = [
  "Interactions (All)",
  "Interactions (Last/Unique)",
  "Whatsapp Messages",
  "SMS Interactions",
  "Emails",
  "Allocations (Common Pool)",
  "Allocations (Pending)",
  "Allocations (Completed)",
  "Customers",
  "Call Logs (All/Unique)",
];

export default function RequestReportsPage() {
  const [reportTab, setReportTab] = useState<ReportTab>("basic");
  const [selectedReportType, setSelectedReportType] = useState("Interactions (All)");
  const [reportStartDate, setReportStartDate] = useState("2026-08-13");
  const [reportEndDate, setReportEndDate] = useState("2026-08-27");
  const [reportStartAmPm, setReportStartAmPm] = useState("AM");
  const [reportEndAmPm, setReportEndAmPm] = useState("AM");
  const [reportRequested, setReportRequested] = useState(false);

  const reportTabStyle = (active: boolean): React.CSSProperties =>
    active
      ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" }
      : { color: "#9AA1AC", borderBottom: "2px solid transparent" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>Request Reports</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#FFFFFF",
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
              <rect x="2" y="2.5" width="9" height="11" rx="1.3" fill="none" stroke="#4B5565" strokeWidth="1.2" />
              <path d="M11 9.5l3 3-3 3" fill="none" stroke="#4B5565" strokeWidth="1.2" />
            </svg>
            View Schedule
          </button>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#FFFFFF",
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
        </div>
      </div>

      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 26 }}>
        <div style={{ display: "flex", gap: 36, marginBottom: 2, borderBottom: "1px solid #EEF0F4" }}>
          <div
            onClick={() => setReportTab("basic")}
            style={{ paddingBottom: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", ...reportTabStyle(reportTab === "basic") }}
          >
            Basic Reports
          </div>
          <div
            onClick={() => setReportTab("advanced")}
            style={{ paddingBottom: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", ...reportTabStyle(reportTab === "advanced") }}
          >
            Advanced Reports
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 40, marginTop: 22 }}>
          {reportTab === "basic" ? (
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433", marginBottom: 16 }}>
                Select the report you want to request
              </div>
              <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 8 }}>
                {reportTypesList.map((rt) => {
                  const selected = selectedReportType === rt;
                  return (
                    <div
                      key={rt}
                      onClick={() => {
                        setSelectedReportType(rt);
                        setReportRequested(false);
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
                        {selected && (
                          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF5C35" }} />
                        )}
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
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433", marginBottom: 16 }}>
              Choose Date and Time range
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                style={{
                  padding: "9px 12px",
                  border: "1px solid #D9DCE3",
                  borderRadius: 7,
                  fontSize: 13,
                  color: "#1D2433",
                  background: "#FFFFFF",
                }}
              />
              <select
                value={reportStartAmPm}
                onChange={(e) => setReportStartAmPm(e.target.value)}
                style={{
                  padding: "9px 10px",
                  border: "1px solid #D9DCE3",
                  borderRadius: 7,
                  fontSize: 13,
                  color: "#1D2433",
                  background: "#FFFFFF",
                }}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
              <span style={{ fontSize: 14, color: "#9AA1AC" }}>–</span>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                style={{
                  padding: "9px 12px",
                  border: "1px solid #D9DCE3",
                  borderRadius: 7,
                  fontSize: 13,
                  color: "#1D2433",
                  background: "#FFFFFF",
                }}
              />
              <select
                value={reportEndAmPm}
                onChange={(e) => setReportEndAmPm(e.target.value)}
                style={{
                  padding: "9px 10px",
                  border: "1px solid #D9DCE3",
                  borderRadius: 7,
                  fontSize: 13,
                  color: "#1D2433",
                  background: "#FFFFFF",
                }}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <button
              onClick={() => setReportRequested(true)}
              style={{
                marginTop: 26,
                background: "linear-gradient(180deg,#FF7A50,#FF5C35)",
                border: "none",
                color: "#FFFFFF",
                borderRadius: 8,
                padding: "13px 30px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Request Report
            </button>
            {reportRequested && (
              <div
                style={{
                  marginTop: 16,
                  fontSize: 12.5,
                  color: "#1E7F43",
                  background: "#E6F4EA",
                  padding: "9px 12px",
                  borderRadius: 6,
                  display: "inline-block",
                }}
              >
                Report requested for &quot;{selectedReportType}&quot;. Check History for status.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
