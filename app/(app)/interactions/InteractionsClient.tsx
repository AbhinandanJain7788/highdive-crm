"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { avatarLetterFor } from "@/lib/mock";
import { statusStyles, avatarColorFor } from "@/lib/mock/styles";
import { APPLICATION_STATUSES } from "@/lib/candidates.shared";
import {
  selectStyle,
  rangeBtnStyle,
  rangeStyle,
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
import { PAGE_SIZES } from "@/lib/interactions.shared";
import type { InteractionRow } from "@/lib/interactions.shared";
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];
type IxRange = "Today" | "Last 30 Days" | "Select Range";

const IX_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name-asc", label: "Name: A-Z" },
  { key: "name-desc", label: "Name: Z-A" },
  { key: "created-new", label: "Interacted: New to Old" },
  { key: "created-old", label: "Interacted: Old to New" },
];

const statusOptions = APPLICATION_STATUSES.map((s) => ({ id: s, label: statusStyles[s]?.label ?? s }));

export default function InteractionsClient({
  initialRows,
  initialTotal,
}: {
  initialRows: InteractionRow[];
  initialTotal: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<InteractionRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);

  const [range, setRange] = useState<IxRange>("Last 30 Days");
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("created-new");
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [openStatusPopover, setOpenStatusPopover] = useState(false);
  const [openSortPopover, setOpenSortPopover] = useState(false);

  const statusKey = [...selectedStatuses].join(",");

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) return;
    setPage(1);
  }, [search, statusKey, range, appliedDateRange, sortKey, pageSize]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusKey) params.set("status", statusKey);
    params.set("sort", sortKey);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    const now = new Date();
    if (range === "Today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      params.set("interactedFrom", start.toISOString());
    } else if (range === "Last 30 Days") {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      params.set("interactedFrom", from.toISOString());
    } else if (range === "Select Range" && appliedDateRange) {
      const bounds = dateRangeBounds(appliedDateRange);
      if (bounds) {
        params.set("interactedFrom", new Date(bounds.from).toISOString());
        params.set("interactedTo", new Date(bounds.to).toISOString());
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/interactions?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Could not load interactions.");
        const body = await res.json();
        setRows(body.data ?? []);
        const nextTotal = body.total ?? 0;
        setTotal(nextTotal);
        // The API answers an out-of-range page with an empty list and the true total
        // (lib/format.ts > rangeOverflow) rather than erroring, so clamp back onto the
        // last real page. Covers the cases the filter reset above cannot: a deep-linked
        // stale page, or rows deleted under us by another user while we sat on page 4.
        const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize));
        if (page > maxPage) setPage(maxPage);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setLoadError(err instanceof Error ? err.message : "Could not load interactions.");
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search, statusKey, range, appliedDateRange, sortKey, page, pageSize]);

  function toggleStatus(id: string) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>
          {total.toLocaleString()}
          <br />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4B5565" }}>Interactions</span>
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
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 8, padding: 3 }}>
          <div onClick={() => setRange("Today")} style={{ ...rangeBtnStyle, ...rangeStyle(range === "Today") }}>
            Today
          </div>
          <div onClick={() => setRange("Last 30 Days")} style={{ ...rangeBtnStyle, ...rangeStyle(range === "Last 30 Days") }}>
            Last 30 Days
          </div>
          <div onClick={() => setRange("Select Range")} style={{ ...rangeBtnStyle, ...rangeStyle(range === "Select Range") }}>
            Select Range
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <IconButton label="Sort by" onClick={() => setOpenSortPopover((v) => !v)}>
            <SortAzIcon />
          </IconButton>
          {openSortPopover && (
            <SortPopover value={sortKey} onChange={setSortKey} onClose={() => setOpenSortPopover(false)} options={IX_SORT_OPTIONS} />
          )}
        </div>
        {loading && <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>Loading…</span>}
      </div>

      {range === "Select Range" && (
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
            gridTemplateColumns: "1.8fr 1.1fr 1.2fr 1fr 1.1fr 1.1fr",
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
          <div>Interacted On</div>
          <div>Sourced by</div>
          <div>Assigned By</div>
          <div>Assign To</div>
        </div>
        {rows.map((ix) => {
          const style = ix.status ? statusStyles[ix.status] : null;
          return (
            <div
              key={ix.applicationId}
              onClick={() => router.push(`/candidates/${ix.candidateId}`)}
              style={{
                display: "grid",
                gridTemplateColumns: "1.8fr 1.1fr 1.2fr 1fr 1.1fr 1.1fr",
                gap: 10,
                alignItems: "center",
                padding: "11px 16px",
                borderBottom: "1px solid #F4F5F8",
                borderLeft: "3px solid #FF5C35",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: avatarColorFor(ix.name),
                    color: "#FFFFFF",
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {avatarLetterFor(ix.name)}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{ix.name || "--"}</div>
                  <div style={{ fontSize: 12, color: "#9AA1AC" }}>{ix.phone || "--"}</div>
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
              <div style={{ fontSize: 12.5, color: "#4B5565" }}>{ix.interactedOn}</div>
              <div style={{ fontSize: 13, color: "#9AA1AC" }}>{ix.sourcedByName ?? "--"}</div>
              <div style={{ fontSize: 13, color: "#4B5565" }}>{ix.assignedByName ?? "--"}</div>
              <div style={{ fontSize: 13, color: "#4B5565" }}>{ix.assignToName ?? "--"}</div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
            {loading ? "Loading interactions…" : "No interactions match the current filters."}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 18, padding: "12px 18px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "#4B5565" }}>Rows per page</span>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: "6px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, color: "#4B5565", background: "#FFFFFF" }}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12.5, color: "#4B5565" }}>
            {total === 0 ? "0 of 0" : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={pagerButtonStyle(page <= 1)}>
              ← Prev
            </button>
            <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage} style={pagerButtonStyle(page >= lastPage)}>
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function pagerButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: "#FFFFFF",
    border: "1px solid #D9DCE3",
    color: disabled ? "#C9CED6" : "#1D2433",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
  };
}
