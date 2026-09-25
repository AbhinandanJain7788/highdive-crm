"use client";

import { useEffect, useRef, useState } from "react";
import { avatarLetterFor } from "@/lib/mock";
import { statusStyles, avatarColorFor } from "@/lib/mock/styles";
import { APPLICATION_STATUSES } from "@/lib/candidates.shared";
import {
  selectStyle,
  CheckboxListPopover,
  SortPopover,
  IconButton,
  FunnelIcon,
  SortAzIcon,
  CalendarIcon,
  DateRangeBar,
  DEFAULT_DATE_RANGE,
  dateRangeBounds,
  type SortKey,
  type DateRange,
} from "@/components/ListFilters";
import { PAGE_SIZES, type FollowUpRow } from "@/lib/followups.shared";

type Outcome = NonNullable<FollowUpRow["applicationStatus"]>;

type FuTab = "pending" | "upcoming";

const FU_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name-asc", label: "Name: A-Z" },
  { key: "name-desc", label: "Name: Z-A" },
  { key: "created-new", label: "Follow-up: Soonest First" },
  { key: "created-old", label: "Follow-up: Latest First" },
];

const statusOptions = APPLICATION_STATUSES.map((s) => ({ id: s, label: statusStyles[s]?.label ?? s }));
const PAGE_SIZE = PAGE_SIZES[PAGE_SIZES.length - 1];

function fuTabStyle(active: boolean): React.CSSProperties {
  return active ? { background: "#1D2433", color: "#FFFFFF" } : { color: "#4B5565" };
}

// due-today-or-earlier reads as overdue/due-now (orange); a genuinely future
// pending due date reads as on-track (green) — mirrors the mock's bucket-derived
// dueIconColor, now driven by the row's own real bucket instead of a hardcoded tab.
function dueIconColor(row: FollowUpRow): string {
  return row.bucket === "pending" ? "#E0563B" : "#16A34A";
}

