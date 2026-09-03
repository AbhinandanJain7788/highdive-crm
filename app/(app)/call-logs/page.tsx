"use client";

import { useMemo, useState } from "react";
import {
  callLogsSeed,
  dispositionStyles,
  usersSeed,
  recruiters,
  jobsSeed,
  fmtDuration,
  avatarColorFor,
  avatarLetterFor,
  dayRank,
  callLogDateMs,
  type MockCallLog,
} from "@/lib/mock";
import {
  selectStyle,
  CheckboxListPopover,
  SortPopover,
  DateRangeBar,
  DEFAULT_DATE_RANGE,
  dateRangeBounds,
  IconButton,
  SortAzIcon,
  type SortKey,
  type DateRange,
} from "@/components/ListFilters";

type CallLogsTab = "all" | "unattributed";
type TypeFilter = "All" | "Outgoing" | "Incoming";
type RangeFilter = "Today" | "Last 30 Days" | "Select Range";

const dispositionOptions = Object.keys(dispositionStyles);
const jobTitles = jobsSeed.map((j) => j.title);
const CALL_USER_KEYS = recruiters.map((r) => r.id);
const callUserOptions = recruiters.map((r) => ({ id: r.id, label: r.name }));
const CL_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name-asc", label: "Name: A-Z" },
  { key: "name-desc", label: "Name: Z-A" },
  { key: "created-new", label: "Called: New to Old" },
  { key: "created-old", label: "Called: Old to New" },
];

function byUserName(byUserId: string) {
  const u = usersSeed.find((u) => u.id === byUserId);
  return u ? u.name : byUserId;
}

const activeTabStyle = { background: "#1D2433", color: "#FFFFFF" } as const;
const inactiveTabStyle = { color: "#4B5565" } as const;

