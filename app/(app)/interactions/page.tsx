"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  candidatesSeed,
  usersSeed,
  statusStyles,
  avatarLetterFor,
  candidateAvatarColor,
  callDateRank,
  callDateMs,
  type ApplicationStatus,
} from "@/lib/mock";
import {
  ALL_USER_KEYS,
  UNASSIGNED_ID,
  userOptions,
  statusOptionsFor,
  statusFilterValue,
  matchesLocation,
  priorityOf,
  selectStyle,
  rangeBtnStyle,
  rangeStyle,
  CheckboxListPopover,
  SortPopover,
  MoreFiltersPanel,
  DateRangeBar,
  DEFAULT_DATE_RANGE,
  dateRangeBounds,
  IconButton,
  FunnelIcon,
  SortAzIcon,
  type StatusMode,
  type SortKey,
  type DateRange,
} from "@/components/ListFilters";

type IxRange = "Today" | "Last 30 Days" | "Select Range";
type UniqueMode = "Unique" | "All";

const IX_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name-asc", label: "Name: A-Z" },
  { key: "name-desc", label: "Name: Z-A" },
  { key: "created-new", label: "Interacted: New to Old" },
  { key: "created-old", label: "Interacted: Old to New" },
];

function userName(id: string | null): string {
  if (!id) return "--";
  return usersSeed.find((u) => u.id === id)?.name ?? "--";
}

type InteractionRow = {
  key: string;
  candidateId: string;
  name: string;
  phone: string;
  status: ApplicationStatus;
  interactedOn: string;
  source: string;
  assignedBy: string;
  assignTo: string;
  recruiterId: string | null;
  avatarLetter: string;
  avatarColor: string;
  badgeBg: string;
  badgeColor: string;
  railColor: string;
  dayRank: number;
  dateMs: number;
};