export default function FollowUpsClient({
  initialRows,
  initialCounts,
}: {
  initialRows: FollowUpRow[];
  initialCounts: { pending: number; upcoming: number };
}) {
  const [tab, setTab] = useState<FuTab>("pending");
  const [rows, setRows] = useState<FollowUpRow[]>(initialRows);
  const [counts, setCounts] = useState(initialCounts);
  const [search, setSearch] = useState("");

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("created-new");

  const [showDateRange, setShowDateRange] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | null>(null);

  const [openStatusPopover, setOpenStatusPopover] = useState(false);
  const [openSortPopover, setOpenSortPopover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The tick used to complete a follow-up with no visible confirmation and no
  // way to record what actually happened on the call. It now opens this modal —
  // status is set here (a single, editable field on the row instead of a
  // separate screen), the follow-up is marked done, and a next one can be
  // scheduled in the same step instead of navigating to Candidate Detail.

  const [logRow, setLogRow] = useState<FollowUpRow | null>(null);
  const [logOutcome, setLogOutcome] = useState<Outcome | "">("");
  const [logNote, setLogNote] = useState("");
  const [logNextDue, setLogNextDue] = useState("");
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const isInterview = logOutcome === "interview_scheduled";
  const logScheduleLabel = isInterview ? "Interview Date and Time" : "Next follow-up date (optional)";

  function openLog(row: FollowUpRow) {
    setLogRow(row);
    setLogOutcome(row.applicationStatus ?? "");
    setLogNote("");
    setLogNextDue("");
    setLogError(null);
  }

  async function submitLog() {
    if (!logRow) return;
    setLogSubmitting(true);
    setLogError(null);
    try {
      const completeRes = await fetch(`/api/follow-ups/${logRow.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed", ...(logNote.trim() ? { note: logNote } : {}) }),
      });
      if (!completeRes.ok) {
        const body = await completeRes.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not update this follow-up.");
      }

      if (logOutcome && logOutcome !== logRow.applicationStatus && logRow.applicationId) {
        const statusRes = await fetch(`/api/applications/${logRow.applicationId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: logOutcome }),
        });
        if (!statusRes.ok) {
          const body = await statusRes.json().catch(() => null);
          throw new Error(body?.error?.message ?? "Could not update the candidate's status.");
        }
      }

      if (logNextDue && logRow.applicationId) {
        const dueMs = new Date(logNextDue).getTime();
        if (Number.isNaN(dueMs)) throw new Error("Pick a valid date and time.");

        if (isInterview) {
          const interviewRes = await fetch("/api/interviews", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              applicationId: logRow.applicationId,
              scheduledAt: new Date(dueMs).toISOString(),
              ...(logNote.trim() ? { note: logNote } : {}),
            }),
          });
          if (!interviewRes.ok) {
            const body = await interviewRes.json().catch(() => null);
            throw new Error(body?.error?.message ?? "Could not schedule the interview.");
          }
        } else {
          const scheduleRes = await fetch("/api/follow-ups", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ applicationId: logRow.applicationId, dueAt: new Date(dueMs).toISOString() }),
          });
          if (!scheduleRes.ok) {
            const body = await scheduleRes.json().catch(() => null);
            throw new Error(body?.error?.message ?? "Could not schedule the next follow-up.");
          }
        }
      }

      setRows((prev) => prev.filter((r) => r.id !== logRow.id));
      setCounts((prev) => ({ ...prev, [tab]: Math.max(0, prev[tab] - 1) }));
      setLogRow(null);
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Could not save this follow-up.");
    } finally {
      setLogSubmitting(false);
    }
  }

  const statusKey = [...selectedStatuses].join(",");
  const activeFilterCount = selectedStatuses.size > 0 ? 1 : 0;

  const firstRender = useRef(true);
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("bucket", tab);
    if (search.trim()) params.set("search", search.trim());
    if (statusKey) params.set("status", statusKey);
    const sort: SortKey = sortKey === "created-new" ? ("due-asc" as SortKey) : sortKey === "created-old" ? ("due-desc" as SortKey) : sortKey;
    params.set("sort", sort);
    params.set("pageSize", String(PAGE_SIZE));

    if (appliedDateRange) {
      const bounds = dateRangeBounds(appliedDateRange);
      if (bounds) {
        params.set("dueFrom", new Date(bounds.from).toISOString());
        params.set("dueTo", new Date(bounds.to).toISOString());
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setLoadError(null);
        try {
          const res = await fetch(`/api/follow-ups?${params.toString()}`, { signal: controller.signal });
          if (!res.ok) throw new Error("Could not load follow-ups.");
          const body = await res.json();
          setRows(body.data ?? []);
          if (body.counts) setCounts(body.counts);
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            setLoadError(err instanceof Error ? err.message : "Could not load follow-ups.");
          }
        } finally {
          setLoading(false);
        }
      },
      firstRender.current ? 0 : 250
    );
    firstRender.current = false;

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [tab, search, statusKey, sortKey, appliedDateRange]);

  function toggleStatus(id: string) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const noFollowUps = !loading && rows.length === 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>
          {counts.pending + counts.upcoming}
          <br />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4B5565" }}>Follow-Ups</span>
        </div>
        <div style={{ flex: 1, maxWidth: 250, display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid #D9DCE3", borderRadius: 7, padding: "8px 12px" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Phone/Name"
            style={{ border: "none", outline: "none", fontSize: 13, color: "#1D2433", flex: 1, background: "transparent" }}
          />
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#9AA1AC" strokeWidth="1.4" />
          </svg>
        </div>
        <div style={{ position: "relative" }}>
          <div onClick={() => setOpenStatusPopover((v) => !v)} style={{ ...selectStyle, minWidth: 170, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {selectedStatuses.size > 0 ? `${selectedStatuses.size} selected` : "Select Status"}
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#9AA1AC" }}>▾</span>
          </div>
          {openStatusPopover && (
            <CheckboxListPopover
              options={statusOptions}
              selected={selectedStatuses}
              onToggle={toggleStatus}
              onClose={() => setOpenStatusPopover(false)}
              searchPlaceholder="Search Status"
            />
          )}
        </div>
        <div style={{ display: "flex", gap: 4, background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 8, padding: 3 }}>
          <div onClick={() => setTab("pending")} style={{ padding: "6px 18px", borderRadius: 6, fontSize: 12.5, cursor: "pointer", ...fuTabStyle(tab === "pending") }}>
            Pending <span style={{ marginLeft: 4 }}>{counts.pending}</span>
          </div>
          <div onClick={() => setTab("upcoming")} style={{ padding: "6px 18px", borderRadius: 6, fontSize: 12.5, cursor: "pointer", ...fuTabStyle(tab === "upcoming") }}>
            Upcoming <span style={{ marginLeft: 4 }}>{counts.upcoming}</span>
          </div>
        </div>
        <IconButton label="Select Date Range" onClick={() => setShowDateRange((v) => !v)} active={!!appliedDateRange}>
          <CalendarIcon />
        </IconButton>
        <IconButton label="Filter" onClick={() => setOpenStatusPopover((v) => !v)} active={activeFilterCount > 0}>
          <FunnelIcon />
        </IconButton>
        <div style={{ position: "relative" }}>
          <IconButton label="Sort by" onClick={() => setOpenSortPopover((v) => !v)}>
            <SortAzIcon />
          </IconButton>
          {openSortPopover && (
            <SortPopover value={sortKey} onChange={setSortKey} onClose={() => setOpenSortPopover(false)} options={FU_SORT_OPTIONS} />
          )}
        </div>
        {loading && <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>Loading…</span>}
      </div>

      {showDateRange && (
        <DateRangeBar value={dateRange} onChange={setDateRange} onApply={() => setAppliedDateRange(dateRange)} />
      )}

      {loadError && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {loadError}
        </div>
      )}

      <div style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,40,0.04)", overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.8fr 1.1fr 1.2fr 1.1fr 1.1fr 1fr 0.9fr",
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
          <div>Status</div>
          <div>Follow-up On</div>
          <div>Assigned By</div>
          <div>Assign To</div>
          <div>Sourced by</div>
          <div>Actions</div>
        </div>
        {rows.map((fu) => {
          const style = fu.applicationStatus ? statusStyles[fu.applicationStatus] : null;
          return (
            <div
              key={fu.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.8fr 1.1fr 1.2fr 1.1fr 1.1fr 1fr 0.9fr",
                gap: 10,
                alignItems: "center",
                padding: "11px 16px",
                borderBottom: "1px solid #F4F5F8",
                borderLeft: "3px solid #FF5C35",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: avatarColorFor(fu.candidateName),
                    color: "#FFFFFF",
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {avatarLetterFor(fu.candidateName)}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{fu.candidateName}</div>
                  <div style={{ fontSize: 12, color: "#9AA1AC" }}>{fu.phone}</div>
                </div>
              </div>
              <div>
                {style ? (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: style.bg, color: style.color }}>
                    {style.label}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: "#9AA1AC" }}>--</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12.5, color: "#4B5565" }}>{fu.dueAt}</span>
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="6.4" fill="none" stroke={dueIconColor(fu)} strokeWidth="1.3" />
                  <line x1="8" y1="4.6" x2="8" y2="8.6" stroke={dueIconColor(fu)} strokeWidth="1.3" />
                  <circle cx="8" cy="11" r="0.8" fill={dueIconColor(fu)} />
                </svg>
              </div>
              <div style={{ fontSize: 13, color: "#4B5565" }}>{fu.assignedByName ?? "--"}</div>
              <div style={{ fontSize: 13, color: "#4B5565" }}>{fu.assignToName ?? "--"}</div>
              <div style={{ fontSize: 13, color: "#9AA1AC" }}>{fu.sourcedByName ?? "--"}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => openLog(fu)}
                  title="Update Status"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: "1px solid #FFD9CC",
                    background: "#FFF5F2",
                    color: "#FF5C35",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  ✓
                </button>
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
          );
        })}
        {noFollowUps && (
          <div style={{ padding: "44px 0", textAlign: "center", fontSize: 13, color: "#9AA1AC" }}>No follow-ups to display</div>
        )}
      </div>

      {logRow && (
        <div
          onClick={() => (logSubmitting ? null : setLogRow(null))}
          style={{ position: "fixed", inset: 0, background: "rgba(29,36,51,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 440, maxWidth: "92vw", background: "#FFFFFF", borderRadius: 12, padding: 24 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#1D2433" }}>Update Follow-Up</div>
              <div onClick={() => setLogRow(null)} style={{ cursor: "pointer", fontSize: 20, color: "#9AA1AC", lineHeight: 1 }}>
                ×
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 18 }}>{logRow.candidateName}</div>

            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>Status</div>
            <select
              value={logOutcome}
              onChange={(e) => setLogOutcome(e.target.value as Outcome)}
              style={{ width: "100%", padding: "9px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 13, marginBottom: 16 }}
            >
              <option value="">Leave unchanged</option>
              {statusOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>{logScheduleLabel}</div>
            <input
              type="datetime-local"
              value={logNextDue}
              onChange={(e) => setLogNextDue(e.target.value)}
              style={{ width: "100%", padding: "9px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 13, marginBottom: 4 }}
            />
            <div style={{ fontSize: 11.5, color: "#9AA1AC", marginBottom: 16 }}>
              {isInterview ? "Leave blank if no follow-up is needed." : "Leave blank if this follow-up is done for good."}
            </div>

            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>Note (optional)</div>
            <textarea
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
              placeholder="Anything specific from the conversation…"
              rows={3}
              style={{ width: "100%", padding: "9px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 13, marginBottom: 16, fontFamily: "inherit", resize: "vertical" }}
            />

            {logError && <div style={{ fontSize: 12.5, color: "#B42318", marginBottom: 12 }}>{logError}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setLogRow(null)}
                disabled={logSubmitting}
                style={{ flex: 1, background: "#FFFFFF", border: "1px solid #D9DCE3", color: "#4B5565", borderRadius: 6, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={submitLog}
                disabled={logSubmitting}
                style={{
                  flex: 1,
                  background: "#FF5C35",
                  border: "none",
                  color: "#FFFFFF",
                  borderRadius: 6,
                  padding: "10px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: logSubmitting ? "default" : "pointer",
                  opacity: logSubmitting ? 0.7 : 1,
                }}
              >
                {logSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
