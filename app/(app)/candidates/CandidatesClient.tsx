"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  statusStyles,
  avatarColorFor,
  avatarLetterFor,
  crmStageForStatus,
  type ApplicationStatus,
  type MockCandidate,
} from "@/lib/mock";
import {
  COLUMN_LABELS,
  DEFAULT_COLUMNS,
  statusOptionsFor,
  matchesLocation,
  priorityOf,
  renderColumnCell,
  selectStyle,
  rangeBtnStyle,
  rangeStyle,
  CheckboxListPopover,
  SortPopover,
  MoreFiltersPanel,
  ManageColumnsModal,
  UserScopeDropdown,
  DateRangeBar,
  DEFAULT_DATE_RANGE,
  dateRangeBounds,
  IconButton,
  FunnelIcon,
  SortAzIcon,
  ColumnsIcon,
  type StatusMode,
  type SortKey,
  type ColumnId,
  type UserScope,
  type DateRange,
} from "@/components/ListFilters";
import { PAGE_SIZES, type CandidateRow } from "@/lib/candidates.shared";

type CustomerRange = "Overall" | "Last 30 Days" | "Select Range";

// The nine values `application_status` actually holds. The UI's status list also
// carries `not_eligible`, which has no enum value behind it yet — filtering on it
// would send a value Postgres rejects, so it's dropped from the query rather than
// silently returning everything. See claude.md's Phase 3 As-Built Notes.
const DB_STATUSES: ApplicationStatus[] = [
  "new",
  "contacted",
  "interview_scheduled",
  "interview_done",
  "selected",
  "rejected",
  "not_interested",
  "no_response",
  "joined",
];

// "By Stage" filters on a coarse CRM stage the database doesn't store — it's derived
// from status. Expanding each selected stage back into its statuses keeps the filter
// server-side and therefore correct across pages, instead of filtering one page.
function statusesForSelection(selected: Set<string>, mode: StatusMode): ApplicationStatus[] {
  if (selected.size === 0) return [];
  if (mode === "status") return DB_STATUSES.filter((s) => selected.has(s));
  return DB_STATUSES.filter((s) => selected.has(crmStageForStatus(s)));
}