export default function CallLogsPage() {
  const [callLogs, setCallLogs] = useState<MockCallLog[]>(callLogsSeed);
  const [callLogsTab, setCallLogsTab] = useState<CallLogsTab>("all");
  const [callLogSearch, setCallLogSearch] = useState("");
  const [callLogsTypeFilter, setCallLogsTypeFilter] = useState<TypeFilter>("All");
  const [callLogsStatusFilter, setCallLogsStatusFilter] = useState("All");
  const [callLogsRange, setCallLogsRange] = useState<RangeFilter>("Today");
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [attributeChoice, setAttributeChoice] = useState<Record<string, string>>({});

  const [selectedUserKeys, setSelectedUserKeys] = useState<Set<string>>(new Set(CALL_USER_KEYS));
  const [sortKey, setSortKey] = useState<SortKey>("created-new");
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | null>(null);
  const [openUsersPopover, setOpenUsersPopover] = useState(false);
  const [openSortPopover, setOpenSortPopover] = useState(false);

  const isCallLogsTabAll = callLogsTab === "all";
  const isCallLogsTabUnattributed = callLogsTab === "unattributed";
  const usersNarrowed = selectedUserKeys.size < CALL_USER_KEYS.length;

  function toggleUser(id: string) {
    setSelectedUserKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredCallLogs = useMemo(() => {
    const q = callLogSearch.trim().toLowerCase();
    let list = callLogs.filter((l) => {
      const typeOk = callLogsTypeFilter === "All" || l.type === callLogsTypeFilter;
      const statusOk = callLogsStatusFilter === "All" || l.disposition === callLogsStatusFilter;
      const searchOk = !q || l.name.toLowerCase().includes(q) || l.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""));
      let rangeOk = true;
      if (callLogsRange === "Select Range") {
        const bounds = appliedDateRange ? dateRangeBounds(appliedDateRange) : null;
        if (bounds) {
          const ms = callLogDateMs(l.calledAt);
          rangeOk = ms >= bounds.from && ms <= bounds.to;
        }
      } else {
        rangeOk = dayRank(l.calledAt) <= (callLogsRange === "Today" ? 0 : 29);
      }
      const userOk = selectedUserKeys.has(l.byUserId);
      return typeOk && statusOk && searchOk && rangeOk && userOk;
    });

    list = [...list].sort((a, b) => {
      if (sortKey === "name-asc") return a.name.localeCompare(b.name);
      if (sortKey === "name-desc") return b.name.localeCompare(a.name);
      const rankDiff = dayRank(a.calledAt) - dayRank(b.calledAt);
      return sortKey === "created-new" ? rankDiff : -rankDiff;
    });

    return list;
  }, [callLogs, callLogSearch, callLogsTypeFilter, callLogsStatusFilter, callLogsRange, appliedDateRange, selectedUserKeys, sortKey]);

  const enrichedCallLogs = filteredCallLogs.map((l) => ({
    ...l,
    durationLabel: fmtDuration(l.durationSeconds),
    dispBg: dispositionStyles[l.disposition].bg,
    dispColor: dispositionStyles[l.disposition].color,
    typeColor: l.type === "Outgoing" ? "#1A56DB" : "#0F7A6C",
    typeArrowPath: l.type === "Outgoing" ? "M3 12L12 3M6 3h6v6" : "M12 12L3 3M9 12H3V6",
    avatarLetter: avatarLetterFor(l.name),
    avatarColor: avatarColorFor(l.name),
    noRecording: !l.recording,
    playLabel: playingCallId === l.id ? "Playing…" : "Play Recording",
    playBg: playingCallId === l.id ? "#FFF0EA" : "#FFFFFF",
    playColor: playingCallId === l.id ? "#FF5C35" : "#4B5565",
    byName: byUserName(l.byUserId),
  }));

  const unattributedCalls = callLogs
    .filter((l) => l.unattributed)
    .map((l) => ({
      ...l,
      durationLabel: fmtDuration(l.durationSeconds),
      dispBg: dispositionStyles[l.disposition].bg,
      dispColor: dispositionStyles[l.disposition].color,
      byName: byUserName(l.byUserId),
      attributeChoiceValue: attributeChoice[l.id] || "",
    }));
  const noUnattributed = unattributedCalls.length === 0;

  const togglePlay = (id: string) => {
    setPlayingCallId((prev) => (prev === id ? null : id));
  };

  const onAttributeChoiceChange = (id: string, val: string) => {
    setAttributeChoice((prev) => ({ ...prev, [id]: val }));
  };

  const onAttribute = (id: string) => {
    const jobTitle = attributeChoice[id];
    if (!jobTitle) return;
    setCallLogs((prev) => prev.map((l) => (l.id === id ? { ...l, unattributed: false } : l)));
  };

  const rangeStyle = (active: boolean) => (active ? activeTabStyle : inactiveTabStyle);

  return (
    <div data-screen-label="Call Logs">
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>
          {enrichedCallLogs.length}
          <br />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4B5565" }}>Call Logs</span>
        </div>
        <div
          style={{
            flex: 1,
            maxWidth: 280,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#FFFFFF",
            border: "1px solid #D9DCE3",
            borderRadius: 7,
            padding: "8px 12px",
          }}
        >
          <input
            type="text"
            value={callLogSearch}
            onChange={(e) => setCallLogSearch(e.target.value)}
            placeholder="Search Phone/Name"
            style={{ border: "none", outline: "none", fontSize: 13, color: "#1D2433", flex: 1, background: "transparent" }}
          />
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#9AA1AC" strokeWidth="1.4" />
          </svg>
        </div>
        {callLogSearch && (
          <div onClick={() => setCallLogSearch("")} style={{ fontSize: 13, fontWeight: 600, color: "#1A56DB", cursor: "pointer" }}>
            Clear
          </div>
        )}
        <select
          value={callLogsTypeFilter}
          onChange={(e) => setCallLogsTypeFilter(e.target.value as TypeFilter)}
          style={{
            padding: "8px 12px",
            border: "1px solid #D9DCE3",
            borderRadius: 6,
            fontSize: 12.5,
            color: "#4B5565",
            background: "#FFFFFF",
            minWidth: 80,
          }}
        >
          <option value="All">All</option>
          <option value="Outgoing">Outgoing</option>
          <option value="Incoming">Incoming</option>
        </select>
        <select
          value={callLogsStatusFilter}
          onChange={(e) => setCallLogsStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #D9DCE3",
            borderRadius: 6,
            fontSize: 12.5,
            color: "#4B5565",
            background: "#FFFFFF",
            minWidth: 150,
          }}
        >
          <option value="All">Select Status</option>
          {dispositionOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 8, padding: 3 }}>
          <div
            onClick={() => setCallLogsRange("Today")}
            style={{ padding: "6px 16px", borderRadius: 6, fontSize: 12.5, cursor: "pointer", ...rangeStyle(callLogsRange === "Today") }}
          >
            Today
          </div>
          <div
            onClick={() => setCallLogsRange("Last 30 Days")}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              fontSize: 12.5,
              cursor: "pointer",
              ...rangeStyle(callLogsRange === "Last 30 Days"),
            }}
          >
            Last 30 Days
          </div>
          <div
            onClick={() => setCallLogsRange("Select Range")}
            style={{
              padding: "6px 16px",
              borderRadius: 6,
              fontSize: 12.5,
              cursor: "pointer",
              ...rangeStyle(callLogsRange === "Select Range"),
            }}
          >
            Select Range
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <div onClick={() => setOpenUsersPopover((v) => !v)} style={{ ...selectStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, minWidth: 150 }}>
            {usersNarrowed ? `${selectedUserKeys.size} Users Selected` : "Selected Users"}
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#9AA1AC" }}>▾</span>
          </div>
          {openUsersPopover && (
            <CheckboxListPopover
              options={callUserOptions}
              selected={selectedUserKeys}
              onToggle={toggleUser}
              onClose={() => setOpenUsersPopover(false)}
              searchPlaceholder="Search Users"
            />
          )}
        </div>
        <div style={{ position: "relative" }}>
          <IconButton label="Sort by" onClick={() => setOpenSortPopover((v) => !v)}>
            <SortAzIcon />
          </IconButton>
          {openSortPopover && (
            <SortPopover value={sortKey} onChange={setSortKey} onClose={() => setOpenSortPopover(false)} options={CL_SORT_OPTIONS} />
          )}
        </div>
        <div
          onClick={() => setCallLogsTab("unattributed")}
          style={{
            width: 34,
            height: 34,
            borderRadius: 6,
            border: "1px solid #E7E9EE",
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path
              d="M2 3h12M4 3v9a1.5 1.5 0 001.5 1.5h5A1.5 1.5 0 0012 12V3M6.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1"
              fill="none"
              stroke="#4B5565"
              strokeWidth="1.3"
            />
            <path d="M4 6.5h8" stroke="#4B5565" strokeWidth="1.3" />
          </svg>
        </div>
      </div>

      {callLogsRange === "Select Range" && (
        <DateRangeBar value={dateRange} onChange={setDateRange} onApply={() => setAppliedDateRange(dateRange)} />
      )}

      {isCallLogsTabAll && (
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden", overflowX: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.35fr 0.9fr 1.5fr 1fr 1.1fr 1fr 0.9fr 1.6fr",
              gap: 10,
              padding: "10px 16px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "#9AA1AC",
              textTransform: "uppercase",
              borderBottom: "1px solid #EEF0F4",
              background: "#FAFBFC",
              whiteSpace: "nowrap",
            }}
          >
            <div>
              <input type="checkbox" />
            </div>
            <div>Call Type</div>
            <div>Name</div>
            <div>By</div>
            <div>Called At</div>
            <div>AI Score</div>
            <div>Duration</div>
            <div>Actions</div>
          </div>
          {enrichedCallLogs.map((l) => (
            <div
              key={l.id}
              style={{
                display: "grid",
                gridTemplateColumns: "0.35fr 0.9fr 1.5fr 1fr 1.1fr 1fr 0.9fr 1.6fr",
                gap: 10,
                alignItems: "center",
                padding: "11px 16px",
                borderBottom: "1px solid #F4F5F8",
                whiteSpace: "nowrap",
              }}
            >
              <div>
                <input type="checkbox" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: l.typeColor }}>
                <svg width="13" height="13" viewBox="0 0 16 16">
                  <path d={l.typeArrowPath} fill="none" stroke={l.typeColor} strokeWidth="1.6" />
                </svg>
                {l.type}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: l.avatarColor,
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {l.avatarLetter}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{l.name}</div>
                  <div style={{ fontSize: 12, color: "#9AA1AC" }}>{l.phone}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#4B5565" }}>{l.byName}</div>
              <div style={{ fontSize: 12.5, color: "#4B5565" }}>{l.calledAt}</div>
              <div>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9.5" fill="none" stroke="#EEF0F5" strokeWidth="2.4" />
                  <path d="M12 2.5a9.5 9.5 0 018.2 14.4" fill="none" stroke="#F4A9A0" strokeWidth="2.4" />
                  <text x="12" y="15" textAnchor="middle" fontSize="8" fill="#C0392B" fontWeight="700">
                    !
                  </text>
                </svg>
              </div>
              <div style={{ fontSize: 13, color: "#1D2433" }}>{l.durationLabel}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {l.recording && (
                  <button
                    onClick={() => togglePlay(l.id)}
                    style={{
                      border: "1px solid #D9DCE3",
                      background: l.playBg,
                      color: l.playColor,
                      borderRadius: 6,
                      padding: "7px 14px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12">
                      <path d="M2.5 1.5l7 4.5-7 4.5z" fill={l.playColor} />
                    </svg>
                    {l.playLabel}
                  </button>
                )}
                {l.noRecording && (
                  <button
                    disabled
                    style={{
                      border: "1px solid #EEF0F4",
                      background: "#FAFBFC",
                      color: "#C9CED6",
                      borderRadius: 6,
                      padding: "7px 14px",
                      fontSize: 12.5,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 12 12">
                      <path d="M2.5 1.5l7 4.5-7 4.5z" fill="#C9CED6" />
                    </svg>
                    Play Recording
                  </button>
                )}
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    border: "1px solid #E7E9EE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16">
                    <path d="M8 1.5v9M4.5 7l3.5 3.5L11.5 7" fill="none" stroke="#4B5565" strokeWidth="1.3" />
                    <line x1="2" y1="13.5" x2="14" y2="13.5" stroke="#4B5565" strokeWidth="1.3" />
                  </svg>
                </div>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: "1px solid #FFD9CC",
                    background: "#FFF5F2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16">
                    <path
                      d="M3 2.5c1.2 0 1.6 2 2 2.6.4.7-.8 1.3-.5 2 .5 1.2 1.7 2.4 2.9 2.9.7.3 1.3-.9 2-.5.6.4 2.6.8 2.6 2 0 1.3-1.2 2-2.4 2C6.9 13.5 2.5 9.1 2.5 4.9c0-1.2.7-2.4 2-2.4z"
                      fill="none"
                      stroke="#FF5C35"
                      strokeWidth="1.3"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isCallLogsTabUnattributed && (
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr 1.1fr 0.9fr 1.2fr 1.8fr",
              gap: 10,
              padding: "10px 16px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "#9AA1AC",
              textTransform: "uppercase",
              borderBottom: "1px solid #EEF0F4",
              background: "#FAFBFC",
            }}
          >
            <div>Caller</div>
            <div>By</div>
            <div>Called At</div>
            <div>Duration</div>
            <div>Disposition</div>
            <div>Attribute to Job</div>
          </div>
          {unattributedCalls.map((l) => (
            <div
              key={l.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr 1.1fr 0.9fr 1.2fr 1.8fr",
                gap: 10,
                alignItems: "center",
                padding: "11px 16px",
                borderBottom: "1px solid #F4F5F8",
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{l.name}</div>
                <div style={{ fontSize: 12, color: "#9AA1AC" }}>{l.phone}</div>
              </div>
              <div style={{ fontSize: 13, color: "#4B5565" }}>{l.byName}</div>
              <div style={{ fontSize: 12.5, color: "#9AA1AC" }}>{l.calledAt}</div>
              <div style={{ fontSize: 13, color: "#1D2433" }}>{l.durationLabel}</div>
              <div>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 20,
                    background: l.dispBg,
                    color: l.dispColor,
                  }}
                >
                  {l.disposition}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <select
                  value={l.attributeChoiceValue}
                  onChange={(e) => onAttributeChoiceChange(l.id, e.target.value)}
                  style={{ flex: 1, padding: "6px 8px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12 }}
                >
                  <option value="">Select job…</option>
                  {jobTitles.map((jt) => (
                    <option key={jt} value={jt}>
                      {jt}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => onAttribute(l.id)}
                  style={{
                    background: "#1D2433",
                    border: "none",
                    color: "#FFFFFF",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Link
                </button>
              </div>
            </div>
          ))}
          {noUnattributed && (
            <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
              No unattributed calls — everything is linked to a job.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
