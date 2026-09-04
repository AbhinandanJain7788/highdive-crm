"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { avatarColorFor, avatarLetterFor, statusStyles, crmStageForStatus, type ApplicationStatus } from "@/lib/mock";
import {
  COLUMN_LABELS,
  DEFAULT_COLUMNS,
  statusOptionsFor,
  selectStyle,
  rangeBtnStyle,
  rangeStyle,
  tabStyle,
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
import { PAGE_SIZES, APPLICATION_STATUSES } from "@/lib/candidates.shared";
import type { AllocationRow, AllocationBucket } from "@/lib/allocations.shared";

type AllocRange = "Overall" | "Last 30 Days" | "Select Range";

function statusesForSelection(selected: Set<string>, mode: StatusMode): ApplicationStatus[] {
  if (selected.size === 0) return [];
  if (mode === "status") return APPLICATION_STATUSES.filter((s) => selected.has(s));
  return APPLICATION_STATUSES.filter((s) => selected.has(crmStageForStatus(s)));
}

const cellMuted: React.CSSProperties = { fontSize: 12.5, color: "#9AA1AC" };
const cellText: React.CSSProperties = { fontSize: 12.5, color: "#4B5565" };

export default function AllocationsClient({
  initialRows,
  initialTotal,
  initialCounts,
}: {
  initialRows: AllocationRow[];
  initialTotal: number;
  initialCounts: { new: number; attempted: number };
}) {
  const [bucket, setBucket] = useState<AllocationBucket>("new");
  const [range, setRange] = useState<AllocRange>("Overall");
  const [search, setSearch] = useState("");

  const [statusMode, setStatusMode] = useState<StatusMode>("status");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [userScope, setUserScope] = useState<UserScope>("selected");

  // "Selected Users" previously applied no filtering at all — just the dropdown label
  // for "not Common Pool" (Phase 9 finding). This is the real per-recruiter narrowing:
  // an explicit multi-select of specific users, empty by default (= everyone, same as
  // before), applied only in "selected" scope.
  const [teamOptions, setTeamOptions] = useState<{ id: string; label: string }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [openUsersPopover, setOpenUsersPopover] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/team?status=active")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => {
        if (cancelled) return;
        setTeamOptions((body.data ?? []).map((u: { id: string; name: string }) => ({ id: u.id, label: u.name })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleSelectedUser(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("created-new");
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_COLUMNS.filter((c) => c !== "assignTo"));
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const [openStatusPopover, setOpenStatusPopover] = useState(false);
  const [openSortPopover, setOpenSortPopover] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showManageColumns, setShowManageColumns] = useState(false);

  const [rows, setRows] = useState<AllocationRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [counts, setCounts] = useState(initialCounts);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const statusKey = useMemo(
    () => statusesForSelection(selectedStatuses, statusMode).join(","),
    [selectedStatuses, statusMode]
  );

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) return;
    setPage(1);
  }, [bucket, search, range, appliedDateRange, statusKey, userScope, selectedUserIds, sortKey, pageSize]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const params = new URLSearchParams();
    params.set("bucket", bucket);
    if (search.trim()) params.set("search", search.trim());
    if (statusKey) params.set("status", statusKey);
    if (userScope === "pool") params.set("pool", "true");
    else if (selectedUserIds.size > 0) params.set("assignToIds", [...selectedUserIds].join(","));
    params.set("sort", sortKey);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    if (range === "Last 30 Days") {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      params.set("createdFrom", from.toISOString());
    } else if (range === "Select Range" && appliedDateRange) {
      const bounds = dateRangeBounds(appliedDateRange);
      if (bounds) {
        params.set("createdFrom", new Date(bounds.from).toISOString());
        params.set("createdTo", new Date(bounds.to).toISOString());
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/allocations?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Could not load allocations.");
        const body = await res.json();
        setRows(body.data ?? []);
        setTotal(body.total ?? 0);
        if (body.counts) setCounts(body.counts);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setLoadError(err instanceof Error ? err.message : "Could not load allocations.");
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [bucket, search, statusKey, userScope, selectedUserIds, sortKey, page, pageSize, range, appliedDateRange]);

  const activeFilterCount = selectedStatuses.size > 0 ? 1 : 0;
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
  function toggleRow(id: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllRows() {
    setSelectedRowIds((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.applicationId))));
  }

  const gridTemplateColumns = `44px minmax(200px, 1.6fr) minmax(120px, 1fr) 130px 130px 130px 130px ${visibleColumns
    .map(() => "minmax(140px, 1.1fr)")
    .join(" ")} minmax(96px, 1fr)`;

  return (
    <div data-screen-label="Allocations">
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>
          {counts.new + counts.attempted}
          <br />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4B5565" }}>Allocations</span>
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

        {userScope === "selected" && (
          <div style={{ position: "relative" }}>
            <div
              onClick={() => setOpenUsersPopover((v) => !v)}
              style={{ ...selectStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, minWidth: 150 }}
            >
              {selectedUserIds.size > 0 ? `${selectedUserIds.size} user${selectedUserIds.size > 1 ? "s" : ""}` : "All Users"}
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#9AA1AC" }}>▾</span>
            </div>
            {openUsersPopover && (
              <CheckboxListPopover
                options={teamOptions}
                selected={selectedUserIds}
                onToggle={toggleSelectedUser}
                onClose={() => setOpenUsersPopover(false)}
                searchPlaceholder="Search users"
              />
            )}
          </div>
        )}

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
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {loadError}
        </div>
      )}

      <div style={{ display: "flex", gap: 24, marginBottom: 2, borderBottom: "1px solid #E7E9EE" }}>
        <div
          onClick={() => setBucket("new")}
          style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, ...tabStyle(bucket === "new") }}
        >
          New <span style={{ background: "#FF5C35", color: "#FFFFFF", borderRadius: 10, padding: "1px 8px", fontSize: 12 }}>{counts.new}</span>
        </div>
        <div
          onClick={() => setBucket("attempted")}
          style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, ...tabStyle(bucket === "attempted") }}
        >
          Attempted <span style={{ background: "#EEF0F5", color: "#4B5565", borderRadius: 10, padding: "1px 8px", fontSize: 12 }}>{counts.attempted}</span>
        </div>
      </div>

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
            borderBottom: "1px solid #EEF0F4",
            background: "#FAFBFC",
            whiteSpace: "nowrap",
          }}
        >
          <div>
            <input type="checkbox" checked={selectedRowIds.size > 0 && selectedRowIds.size === rows.length} onChange={toggleAllRows} />
          </div>
          <div>Name</div>
          <div>Status</div>
          <div>Created On</div>
          <div>Created By</div>
          <div>Assign To</div>
          <div>Sourced By</div>
          {visibleColumns.map((id) => (
            <div key={id}>{COLUMN_LABELS[id]}</div>
          ))}
          <div>Actions</div>
        </div>
        {rows.map((a) => (
          <div
            key={a.applicationId}
            style={{ display: "grid", gridTemplateColumns, gap: 10, alignItems: "center", padding: "11px 16px", borderBottom: "1px solid #F4F5F8", whiteSpace: "nowrap" }}
          >
            <div>
              <input type="checkbox" checked={selectedRowIds.has(a.applicationId)} onChange={() => toggleRow(a.applicationId)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: avatarColorFor(a.name),
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {avatarLetterFor(a.name)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "#9AA1AC" }}>{a.phone}</div>
              </div>
            </div>
            <div>
              {a.status ? (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: statusStyles[a.status]?.bg ?? "#E8F0FE",
                    color: statusStyles[a.status]?.color ?? "#1A56DB",
                  }}
                >
                  {statusStyles[a.status]?.label ?? a.status}
                </span>
              ) : (
                <span style={cellMuted}>--</span>
              )}
            </div>
            <div style={cellMuted}>{a.createdOn}</div>
            <div style={cellText}>{a.createdByName ?? "--"}</div>
            <div style={cellText}>{a.assignToName ?? "Unassigned"}</div>
            <div style={cellText}>{a.sourcedByName ?? "--"}</div>
            {visibleColumns.map((id) => (
              <div key={id} style={cellMuted}>--</div>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #FFD9CC", background: "#FFF5F2", color: "#FF5C35", cursor: "pointer" }}>+</button>
              <button style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #FFD9CC", background: "#FFF5F2", color: "#FF5C35", cursor: "pointer" }}>📞</button>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
            {loading ? "Loading allocations…" : "No allocations match the current filters."}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>Rows per page</span>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ ...selectStyle, minWidth: 72 }}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>
            {total === 0 ? "0 of 0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </span>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={pagerButtonStyle(page <= 1)}>
            ← Prev
          </button>
          <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage} style={pagerButtonStyle(page >= lastPage)}>
            Next →
          </button>
        </div>
      </div>

      {showMoreFilters && (
        <MoreFiltersPanel
          initialStatusMode={statusMode}
          initialStatuses={selectedStatuses}
          initialLocation=""
          initialPriorities={new Set()}
          showPriority={false}
          onCancel={() => setShowMoreFilters(false)}
          onApply={(mode, statuses) => {
            setStatusMode(mode);
            setSelectedStatuses(statuses);
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
