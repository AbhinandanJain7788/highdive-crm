"use client";

import { useMemo, useState } from "react";
import { candidatesSeed, usersSeed, followUpsSeed, statusStyles, avatarLetterFor, candidateAvatarColor, stageForStatus } from "@/lib/mock";
import {
  statusOptionsFor,
  selectStyle,
  CheckboxListPopover,
  SortPopover,
  MoreFiltersPanel,
  IconButton,
  FunnelIcon,
  SortAzIcon,
  type StatusMode,
  type SortKey,
} from "@/components/ListFilters";

type FuTab = "pending" | "upcoming";

// "Now" for the Pending/Upcoming split — per claude.md, treated as 2026-09-02 (India time).
const TODAY_KEY = "2026-09-02";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const FU_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name-asc", label: "Name: A-Z" },
  { key: "name-desc", label: "Name: Z-A" },
  { key: "created-new", label: "Follow-up: Soonest First" },
  { key: "created-old", label: "Follow-up: Latest First" },
];

function parseDueAt(iso: string): { dateKey: string; label: string } {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return { dateKey: "", label: "" };
  const [, y, mo, d, h, mi] = m;
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = (hour % 12 || 12).toString().padStart(2, "0");
  const dateKey = `${y}-${mo}-${d}`;
  const label = `${h12}:${mi} ${ampm}, ${parseInt(d, 10)} ${MONTHS[parseInt(mo, 10) - 1]}`;
  return { dateKey, label };
}

function userName(id: string): string {
  return usersSeed.find((u) => u.id === id)?.name ?? "--";
}

function fuTabStyle(active: boolean): React.CSSProperties {
  return active ? { background: "#1D2433", color: "#FFFFFF" } : { color: "#4B5565" };
}

