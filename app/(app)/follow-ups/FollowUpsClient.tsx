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
  const [completingId, setCompletingId] = useState<string | null>(null);

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

  // The "+" quick-action icon is present but unbound on every list row across
  // Allocations/Interactions/Follow-ups in the signed-off HTML — repurposed here
  // as "Mark Complete" since Phase 5 Checkpoint 4 requires a working complete
  // action and the source design defines no dedicated control for it.
  async function completeFollowUp(row: FollowUpRow) {
    setCompletingId(row.id);
    setLoadError(null);
    try {
      const res = await fetch(`/api/follow-ups/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not complete follow-up.");
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setCounts((prev) => ({ ...prev, [tab]: Math.max(0, prev[tab] - 1) }));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not complete follow-up.");
    } finally {
      setCompletingId(null);
    }
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
        <IconButton label="Filter" onClick={() => {}} active={activeFilterCount > 0}>
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

      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden" }}>
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
                  onClick={() => completeFollowUp(fu)}
                  disabled={completingId === fu.id}
                  title="Mark Complete"
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
                    cursor: completingId === fu.id ? "default" : "pointer",
                    opacity: completingId === fu.id ? 0.6 : 1,
                  }}
                >
                  {completingId === fu.id ? "…" : "✓"}
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
    </div>
  );
}
