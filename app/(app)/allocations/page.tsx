"use client";

import { useMemo, useState } from "react";
import {
  candidatesSeed,
  candidateAvatarColor,
  avatarLetterFor,
  withinCandidateRange,
  candidateDayRank,
  candidateCreatedOnMs,
  statusStyles,
  type ApplicationStatus,
} from "@/lib/mock";
import {
  COLUMN_LABELS,
  DEFAULT_COLUMNS,
  statusOptionsFor,
  statusFilterValue,
  matchesLocation,
  priorityOf,
  renderColumnCell,
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

type AllocRange = "Overall" | "Last 30 Days" | "Select Range";
type AllocTab = "new" | "attempted";

const TERMINAL_STATUSES: ApplicationStatus[] = ["selected", "rejected", "joined"];

export default function AllocationsPage() {
  const [allocationsRange, setAllocationsRange] = useState<AllocRange>("Overall");
  const [allocationsTab, setAllocationsTab] = useState<AllocTab>("new");
  const [search, setSearch] = useState("");

  const [statusMode, setStatusMode] = useState<StatusMode>("status");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [locationFilter, setLocationFilter] = useState("");
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());
  const [userScope, setUserScope] = useState<UserScope>("selected");

  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("created-new");
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_COLUMNS);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const [openStatusPopover, setOpenStatusPopover] = useState(false);
  const [openSortPopover, setOpenSortPopover] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showManageColumns, setShowManageColumns] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bounds = allocationsRange === "Select Range" && appliedDateRange ? dateRangeBounds(appliedDateRange) : null;

    let list = candidatesSeed.filter((c) => {
      let rangeOk = true;
      if (allocationsRange === "Last 30 Days") rangeOk = withinCandidateRange(c.createdOn, "Last 30 Days");
      else if (bounds) {
        const ms = candidateCreatedOnMs(c.createdOn);
        rangeOk = ms >= bounds.from && ms <= bounds.to;
      }
      const searchOk = !q || c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""));
      const statusValue = statusFilterValue(c.status, statusMode);
      const statusOk = selectedStatuses.size === 0 || selectedStatuses.has(statusValue);
      const locationOk = matchesLocation(c.id, locationFilter);
      const priorityOk = selectedPriorities.size === 0 || selectedPriorities.has(priorityOf(c.id));
      // "Common Pool" is the unassigned bucket; "Selected Users" is everything the
      // signed-in user's team owns, which for this mock is the whole list.
      const scopeOk = userScope === "selected" || c.recruiterId === null;
      return rangeOk && searchOk && statusOk && locationOk && priorityOk && scopeOk;
    });

    list = [...list].sort((a, b) => {
      if (sortKey === "name-asc") return a.name.localeCompare(b.name);
      if (sortKey === "name-desc") return b.name.localeCompare(a.name);
      const rankDiff = candidateDayRank(a.createdOn) - candidateDayRank(b.createdOn);
      return sortKey === "created-new" ? rankDiff : -rankDiff;
    });

    return list;
  }, [search, allocationsRange, appliedDateRange, statusMode, selectedStatuses, locationFilter, selectedPriorities, userScope, sortKey]);

  const allocationsNewList = filtered.filter((c) => c.recruiterId === null);
  const allocationsAttemptedList = filtered.filter(
    (c) => c.recruiterId !== null && c.calls.length > 0 && !TERMINAL_STATUSES.includes(c.status)
  );
  const visibleAllocations = allocationsTab === "new" ? allocationsNewList : allocationsAttemptedList;
  const allocationsCount = allocationsNewList.length + allocationsAttemptedList.length;

  const activeFilterCount =
    (selectedStatuses.size > 0 ? 1 : 0) + (locationFilter.trim() ? 1 : 0) + (selectedPriorities.size > 0 ? 1 : 0);

  const statusOptions = statusOptionsFor(statusMode);

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
    setSelectedRowIds((prev) => (prev.size === visibleAllocations.length ? new Set() : new Set(visibleAllocations.map((a) => a.id))));
  }

  // minmax keeps every column readable once 10 are switched on — the table scrolls
  // sideways instead of squeezing each cell into an unreadable sliver.
  const gridTemplateColumns = `44px minmax(200px, 1.6fr) minmax(130px, 1.1fr) ${visibleColumns
    .map(() => "minmax(140px, 1.1fr)")
    .join(" ")} minmax(96px, 1fr)`;

  return (
    <div data-screen-label="Allocations">
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>
          {allocationsCount}
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
          <div onClick={() => setAllocationsRange("Overall")} style={{ ...rangeBtnStyle, ...rangeStyle(allocationsRange === "Overall") }}>
            Overall
          </div>
          <div onClick={() => setAllocationsRange("Last 30 Days")} style={{ ...rangeBtnStyle, ...rangeStyle(allocationsRange === "Last 30 Days") }}>
            Last 30 Days
          </div>
          <div onClick={() => setAllocationsRange("Select Range")} style={{ ...rangeBtnStyle, ...rangeStyle(allocationsRange === "Select Range") }}>
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
      </div>

      {allocationsRange === "Select Range" && (
        <DateRangeBar value={dateRange} onChange={setDateRange} onApply={() => setAppliedDateRange(dateRange)} />
      )}

      <div style={{ display: "flex", gap: 24, marginBottom: 2, borderBottom: "1px solid #E7E9EE" }}>
        <div
          onClick={() => setAllocationsTab("new")}
          style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, ...tabStyle(allocationsTab === "new") }}
        >
          New{" "}
          <span style={{ background: "#FF5C35", color: "#FFFFFF", borderRadius: 10, padding: "1px 8px", fontSize: 12 }}>
            {allocationsNewList.length}
          </span>
        </div>
        <div
          onClick={() => setAllocationsTab("attempted")}
          style={{ paddingBottom: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, ...tabStyle(allocationsTab === "attempted") }}
        >
          Attempted{" "}
          <span style={{ background: "#EEF0F5", color: "#4B5565", borderRadius: 10, padding: "1px 8px", fontSize: 12 }}>
            {allocationsAttemptedList.length}
          </span>
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
            <input type="checkbox" checked={selectedRowIds.size > 0 && selectedRowIds.size === visibleAllocations.length} onChange={toggleAllRows} />
          </div>
          <div>Name</div>
          <div>Status</div>
          {visibleColumns.map((id) => (
            <div key={id}>{COLUMN_LABELS[id]}</div>
          ))}
          <div>Actions</div>
        </div>
        {visibleAllocations.map((a) => (
          <div
            key={a.id}
            style={{
              display: "grid",
              gridTemplateColumns,
              gap: 10,
              alignItems: "center",
              padding: "11px 16px",
              borderBottom: "1px solid #F4F5F8",
              whiteSpace: "nowrap",
            }}
          >
            <div>
              <input type="checkbox" checked={selectedRowIds.has(a.id)} onChange={() => toggleRow(a.id)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: candidateAvatarColor(a),
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
            </div>
            {visibleColumns.map((id) => (
              <div key={id}>{renderColumnCell(id, a)}</div>
            ))}
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #FFD9CC", background: "#FFF5F2", color: "#FF5C35", cursor: "pointer" }}>
                +
              </button>
              <button style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #FFD9CC", background: "#FFF5F2", color: "#FF5C35", cursor: "pointer" }}>
                📞
              </button>
            </div>
          </div>
        ))}
        {visibleAllocations.length === 0 && (
          <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
            No allocations match the current filters.
          </div>
        )}
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
