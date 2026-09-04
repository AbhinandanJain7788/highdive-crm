"use client";

import { useEffect, useMemo, useState } from "react";
import { statusStyles } from "@/lib/mock/styles";
import { APPLICATION_STATUSES } from "@/lib/candidates.shared";
import { CheckboxListPopover, MoreFiltersPanel, IconButton, FunnelIcon, selectStyle } from "@/components/ListFilters";
import type { FollowUpRow } from "@/lib/followups.shared";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const statusOptions = APPLICATION_STATUSES.map((s) => ({ id: s, label: statusStyles[s]?.label ?? s }));

const monthNavBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #E7E9EE",
  background: "#FFFFFF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
};

// year/month/day are the IST calendar date the row's due_at falls on (0-indexed
// month, to line up with JS Date's own grid math); time is the "11:00 AM" prefix
// already produced by formatDisplayDateTime.
function istCalendarParts(iso: string): { year: number; month: number; day: number; time: string } {
  const d = new Date(iso);
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth(), day: ist.getUTCDate(), time: "" };
}

function timePart(displayDateTime: string): string {
  return displayDateTime.split(",")[0]?.trim() ?? "";
}

export default function CalendarClient({
  initialYear,
  initialMonth,
  initialEvents,
}: {
  initialYear: number;
  initialMonth: number; // 1-12
  initialEvents: FollowUpRow[];
}) {
  const today = useMemo(() => istCalendarParts(new Date().toISOString()), []);
  const [view, setView] = useState({ year: initialYear, month: initialMonth - 1 }); // month kept 0-indexed locally
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [events, setEvents] = useState<FollowUpRow[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [openStatusPopover, setOpenStatusPopover] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const firstRender = useMemo(() => ({ current: true }), []);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    fetch(`/api/follow-ups/calendar?year=${view.year}&month=${view.month + 1}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load the calendar.");
        return res.json();
      })
      .then((body) => setEvents(body.data ?? []))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setLoadError(err instanceof Error ? err.message : "Could not load the calendar.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.year, view.month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, FollowUpRow[]>();
    for (const ev of events) {
      const parts = istCalendarParts(ev.dueAtRaw);
      if (parts.year !== view.year || parts.month !== view.month) continue;
      const list = map.get(parts.day) ?? [];
      list.push(ev);
      map.set(parts.day, list);
    }
    return map;
  }, [events, view.year, view.month]);

  function toggleStatus(id: string) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stepMonth(delta: number) {
    setView((v) => {
      const next = v.month + delta;
      if (next < 0) return { year: v.year - 1, month: 11 };
      if (next > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: next };
    });
    setSelectedDay(null);
  }

  const firstOfMonth = new Date(view.year, view.month, 1);
  const leading = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(view.year, view.month, 1 - leading);
  const isCurrentMonth = view.month === today.month && view.year === today.year;

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const inMonth = d.getMonth() === view.month && d.getFullYear() === view.year;
    const day = d.getDate();
    const list = inMonth ? eventsByDay.get(day) ?? [] : [];
    const isToday = inMonth && isCurrentMonth && day === today.day;
    const isSelected = inMonth && selectedDay === day;
    const highlighted = isSelected || (isToday && selectedDay === null);
    cells.push({
      day,
      inMonth,
      hasEvents: list.length > 0,
      count: list.length,
      cellStyle: highlighted ? { background: "#FF5C35" } : {},
      numColor: highlighted ? "#FFFFFF" : inMonth ? "#1D2433" : "#9AA1AC",
      dotColor: highlighted ? "#FFFFFF" : "#2563EB",
      countColor: highlighted ? "#FFFFFF" : "#2563EB",
      pillStyle: highlighted ? { background: "rgba(255,255,255,0.22)" } : { background: "#F1F3F7" },
      onClick: inMonth ? () => setSelectedDay(day) : undefined,
    });
  }

  const todayEvents = isCurrentMonth ? eventsByDay.get(today.day) ?? [] : [];
  const baseList = selectedDay !== null ? eventsByDay.get(selectedDay) ?? [] : todayEvents;
  const panelEvents = baseList.filter(
    (ev) => selectedStatuses.size === 0 || (ev.applicationStatus && selectedStatuses.has(ev.applicationStatus))
  );
  const panelTitle =
    selectedDay !== null
      ? `${selectedDay} ${MONTH_NAMES[view.month]}  ${panelEvents.length} Event${panelEvents.length === 1 ? "" : "s"}`
      : "Quick Look - Upcoming Schedule";
  const noEvents = panelEvents.length === 0;
  const showTodayLabel = selectedDay === null;

  const activeFilterCount = selectedStatuses.size > 0 ? 1 : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#4B5565" }}>Follow-up Calendar</div>
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setOpenStatusPopover((v) => !v)}
            style={{ ...selectStyle, padding: "9px 14px", fontSize: 13, minWidth: 200, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
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
        <IconButton label="Filter" onClick={() => setShowMoreFilters(true)} active={activeFilterCount > 0}>
          <FunnelIcon />
        </IconButton>
        {loading && <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>Loading…</span>}
      </div>

      {loadError && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {loadError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 26, color: "#1D2433" }}>
              <span style={{ fontWeight: 700 }}>{MONTH_NAMES[view.month]}</span> <span style={{ fontWeight: 400, color: "#4B5565" }}>{view.year}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" onClick={() => stepMonth(-1)} aria-label="Previous month" style={monthNavBtnStyle}>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path d="M11 3L5 9l6 6" fill="none" stroke="#4B5565" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" onClick={() => stepMonth(1)} aria-label="Next month" style={monthNavBtnStyle}>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path d="M7 3l6 6-6 6" fill="none" stroke="#4B5565" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "#6B7280", margin: "6px 0 18px" }}>Click on date to see follow-ups</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#F4F5F8", borderRadius: 6, marginBottom: 6 }}>
            {WEEKDAYS.map((wd) => (
              <div key={wd} style={{ textAlign: "center", padding: "9px 0", fontSize: 12.5, fontWeight: 600, color: "#4B5565" }}>
                {wd}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {cells.map((cell, i) => (
              <div
                key={i}
                onClick={cell.onClick}
                style={{
                  height: 74,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  cursor: cell.onClick ? "pointer" : "default",
                  borderRadius: 8,
                  transition: "background 140ms ease, color 140ms ease",
                  ...cell.cellStyle,
                }}
              >
                {cell.hasEvents && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "1px 7px", borderRadius: 10, ...cell.pillStyle }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: cell.dotColor }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: cell.countColor }}>{cell.count}</span>
                  </div>
                )}
                <div style={{ fontSize: 15, fontWeight: 600, color: cell.numColor }}>{cell.day}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: "#9AA1AC", fontStyle: "italic", marginTop: 14 }}>
            Long press on a date to enable multi-select
          </div>
        </div>

        <div style={{ position: "relative", paddingLeft: 18 }}>
          <div style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 1, background: "#D9DCE3" }} />
          <div style={{ position: "absolute", left: -4, top: 8, width: 9, height: 9, borderRadius: "50%", background: "#9AA1AC" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433" }}>{panelTitle}</div>
            {selectedDay !== null && (
              <svg onClick={() => setSelectedDay(null)} width="16" height="16" viewBox="0 0 16 16" style={{ cursor: "pointer" }}>
                <path d="M3 3l10 10M13 3L3 13" stroke="#6B7280" strokeWidth="1.5" />
              </svg>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {showTodayLabel && <div style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>Today ({panelEvents.length})</div>}
            {panelEvents.map((ev) => {
              const style = ev.applicationStatus ? statusStyles[ev.applicationStatus] : null;
              const done = ev.followUpStatus === "completed";
              return (
                <div
                  key={ev.id}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E7E9EE",
                    borderLeft: "3px solid #FF5C35",
                    borderRadius: 8,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>{ev.candidateName}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB" }} />
                        <span style={{ fontSize: 13, color: "#1D2433" }}>{style?.label ?? ev.applicationStatus ?? "--"}</span>
                        {done && (
                          <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle cx="8" cy="8" r="7" fill="#16A34A" />
                            <path d="M4.6 8.2l2.2 2.2 4.4-4.4" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
                          </svg>
                        )}
                        {!done && (
                          <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle cx="8" cy="9" r="5.6" fill="none" stroke="#E0563B" strokeWidth="1.4" />
                            <line x1="8" y1="6" x2="8" y2="9" stroke="#E0563B" strokeWidth="1.4" />
                            <line x1="6.4" y1="2" x2="9.6" y2="2" stroke="#E0563B" strokeWidth="1.4" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="14" height="14" viewBox="0 0 16 16">
                          <circle cx="8" cy="5.5" r="2.6" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                          <path d="M2.8 14c0-2.6 2.3-4.4 5.2-4.4s5.2 1.8 5.2 4.4" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                        </svg>
                        <span style={{ fontSize: 13, color: "#4B5565" }}>{ev.assignedByName ?? "--"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="14" height="14" viewBox="0 0 16 16">
                          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                          <circle cx="6" cy="7" r="1.8" fill="none" stroke="#6B7280" strokeWidth="1.2" />
                        </svg>
                        <span style={{ fontSize: 13, color: "#4B5565" }}>{ev.assignToName ?? "--"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <svg width="14" height="14" viewBox="0 0 16 16">
                          <circle cx="8" cy="8" r="6.4" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                          <path d="M8 4.6V8l2.6 1.6" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                        </svg>
                        <span style={{ fontSize: 13, color: "#4B5565" }}>{timePart(ev.dueAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #FFD9CC", background: "#FFF5F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <path
                        d="M3 2.5c1.2 0 1.6 2 2 2.6.4.7-.8 1.3-.5 2 .5 1.2 1.7 2.4 2.9 2.9.7.3 1.3-.9 2-.5.6.4 2.6.8 2.6 2 0 1.3-1.2 2-2.4 2C6.9 13.5 2.5 9.1 2.5 4.9c0-1.2.7-2.4 2-2.4z"
                        fill="none"
                        stroke="#FF5C35"
                        strokeWidth="1.4"
                      />
                    </svg>
                  </div>
                </div>
              );
            })}
            {noEvents && <div style={{ fontSize: 13, color: "#9AA1AC", padding: "20px 0" }}>No follow-ups scheduled for this date.</div>}
          </div>
        </div>
      </div>

      {showMoreFilters && (
        <MoreFiltersPanel
          initialStatusMode="status"
          initialStatuses={selectedStatuses}
          initialLocation=""
          initialPriorities={new Set()}
          showPriority={false}
          onCancel={() => setShowMoreFilters(false)}
          onApply={(_mode, statuses) => {
            setSelectedStatuses(statuses);
            setShowMoreFilters(false);
          }}
        />
      )}
    </div>
  );
}
