"use client";

import { useState } from "react";
import { candidatesSeed, recruiters, statusStyles, candidateDayRank, callDateRank } from "@/lib/mock";

type DateBasis = "Created Date" | "Last Interaction";
type RechurnRange = "Today" | "Last 30 Days" | "Select Range";
type RechurnMode = "common" | "specific" | null;

// Same enum values the source prototype's getRechurnCount treats as rechurn-eligible
// (display labels 'No Response' / 'Not Interested' / 'Rejected').
const RECHURN_ELIGIBLE_STATUSES = ["no_response", "not_interested", "rejected"];

const followUpStatusOptions = Object.values(statusStyles).map((s) => s.label);

export default function RechurnPage() {
  const [rechurnStatusFilter, setRechurnStatusFilter] = useState("All");
  const [rechurnDateBasis, setRechurnDateBasis] = useState<DateBasis>("Created Date");
  const [rechurnRange, setRechurnRange] = useState<RechurnRange>("Last 30 Days");
  const [rechurnCountShown, setRechurnCountShown] = useState(false);
  const [rechurnCount, setRechurnCount] = useState(0);
  const [rechurnMode, setRechurnMode] = useState<RechurnMode>(null);
  const [rechurnAssignTo, setRechurnAssignTo] = useState("");

  const rechurnRangeStyle = (active: boolean): React.CSSProperties =>
    active ? { background: "#1D2433", color: "#FFFFFF" } : { color: "#4B5565" };

  // "Last 30 Days" and "Select Range" (no date-picker UI built yet) both pass
  // everything — an honest "not narrowed" state rather than a fake bound.
  const dateOk = (c: (typeof candidatesSeed)[number]) => {
    if (rechurnRange !== "Today") return true;
    if (rechurnDateBasis === "Created Date") return candidateDayRank(c.createdOn) === 0;
    if (c.calls.length === 0) return false;
    return Math.min(...c.calls.map((call) => callDateRank(call.date))) === 0;
  };

  const getRechurnCount = () => {
    setRechurnCountShown(true);
    setRechurnCount(
      candidatesSeed.filter(
        (c) =>
          RECHURN_ELIGIBLE_STATUSES.includes(c.status) &&
          (rechurnStatusFilter === "All" || statusStyles[c.status].label === rechurnStatusFilter) &&
          dateOk(c)
      ).length
    );
  };

  const recruiterNames = recruiters.map((r) => r.name);
  const rechurnReady = !!rechurnMode && (rechurnMode !== "specific" || !!rechurnAssignTo);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>Rechurn Customers</div>
        <select
          value={rechurnStatusFilter}
          onChange={(e) => {
            setRechurnStatusFilter(e.target.value);
            setRechurnCountShown(false);
          }}
          style={{
            padding: "9px 14px",
            border: "1px solid #D9DCE3",
            borderRadius: 7,
            fontSize: 13,
            color: "#4B5565",
            background: "#FFFFFF",
            minWidth: 170,
          }}
        >
          <option value="All">Select Status</option>
          {followUpStatusOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
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
          <svg width="15" height="15" viewBox="0 0 14 14">
            <path d="M1 2h12M3.5 7h7M6 12h2" stroke="#4B5565" strokeWidth="1.3" fill="none" />
          </svg>
        </div>
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#FFFFFF",
            border: "1px solid #D9DCE3",
            color: "#1D2433",
            borderRadius: 7,
            padding: "9px 16px",
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

      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, marginTop: 18, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 22px" }}>
          <span style={{ fontSize: 13.5, color: "#1D2433" }}>Choose a Date range based on</span>
          <select
            value={rechurnDateBasis}
            onChange={(e) => {
              setRechurnDateBasis(e.target.value as DateBasis);
              setRechurnCountShown(false);
            }}
            style={{ padding: "8px 12px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF" }}
          >
            <option value="Created Date">Created Date</option>
            <option value="Last Interaction">Last Interaction</option>
          </select>
          <span style={{ color: "#D9DCE3" }}>:</span>
          <div style={{ display: "flex", gap: 4, background: "#F4F5F8", border: "1px solid #E7E9EE", borderRadius: 8, padding: 3 }}>
            <div
              onClick={() => {
                setRechurnRange("Today");
                setRechurnCountShown(false);
              }}
              style={{ padding: "8px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer", ...rechurnRangeStyle(rechurnRange === "Today") }}
            >
              Today
            </div>
            <div
              onClick={() => {
                setRechurnRange("Last 30 Days");
                setRechurnCountShown(false);
              }}
              style={{ padding: "8px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer", ...rechurnRangeStyle(rechurnRange === "Last 30 Days") }}
            >
              Last 30 Days
            </div>
            <div
              onClick={() => {
                setRechurnRange("Select Range");
                setRechurnCountShown(false);
              }}
              style={{ padding: "8px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer", ...rechurnRangeStyle(rechurnRange === "Select Range") }}
            >
              Select Range
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #EEF0F4", padding: "20px 22px" }}>
          <div style={{ fontSize: 13.5, color: "#1D2433", marginBottom: 12 }}>Matched Customers</div>
          <button
            onClick={getRechurnCount}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#FFFFFF",
              border: "1px solid #FF5C35",
              color: "#FF5C35",
              borderRadius: 7,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <path d="M13.5 8A5.5 5.5 0 113.6 4.4M13.5 8V3.5M13.5 8H9" fill="none" stroke="#FF5C35" strokeWidth="1.4" />
            </svg>
            {rechurnCountShown ? rechurnCount : "Get Count"}
          </button>
        </div>
        <div
          onClick={() => setRechurnMode("common")}
          style={{ borderTop: "1px solid #EEF0F4", padding: "18px 22px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14 }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: `1.6px solid ${rechurnMode === "common" ? "#FF5C35" : "#C9CED6"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {rechurnMode === "common" && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF5C35" }} />}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>Assign in Common Pool</div>
            <div style={{ fontSize: 12.5, color: "#9AA1AC", marginTop: 2 }}>Allowed if user has access to bulk import permission</div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #EEF0F4" }}>
          <div
            onClick={() => setRechurnMode("specific")}
            style={{ padding: "18px 22px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 14 }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: `1.6px solid ${rechurnMode === "specific" ? "#FF5C35" : "#C9CED6"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {rechurnMode === "specific" && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF5C35" }} />}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>Change owner to Specific Users</div>
          </div>
          <div style={{ padding: "0 22px 22px 54px" }}>
            <select
              value={rechurnAssignTo}
              onChange={(e) => setRechurnAssignTo(e.target.value)}
              style={{
                width: "100%",
                maxWidth: 320,
                padding: "10px 14px",
                border: "1px solid #D9DCE3",
                borderRadius: 7,
                fontSize: 13,
                color: "#4B5565",
                background: "#FFFFFF",
              }}
            >
              <option value="">Assign To</option>
              {recruiterNames.map((rn) => (
                <option key={rn} value={rn}>
                  {rn}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#4B5565", margin: "18px 0 14px" }}>
        On click of initiate, allocations will be created for the matched customers.
      </div>
      <button
        disabled={!rechurnReady}
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
          cursor: rechurnReady ? "pointer" : "default",
        }}
      >
        Initiate
      </button>
    </div>
  );
}