export default function CandidatesClient({
  initialRows,
  initialTotal,
}: {
  initialRows: CandidateRow[];
  initialTotal: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<CustomerRange>("Overall");

  const [statusMode, setStatusMode] = useState<StatusMode>("status");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [locationFilter, setLocationFilter] = useState("");
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());
  const [userScope, setUserScope] = useState<UserScope>("selected");

  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("created-new");
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_COLUMNS);

  const [openStatusPopover, setOpenStatusPopover] = useState(false);
  const [openSortPopover, setOpenSortPopover] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showManageColumns, setShowManageColumns] = useState(false);

  const [rows, setRows] = useState<CandidateRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const statusKey = useMemo(
    () => statusesForSelection(selectedStatuses, statusMode).join(","),
    [selectedStatuses, statusMode]
  );

  // Any filter change puts us back on page 1 — staying on page 4 of a result set
  // that just shrank to one page shows an empty table.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) return;
    setPage(1);
  }, [search, range, appliedDateRange, statusKey, userScope, sortKey, pageSize]);

  useEffect(() => {
    // The server already rendered page 1 with the default filters; refetching it
    // immediately would just duplicate that round-trip.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusKey) params.set("status", statusKey);
    if (userScope !== "selected") params.set("unassigned", "true");
    params.set("sort", sortKey);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    if (range === "Last 30 Days") {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      params.set("createdFrom", from.toISOString());
    } else if (range === "Select Range" && appliedDateRange) {
      // Returns null for an incomplete range — leave the dates off rather than
      // sending an Invalid Date the API would reject.
      const bounds = dateRangeBounds(appliedDateRange);
      if (bounds) {
        params.set("createdFrom", new Date(bounds.from).toISOString());
        params.set("createdTo", new Date(bounds.to).toISOString());
      }
    }

    const controller = new AbortController();
    // Debounced so typing a name doesn't fire a request per keystroke; the abort
    // above means a slow earlier response can't overwrite a newer one.
    const timer = setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/candidates?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Could not load customers.");
        const body = await res.json();
        setRows(body.data ?? []);
        setTotal(body.total ?? 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setLoadError(err instanceof Error ? err.message : "Could not load customers.");
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search, statusKey, userScope, sortKey, page, pageSize, range, appliedDateRange]);

  // Location and Priority have no columns on `candidates` — they read the mock
  // profiles, which are keyed by seed ids and hold nothing for a real uuid. Applied
  // here over the loaded page so the controls keep behaving as built; they cannot
  // become server-side filters until those columns exist.
  const visibleRows = useMemo(() => {
    return rows.filter(
      (c) =>
        matchesLocation(c.id, locationFilter) &&
        (selectedPriorities.size === 0 || selectedPriorities.has(priorityOf(c.id)))
    );
  }, [rows, locationFilter, selectedPriorities]);

  const activeFilterCount =
    (selectedStatuses.size > 0 ? 1 : 0) + (locationFilter.trim() ? 1 : 0) + (selectedPriorities.size > 0 ? 1 : 0);
  const statusOptions = statusOptionsFor(statusMode);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  function toggleStatus(id: string) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const gridTemplateColumns = `minmax(200px, 1.8fr) minmax(130px, 1.2fr) ${visibleColumns
    .map(() => "minmax(140px, 1.2fr)")
    .join(" ")} minmax(90px, 0.9fr)`;

  return (
    <div data-screen-label="Candidates List">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginBottom: 10 }}>
        <button
          onClick={() => router.push("/import")}
          style={{
            background: "#FFFFFF",
            border: "1px solid #D9DCE3",
            color: "#1D2433",
            borderRadius: 6,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Import CSV
        </button>
        <button
          style={{
            background: "#FF5C35",
            border: "none",
            color: "#FFFFFF",
            borderRadius: 6,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Add Customer
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>
          {total}
          <br />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4B5565" }}>Customers</span>
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
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#9AA1AC" strokeWidth="1.4" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Phone/Name"
            style={{ border: "none", outline: "none", fontSize: 13, color: "#1D2433", flex: 1, background: "transparent" }}
          />
        </div>
        {search && (
          <div onClick={() => setSearch("")} style={{ fontSize: 13, fontWeight: 600, color: "#1A56DB", cursor: "pointer" }}>
            Clear
          </div>
        )}
        <div style={{ display: "flex", gap: 4, background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 8, padding: 3 }}>
          <div onClick={() => setRange("Overall")} style={{ ...rangeBtnStyle, ...rangeStyle(range === "Overall") }}>
            Overall
          </div>
          <div onClick={() => setRange("Last 30 Days")} style={{ ...rangeBtnStyle, ...rangeStyle(range === "Last 30 Days") }}>
            Last 30 Days
          </div>
          <div onClick={() => setRange("Select Range")} style={{ ...rangeBtnStyle, ...rangeStyle(range === "Select Range") }}>
            Select Range
          </div>
        </div>
        <select
          value={statusMode}
          onChange={(e) => {
            setStatusMode(e.target.value as StatusMode);
            setSelectedStatuses(new Set());
          }}
          style={selectStyle}
        >
          <option value="status">By Status</option>
          <option value="stage">By Stage</option>
        </select>
        <div style={{ position: "relative" }}>
          <div onClick={() => setOpenStatusPopover((v) => !v)} style={{ ...selectStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, minWidth: 140 }}>
            {selectedStatuses.size > 0 ? `${selectedStatuses.size} selected` : statusMode === "status" ? "Select Status" : "Select Stage"}
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

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <UserScopeDropdown value={userScope} onChange={setUserScope} />

        <IconButton label="Filter" onClick={() => setShowMoreFilters(true)} active={activeFilterCount > 0}>
          <FunnelIcon />
        </IconButton>

        <div style={{ position: "relative" }}>
          <IconButton label="Sort by" onClick={() => setOpenSortPopover((v) => !v)}>
            <SortAzIcon />
          </IconButton>
          {openSortPopover && <SortPopover value={sortKey} onChange={setSortKey} onClose={() => setOpenSortPopover(false)} />}
        </div>

        <IconButton label="Manage Table Columns" onClick={() => setShowManageColumns(true)}>
          <ColumnsIcon />
        </IconButton>

        {loading && <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>Loading…</span>}
      </div>

      {range === "Select Range" && (
        <DateRangeBar value={dateRange} onChange={setDateRange} onApply={() => setAppliedDateRange(dateRange)} />
      )}

      {loadError && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#B42318",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {loadError}
        </div>
      )}

      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden", overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns,
            gap: 10,
            padding: "10px 16px",
            fontSize: 11.5,
            fontWeight: 600,
            color: "#9AA1AC",
            textTransform: "uppercase",
            letterSpacing: 0.3,
            borderBottom: "1px solid #EEF0F4",
            background: "#FAFBFC",
            whiteSpace: "nowrap",
          }}
        >
          <div>Name</div>
          <div>Status</div>
          {visibleColumns.map((id) => (
            <div key={id}>{COLUMN_LABELS[id]}</div>
          ))}
          <div>Actions</div>
        </div>
        {visibleRows.map((c) => {
          // A candidate with no application yet has no status to badge.
          const badge = c.status ? statusStyles[c.status] : null;
          // renderColumnCell reads the MockCandidate shape; the live row supplies
          // the fields it actually has and a resolved recruiter name.
          const cellRow = {
            ...c,
            jobId: c.jobId ?? "",
            status: (c.status ?? "new") as ApplicationStatus,
            hasResume: c.hasResume,
            calls: [],
            recruiterName: c.recruiterName,
          } as unknown as MockCandidate & { recruiterName?: string | null; email?: string | null };

          return (
            <div
              key={c.id}
              onClick={() => router.push(`/candidates/${c.id}`)}
              style={{
                display: "grid",
                gridTemplateColumns,
                gap: 10,
                alignItems: "center",
                padding: "11px 16px",
                borderBottom: "1px solid #F4F5F8",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: avatarColorFor(c.name),
                    color: "#FFFFFF",
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {avatarLetterFor(c.name)}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "#9AA1AC" }}>{c.phone}</div>
                </div>
                {c.isDuplicate && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: "#FFF4E5",
                      color: "#B15C00",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    DUP
                  </span>
                )}
              </div>
              <div>
                {badge ? (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: badge.bg,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: "#9AA1AC" }}>No application</span>
                )}
              </div>
              {visibleColumns.map((id) => (
                <div key={id}>{renderColumnCell(id, cellRow)}</div>
              ))}
              <div>
                <button
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: "1px solid #FFD9CC",
                    background: "#FFF5F2",
                    color: "#FF5C35",
                    cursor: "pointer",
                  }}
                >
                  📞
                </button>
              </div>
            </div>
          );
        })}
        {visibleRows.length === 0 && (
          <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
            {loading ? "Loading customers…" : "No customers match the current filters."}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{ ...selectStyle, minWidth: 72 }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>
            {total === 0
              ? "0 of 0"
              : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </span>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={pagerButtonStyle(page <= 1)}>
            ← Prev
          </button>
          <button
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
            style={pagerButtonStyle(page >= lastPage)}
          >
            Next →
          </button>
        </div>
      </div>

      {showMoreFilters && (
        <MoreFiltersPanel
          initialStatusMode={statusMode}
          initialStatuses={selectedStatuses}
          initialLocation={locationFilter}
          initialPriorities={selectedPriorities}
          onCancel={() => setShowMoreFilters(false)}
          onApply={(mode, statuses, location, priorities) => {
            setStatusMode(mode);
            setSelectedStatuses(statuses);
            setLocationFilter(location);
            setSelectedPriorities(priorities);
            setShowMoreFilters(false);
          }}
        />
      )}

      {showManageColumns && (
        <ManageColumnsModal
          initialColumns={visibleColumns}
          onCancel={() => setShowManageColumns(false)}
          onSave={(cols) => {
            setVisibleColumns(cols);
            setShowManageColumns(false);
          }}
        />
      )}
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
