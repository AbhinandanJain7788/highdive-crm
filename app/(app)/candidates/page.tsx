"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  candidatesSeed,
  statusStyles,
  avatarColorFor,
  avatarLetterFor,
  withinCandidateRange,
  candidateDayRank,
  candidateCreatedOnMs,
  stageForStatus,
} from "@/lib/mock";
import {
  COLUMN_LABELS,
  DEFAULT_COLUMNS,
  statusOptionsFor,
  userName,
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

type CustomerRange = "Overall" | "Last 30 Days" | "Select Range";

export default function CandidatesListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<CustomerRange>("Overall");

  const [statusMode, setStatusMode] = useState<StatusMode>("status");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [userScope, setUserScope] = useState<UserScope>("selected");

  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("created-new");
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_COLUMNS);

  const [openStatusPopover, setOpenStatusPopover] = useState(false);
  const [openSortPopover, setOpenSortPopover] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showManageColumns, setShowManageColumns] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bounds = range === "Select Range" && appliedDateRange ? dateRangeBounds(appliedDateRange) : null;

    let list = candidatesSeed.filter((c) => {
      let rangeOk = true;
      if (range === "Last 30 Days") rangeOk = withinCandidateRange(c.createdOn, "Last 30 Days");
      else if (bounds) {
        const ms = candidateCreatedOnMs(c.createdOn);
        rangeOk = ms >= bounds.from && ms <= bounds.to;
      }
      const searchOk = !q || c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""));
      const statusValue = statusMode === "status" ? c.status : stageForStatus(c.status);
      const statusOk = selectedStatuses.size === 0 || selectedStatuses.has(statusValue);
      const sourceOk = selectedSources.size === 0 || selectedSources.has(c.source);
      const scopeOk = userScope === "selected" || c.recruiterId === null;
      return rangeOk && searchOk && statusOk && sourceOk && scopeOk;
    });

    list = [...list].sort((a, b) => {
      if (sortKey === "name-asc") return a.name.localeCompare(b.name);
      if (sortKey === "name-desc") return b.name.localeCompare(a.name);
      const rankDiff = candidateDayRank(a.createdOn) - candidateDayRank(b.createdOn);
      return sortKey === "created-new" ? rankDiff : -rankDiff;
    });

    return list.map((c) => ({
      ...c,
      avatarLetter: avatarLetterFor(c.name),
      avatarColor: avatarColorFor(c.name),
      badgeBg: statusStyles[c.status].bg,
      badgeColor: statusStyles[c.status].color,
      badgeLabel: statusStyles[c.status].label,
      recruiterLabel: userName(c.recruiterId),
      showDedup: c.isDuplicate,
    }));
  }, [search, range, appliedDateRange, statusMode, selectedStatuses, selectedSources, userScope, sortKey]);

  const activeFilterCount = (selectedStatuses.size > 0 ? 1 : 0) + (selectedSources.size > 0 ? 1 : 0);
  const statusOptions = statusOptionsFor(statusMode);

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
          {filtered.length}
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
      </div>

      {range === "Select Range" && (
        <DateRangeBar value={dateRange} onChange={setDateRange} onApply={() => setAppliedDateRange(dateRange)} />
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
        {filtered.map((c) => (
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
                  background: c.avatarColor,
                  color: "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {c.avatarLetter}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "#9AA1AC" }}>{c.phone}</div>
              </div>
              {c.showDedup && (
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
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: c.badgeBg,
                  color: c.badgeColor,
                }}
              >
                {c.badgeLabel}
              </span>
            </div>
            {visibleColumns.map((id) => (
              <div key={id}>{renderColumnCell(id, c)}</div>
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
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
            No customers match the current filters.
          </div>
        )}
      </div>

      {showMoreFilters && (
        <MoreFiltersPanel
          initialStatusMode={statusMode}
          initialStatuses={selectedStatuses}
          initialSources={selectedSources}
          onCancel={() => setShowMoreFilters(false)}
          onApply={(mode, statuses, sources) => {
            setStatusMode(mode);
            setSelectedStatuses(statuses);
            setSelectedSources(sources);
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