export default function InteractionsPage() {
  const router = useRouter();
  const [interactionsRange, setInteractionsRange] = useState<IxRange>("Last 30 Days");
  const [interactionSearch, setInteractionSearch] = useState("");
  const [interactionUniqueMode, setInteractionUniqueMode] = useState<UniqueMode>("Unique");
  const [interactionRowsPerPage, setInteractionRowsPerPage] = useState(10);
  const [interactionsPage, setInteractionsPage] = useState(0);

  const [statusMode, setStatusMode] = useState<StatusMode>("status");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [locationFilter, setLocationFilter] = useState("");
  const [selectedPriorities, setSelectedPriorities] = useState<Set<string>>(new Set());
  const [selectedUserKeys, setSelectedUserKeys] = useState<Set<string>>(new Set(ALL_USER_KEYS));
  const [sortKey, setSortKey] = useState<SortKey>("created-new");
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | null>(null);

  const [openStatusPopover, setOpenStatusPopover] = useState(false);
  const [openUsersPopover, setOpenUsersPopover] = useState(false);
  const [openSortPopover, setOpenSortPopover] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const candidates = candidatesSeed;

  const allRows: InteractionRow[] = useMemo(() => {
    const rows: InteractionRow[] = [];
    candidates.forEach((c) => {
      c.calls.forEach((call, i) => {
        const style = statusStyles[c.status] ?? { bg: "#EEF0F5", color: "#5B6472", label: c.status };
        rows.push({
          key: c.id + "-" + i,
          candidateId: c.id,
          name: c.name,
          phone: c.phone,
          status: c.status,
          interactedOn: call.date,
          source: c.source,
          assignedBy: call.by || userName(c.recruiterId),
          assignTo: userName(c.recruiterId),
          recruiterId: c.recruiterId,
          avatarLetter: avatarLetterFor(c.name),
          avatarColor: candidateAvatarColor(c),
          badgeBg: style.bg,
          badgeColor: style.color,
          railColor: "#FF5C35",
          dayRank: callDateRank(call.date),
          dateMs: callDateMs(call.date),
        });
      });
    });
    return rows;
  }, [candidates]);

  const statusOptions = statusOptionsFor(statusMode);
  const activeFilterCount =
    (selectedStatuses.size > 0 ? 1 : 0) + (locationFilter.trim() ? 1 : 0) + (selectedPriorities.size > 0 ? 1 : 0);
  const usersNarrowed = selectedUserKeys.size < ALL_USER_KEYS.length;

  let interactionRows = allRows;
  if (interactionsRange === "Today") {
    interactionRows = interactionRows.filter((r) => r.dayRank === 0);
  } else if (interactionsRange === "Last 30 Days") {
    interactionRows = interactionRows.filter((r) => r.dayRank <= 29);
  } else if (interactionsRange === "Select Range" && appliedDateRange) {
    const bounds = dateRangeBounds(appliedDateRange);
    if (bounds) interactionRows = interactionRows.filter((r) => r.dateMs >= bounds.from && r.dateMs <= bounds.to);
  }
  if (interactionUniqueMode === "Unique") {
    const seen = new Set<string>();
    interactionRows = interactionRows.filter((r) => {
      if (seen.has(r.candidateId)) return false;
      seen.add(r.candidateId);
      return true;
    });
  }
  const ixQuery = interactionSearch.trim().toLowerCase();
  if (ixQuery) {
    interactionRows = interactionRows.filter(
      (r) => r.name.toLowerCase().includes(ixQuery) || r.phone.replace(/\s/g, "").includes(ixQuery.replace(/\s/g, ""))
    );
  }
  if (selectedStatuses.size > 0) {
    interactionRows = interactionRows.filter((r) => {
      const value = statusFilterValue(r.status, statusMode);
      return selectedStatuses.has(value);
    });
  }
  if (locationFilter.trim()) {
    interactionRows = interactionRows.filter((r) => matchesLocation(r.candidateId, locationFilter));
  }
  if (selectedPriorities.size > 0) {
    interactionRows = interactionRows.filter((r) => selectedPriorities.has(priorityOf(r.candidateId)));
  }
  interactionRows = interactionRows.filter((r) => {
    const userKey = r.recruiterId === null ? UNASSIGNED_ID : r.recruiterId;
    return selectedUserKeys.has(userKey);
  });

  interactionRows = [...interactionRows].sort((a, b) => {
    if (sortKey === "name-asc") return a.name.localeCompare(b.name);
    if (sortKey === "name-desc") return b.name.localeCompare(a.name);
    const rankDiff = a.dayRank - b.dayRank;
    return sortKey === "created-new" ? rankDiff : -rankDiff;
  });

  const ixPerPage = interactionRowsPerPage || 10;
  const ixTotal = interactionRows.length;
  const ixMaxPage = Math.max(0, Math.ceil(ixTotal / ixPerPage) - 1);
  const ixPage = Math.min(interactionsPage, ixMaxPage);
  const ixStart = ixPage * ixPerPage;
  const visibleInteractions = interactionRows.slice(ixStart, ixStart + ixPerPage);
  const ixPrevColor = ixPage === 0 ? "#C9CED6" : "#4B5565";
  const ixNextColor = ixPage >= ixMaxPage ? "#C9CED6" : "#4B5565";
  const interactionRangeLabel =
    ixTotal === 0 ? "0 of 0" : `${ixStart + 1}-${Math.min(ixStart + ixPerPage, ixTotal)} of ${ixTotal}`;

  function toggleStatus(id: string) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setInteractionsPage(0);
  }
  function toggleUser(id: string) {
    setSelectedUserKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setInteractionsPage(0);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>
          {ixTotal.toLocaleString()}
          <br />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4B5565" }}>Interactions</span>
        </div>
        <div style={{ flex: 1, maxWidth: 250, display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid #D9DCE3", borderRadius: 7, padding: "8px 12px" }}>
          <input
            type="text"
            value={interactionSearch}
            onChange={(e) => {
              setInteractionSearch(e.target.value);
              setInteractionsPage(0);
            }}
            placeholder="Search Phone/Name"
            style={{ border: "none", outline: "none", fontSize: 13, color: "#1D2433", flex: 1, background: "transparent" }}
          />
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#9AA1AC" strokeWidth="1.4" />
          </svg>
        </div>
        <select
          value={interactionUniqueMode}
          onChange={(e) => {
            setInteractionUniqueMode(e.target.value as UniqueMode);
            setInteractionsPage(0);
          }}
          style={{ padding: "8px 12px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, color: "#4B5565", background: "#FFFFFF", minWidth: 120 }}
        >
          <option value="Unique">Unique</option>
          <option value="All">All</option>
        </select>
        <select
          value={statusMode}
          onChange={(e) => {
            setStatusMode(e.target.value as StatusMode);
            setSelectedStatuses(new Set());
            setInteractionsPage(0);
          }}
          style={{ ...selectStyle, minWidth: 130 }}
        >
          <option value="status">By Status</option>
          <option value="stage">By Stage</option>
        </select>
        <div style={{ position: "relative" }}>
          <div onClick={() => setOpenStatusPopover((v) => !v)} style={{ ...selectStyle, minWidth: 170, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
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

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 8, padding: 3 }}>
          <div onClick={() => { setInteractionsRange("Today"); setInteractionsPage(0); }} style={{ ...rangeBtnStyle, ...rangeStyle(interactionsRange === "Today") }}>
            Today
          </div>
          <div onClick={() => { setInteractionsRange("Last 30 Days"); setInteractionsPage(0); }} style={{ ...rangeBtnStyle, ...rangeStyle(interactionsRange === "Last 30 Days") }}>
            Last 30 Days
          </div>
          <div onClick={() => { setInteractionsRange("Select Range"); setInteractionsPage(0); }} style={{ ...rangeBtnStyle, ...rangeStyle(interactionsRange === "Select Range") }}>
            Select Range
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <div onClick={() => setOpenUsersPopover((v) => !v)} style={{ ...selectStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, minWidth: 150 }}>
            {usersNarrowed ? `${selectedUserKeys.size} Assigned By` : "Assigned By"}
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#9AA1AC" }}>▾</span>
          </div>
          {openUsersPopover && (
            <CheckboxListPopover
              options={userOptions}
              selected={selectedUserKeys}
              onToggle={toggleUser}
              onClose={() => setOpenUsersPopover(false)}
              searchPlaceholder="Search Users"
            />
          )}
        </div>

        <IconButton label="Filter" onClick={() => setShowMoreFilters(true)} active={activeFilterCount > 0}>
          <FunnelIcon />
        </IconButton>

        <div style={{ position: "relative" }}>
          <IconButton label="Sort by" onClick={() => setOpenSortPopover((v) => !v)}>
            <SortAzIcon />
          </IconButton>
          {openSortPopover && (
            <SortPopover value={sortKey} onChange={setSortKey} onClose={() => setOpenSortPopover(false)} options={IX_SORT_OPTIONS} />
          )}
        </div>
      </div>

      {interactionsRange === "Select Range" && (
        <DateRangeBar
          value={dateRange}
          onChange={setDateRange}
          onApply={() => {
            setAppliedDateRange(dateRange);
            setInteractionsPage(0);
          }}
        />
      )}

      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.8fr 1.1fr 1.2fr 1fr 1.1fr 1.1fr 0.9fr",
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
          <div>Actions</div>
        </div>
        {visibleInteractions.map((ix) => (
          <div
            key={ix.key}
            onClick={() => router.push(`/candidates/${ix.candidateId}`)}
            style={{
              display: "grid",
              gridTemplateColumns: "1.8fr 1.1fr 1.2fr 1fr 1.1fr 1.1fr 0.9fr",
              gap: 10,
              alignItems: "center",
              padding: "11px 16px",
              borderBottom: "1px solid #F4F5F8",
              borderLeft: `3px solid ${ix.railColor}`,
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: ix.avatarColor,
                  color: "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {ix.avatarLetter}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{ix.name}</div>
                <div style={{ fontSize: 12, color: "#9AA1AC" }}>{ix.phone}</div>
              </div>
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: ix.badgeBg, color: ix.badgeColor }}>
                {statusStyles[ix.status]?.label ?? ix.status}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "#4B5565" }}>{ix.interactedOn}</div>
            <div style={{ fontSize: 13, color: "#9AA1AC" }}>{ix.source}</div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{ix.assignedBy}</div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{ix.assignTo}</div>
            <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #FFD9CC", background: "#FFF5F2", color: "#FF5C35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, cursor: "pointer" }}>
                +
              </div>
              <div style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #FFD9CC", background: "#FFF5F2", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
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
        {visibleInteractions.length === 0 && (
          <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
            No interactions match the current filters.
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 18, padding: "12px 18px" }}>
          <span style={{ fontSize: 12.5, color: "#4B5565" }}>Rows per page</span>
          <select
            value={interactionRowsPerPage}
            onChange={(e) => {
              setInteractionRowsPerPage(parseInt(e.target.value, 10));
              setInteractionsPage(0);
            }}
            style={{ padding: "6px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, color: "#4B5565", background: "#FFFFFF" }}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
          <span style={{ fontSize: 12.5, color: "#4B5565" }}>{interactionRangeLabel}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg onClick={() => setInteractionsPage(0)} width="14" height="14" viewBox="0 0 14 14" style={{ cursor: "pointer" }}>
              <path d="M9 3L5 7l4 4" fill="none" stroke={ixPrevColor} strokeWidth="1.5" />
              <line x1="4" y1="3" x2="4" y2="11" stroke={ixPrevColor} strokeWidth="1.5" />
            </svg>
            <svg onClick={() => setInteractionsPage((p) => Math.max(0, p - 1))} width="14" height="14" viewBox="0 0 14 14" style={{ cursor: "pointer" }}>
              <path d="M9 3L5 7l4 4" fill="none" stroke={ixPrevColor} strokeWidth="1.5" />
            </svg>
            <svg onClick={() => setInteractionsPage(Math.min(ixMaxPage, ixPage + 1))} width="14" height="14" viewBox="0 0 14 14" style={{ cursor: "pointer" }}>
              <path d="M5 3l4 4-4 4" fill="none" stroke={ixNextColor} strokeWidth="1.5" />
            </svg>
            <svg onClick={() => setInteractionsPage(ixMaxPage)} width="14" height="14" viewBox="0 0 14 14" style={{ cursor: "pointer" }}>
              <path d="M5 3l4 4-4 4" fill="none" stroke={ixNextColor} strokeWidth="1.5" />
              <line x1="10" y1="3" x2="10" y2="11" stroke={ixNextColor} strokeWidth="1.5" />
            </svg>
          </div>
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
            setInteractionsPage(0);
          }}
        />
      )}
    </div>
  );
}