export default function FollowUpsPage() {
  const [followUpsTab, setFollowUpsTab] = useState<FuTab>("pending");
  const [followUpSearch, setFollowUpSearch] = useState("");

  const [statusMode, setStatusMode] = useState<StatusMode>("status");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("created-new");

  const [openStatusPopover, setOpenStatusPopover] = useState(false);
  const [openSortPopover, setOpenSortPopover] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const statusOptions = statusOptionsFor(statusMode);
  const activeFilterCount = (selectedStatuses.size > 0 ? 1 : 0) + (selectedSources.size > 0 ? 1 : 0);

  const enriched = useMemo(() => {
    return followUpsSeed.map((f) => {
      const candidate = candidatesSeed.find((c) => c.id === f.candidateId);
      const { dateKey, label } = parseDueAt(f.dueAt);
      const bucket: FuTab = dateKey <= TODAY_KEY ? "pending" : "upcoming";
      const status = candidate?.status ?? "new";
      const style = statusStyles[status] ?? { bg: "#EEF0F5", color: "#5B6472", label: status };
      return {
        id: f.id,
        name: candidate?.name ?? "Unknown",
        phone: candidate?.phone ?? "--",
        status,
        statusLabel: style.label,
        source: candidate?.source ?? "--",
        dueOn: label,
        dueAtRaw: f.dueAt,
        bucket,
        assignedBy: userName(f.assignedById),
        assignTo: userName(f.assignToId),
        avatarLetter: candidate ? avatarLetterFor(candidate.name) : "?",
        avatarColor: candidate ? candidateAvatarColor(candidate) : "#9AA1AC",
        badgeBg: style.bg,
        badgeColor: style.color,
        dueIconColor: bucket === "pending" ? "#E0563B" : "#16A34A",
      };
    });
  }, []);

  const fuQuery = followUpSearch.trim().toLowerCase();
  let visibleFollowUps = enriched
    .filter((f) => f.bucket === followUpsTab)
    .filter((f) => {
      if (selectedStatuses.size === 0) return true;
      const value = statusMode === "status" ? f.status : stageForStatus(f.status);
      return selectedStatuses.has(value);
    })
    .filter((f) => selectedSources.size === 0 || selectedSources.has(f.source))
    .filter((f) => !fuQuery || f.name.toLowerCase().includes(fuQuery) || f.phone.replace(/\s/g, "").includes(fuQuery.replace(/\s/g, "")));

  visibleFollowUps = [...visibleFollowUps].sort((a, b) => {
    if (sortKey === "name-asc") return a.name.localeCompare(b.name);
    if (sortKey === "name-desc") return b.name.localeCompare(a.name);
    const diff = a.dueAtRaw.localeCompare(b.dueAtRaw);
    return sortKey === "created-new" ? diff : -diff;
  });

  const noFollowUps = visibleFollowUps.length === 0;

  function toggleStatus(id: string) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>
          {followUpsSeed.length}
          <br />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4B5565" }}>Follow-Ups</span>
        </div>
        <div style={{ width: 16, height: 16, borderRadius: "50%", border: "1px solid #C9CED6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#9AA1AC" }}>
          ?
        </div>
        <div style={{ width: 44, height: 34, border: "1px solid #D9DCE3", borderRadius: 7, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 16 16">
            <rect x="1.5" y="2" width="10" height="11" rx="1.4" fill="none" stroke="#4B5565" strokeWidth="1.3" />
            <circle cx="11.5" cy="11" r="2.6" fill="none" stroke="#4B5565" strokeWidth="1.2" />
            <line x1="13.4" y1="12.9" x2="15" y2="14.5" stroke="#4B5565" strokeWidth="1.2" />
          </svg>
          <svg width="9" height="9" viewBox="0 0 10 10">
            <path d="M1.5 3.5L5 7l3.5-3.5" fill="none" stroke="#4B5565" strokeWidth="1.3" />
          </svg>
        </div>
        <div style={{ flex: 1, maxWidth: 250, display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid #D9DCE3", borderRadius: 7, padding: "8px 12px" }}>
          <input
            type="text"
            value={followUpSearch}
            onChange={(e) => setFollowUpSearch(e.target.value)}
            placeholder="Search Phone/Name"
            style={{ border: "none", outline: "none", fontSize: 13, color: "#1D2433", flex: 1, background: "transparent" }}
          />
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#9AA1AC" strokeWidth="1.4" />
          </svg>
        </div>
        <select
          value={statusMode}
          onChange={(e) => {
            setStatusMode(e.target.value as StatusMode);
            setSelectedStatuses(new Set());
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
        <div style={{ display: "flex", gap: 4, background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 8, padding: 3 }}>
          <div onClick={() => setFollowUpsTab("pending")} style={{ padding: "6px 18px", borderRadius: 6, fontSize: 12.5, cursor: "pointer", ...fuTabStyle(followUpsTab === "pending") }}>
            Pending
          </div>
          <div onClick={() => setFollowUpsTab("upcoming")} style={{ padding: "6px 18px", borderRadius: 6, fontSize: 12.5, cursor: "pointer", ...fuTabStyle(followUpsTab === "upcoming") }}>
            Upcoming
          </div>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 6, border: "1px solid #E7E9EE", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 16 16">
            <rect x="1.5" y="3" width="13" height="11" rx="1.5" fill="none" stroke="#4B5565" strokeWidth="1.3" />
            <line x1="1.5" y1="6.4" x2="14.5" y2="6.4" stroke="#4B5565" strokeWidth="1.3" />
          </svg>
        </div>
        <div style={{ position: "relative", width: 34, height: 34, borderRadius: 6, border: "1px solid #E7E9EE", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 16 16">
            <circle cx="5.5" cy="5.5" r="2.4" fill="none" stroke="#4B5565" strokeWidth="1.2" />
            <circle cx="11" cy="6.5" r="1.8" fill="none" stroke="#4B5565" strokeWidth="1.2" />
            <path d="M1.5 13c0-2 2-3.4 4-3.4S9.5 11 9.5 13" fill="none" stroke="#4B5565" strokeWidth="1.2" />
          </svg>
          <div style={{ position: "absolute", top: -6, right: -6, background: "#FF5C35", color: "#FFFFFF", fontSize: 9.5, fontWeight: 700, borderRadius: 8, padding: "1px 5px" }}>
            11
          </div>
        </div>
        <IconButton label="Filter" onClick={() => setShowMoreFilters(true)} active={activeFilterCount > 0}>
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
      </div>

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
        {visibleFollowUps.map((fu) => (
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
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: fu.avatarColor,
                  color: "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {fu.avatarLetter}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{fu.name}</div>
                <div style={{ fontSize: 12, color: "#9AA1AC" }}>{fu.phone}</div>
              </div>
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: fu.badgeBg, color: fu.badgeColor }}>
                {fu.statusLabel}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12.5, color: "#4B5565" }}>{fu.dueOn}</span>
              <svg width="14" height="14" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6.4" fill="none" stroke={fu.dueIconColor} strokeWidth="1.3" />
                <line x1="8" y1="4.6" x2="8" y2="8.6" stroke={fu.dueIconColor} strokeWidth="1.3" />
                <circle cx="8" cy="11" r="0.8" fill={fu.dueIconColor} />
              </svg>
            </div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{fu.assignedBy}</div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{fu.assignTo}</div>
            <div style={{ fontSize: 13, color: "#9AA1AC" }}>{fu.source}</div>
            <div style={{ display: "flex", gap: 8 }}>
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
        {noFollowUps && (
          <div style={{ padding: "44px 0", textAlign: "center", fontSize: 13, color: "#9AA1AC" }}>No follow-ups to display</div>
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
    </div>
  );
}
