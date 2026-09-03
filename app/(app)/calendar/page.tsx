"use client";

import { useMemo, useState } from "react";
import { candidatesSeed, usersSeed, followUpsSeed, statusStyles } from "@/lib/mock";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// "Today" per claude.md — 2026-09-02.
const TODAY_YEAR = 2026;
const TODAY_MONTH = 8; // 0-indexed: September
const TODAY_DAY = 2;

function userName(id: string): string {
  return usersSeed.find((u) => u.id === id)?.name ?? "--";
}

type CalEvent = {
  name: string;
  status: string;
  statusLabel: string;
  assignedBy: string;
  assignTo: string;
  time: string;
  done: boolean;
};

function parseDueAt(iso: string): { year: number; month: number; day: number; time: string } {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return { year: 0, month: 0, day: 0, time: "" };
  const [, y, mo, d, h, mi] = m;
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = (hour % 12 || 12).toString().padStart(2, "0");
  return { year: parseInt(y, 10), month: parseInt(mo, 10) - 1, day: parseInt(d, 10), time: `${h12}:${mi} ${ampm}` };
}

export default function CalendarPage() {
  const [calMonth, setCalMonth] = useState(TODAY_MONTH);
  const [calYear, setCalYear] = useState(TODAY_YEAR);
  const [calSelectedDay, setCalSelectedDay] = useState<number | null>(null);
  const [calendarStatusFilter, setCalendarStatusFilter] = useState("All");

  const statuses = Object.keys(statusStyles);

  // Group follow-ups into per (year, month, day) event lists, enriched with candidate/user info.
  const eventsByYearMonthDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    followUpsSeed.forEach((f) => {
      const candidate = candidatesSeed.find((c) => c.id === f.candidateId);
      if (!candidate) return;
      const { year, month, day, time } = parseDueAt(f.dueAt);
      const style = statusStyles[candidate.status] ?? { bg: "#EEF0F5", color: "#5B6472", label: candidate.status };
      const key = `${year}-${month}-${day}`;
      const list = map.get(key) ?? [];
      list.push({
        name: candidate.name,
        status: candidate.status,
        statusLabel: style.label,
        assignedBy: userName(f.assignedById),
        assignTo: userName(f.assignToId),
        time,
        done: false,
      });
      map.set(key, list);
    });
    return map;
  }, []);

  const eventsForDay = (year: number, month: number, day: number): CalEvent[] =>
    eventsByYearMonthDay.get(`${year}-${month}-${day}`) ?? [];

  const calPrevMonth = () => {
    setCalMonth((m) => (m === 0 ? 11 : m - 1));
    setCalYear((y) => (calMonth === 0 ? y - 1 : y));
    setCalSelectedDay(null);
  };
  const calNextMonth = () => {
    setCalMonth((m) => (m === 11 ? 0 : m + 1));
    setCalYear((y) => (calMonth === 11 ? y + 1 : y));
    setCalSelectedDay(null);
  };

  const firstOfMonth = new Date(calYear, calMonth, 1);
  const leading = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(calYear, calMonth, 1 - leading);

  const isCurrentMonth = calMonth === TODAY_MONTH && calYear === TODAY_YEAR;

  const calCells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const inMonth = d.getMonth() === calMonth && d.getFullYear() === calYear;
    const day = d.getDate();
    const list = inMonth ? eventsForDay(calYear, calMonth, day) : [];
    const isToday = inMonth && isCurrentMonth && day === TODAY_DAY;
    const isSelected = inMonth && calSelectedDay === day;
    const highlighted = isSelected || isToday;
    calCells.push({
      day,
      inMonth,
      hasEvents: list.length > 0,
      count: list.length,
      cellStyle: highlighted ? { background: "#FF5C35" } : {},
      numColor: highlighted ? "#FFFFFF" : inMonth ? "#1D2433" : "#9AA1AC",
      dotColor: highlighted ? "#FFFFFF" : "#2563EB",
      countColor: highlighted ? "#FFFFFF" : "#2563EB",
      pillStyle: highlighted ? { background: "rgba(255,255,255,0.22)" } : { background: "#F1F3F7" },
      onClick: inMonth && list.length > 0 ? () => setCalSelectedDay(day) : () => setCalSelectedDay(null),
    });
  }

  const todayEvents = isCurrentMonth ? eventsForDay(TODAY_YEAR, TODAY_MONTH, TODAY_DAY) : [];
  const calSelectedList = calSelectedDay ? eventsForDay(calYear, calMonth, calSelectedDay) : todayEvents;
  const calPanelEvents = calSelectedList
    .filter((ev) => calendarStatusFilter === "All" || ev.status === calendarStatusFilter)
    .map((ev) => ({ ...ev, pending: !ev.done }));
  const calPanelTitle = calSelectedDay
    ? `${calSelectedDay} ${MONTH_NAMES[calMonth]}  ${calPanelEvents.length} Event${calPanelEvents.length === 1 ? "" : "s"}`
    : "Quick Look - Upcoming Schedule";
  const calNoEvents = calPanelEvents.length === 0;
  const calDateSelected = !!calSelectedDay;
  const calShowTodayLabel = !calSelectedDay;
  const calTodayLabel = `Today (${calPanelEvents.length})`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#1D2433" }}>Follow-up Calendar</div>
        <select
          value={calendarStatusFilter}
          onChange={(e) => setCalendarStatusFilter(e.target.value)}
          style={{ padding: "9px 14px", border: "1px solid #D9DCE3", borderRadius: 7, fontSize: 13, color: "#4B5565", background: "#FFFFFF", minWidth: 200 }}
        >
          <option value="All">Select Status</option>
          {statuses.map((opt) => (
            <option key={opt} value={opt}>
              {statusStyles[opt].label}
            </option>
          ))}
        </select>
        <div style={{ position: "relative", width: 38, height: 38, borderRadius: 7, border: "1px solid #E7E9EE", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="5.5" cy="5.5" r="2.4" fill="none" stroke="#4B5565" strokeWidth="1.2" />
            <circle cx="11" cy="6.5" r="1.8" fill="none" stroke="#4B5565" strokeWidth="1.2" />
            <path d="M1.5 13c0-2 2-3.4 4-3.4S9.5 11 9.5 13" fill="none" stroke="#4B5565" strokeWidth="1.2" />
          </svg>
          <div style={{ position: "absolute", top: -7, right: -7, background: "#FF5C35", color: "#FFFFFF", fontSize: 9.5, fontWeight: 700, borderRadius: 8, padding: "1px 5px" }}>
            11
          </div>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 7, border: "1px solid #E7E9EE", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 14 14">
            <path d="M1 2h12M3.5 7h7M6 12h2" stroke="#4B5565" strokeWidth="1.3" fill="none" />
          </svg>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 26, color: "#1D2433" }}>
              <span style={{ fontWeight: 700 }}>{MONTH_NAMES[calMonth]}</span> <span style={{ fontWeight: 400, color: "#4B5565" }}>{calYear}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <svg onClick={calPrevMonth} width="18" height="18" viewBox="0 0 18 18" style={{ cursor: "pointer" }}>
                <path d="M11 3L5 9l6 6" fill="none" stroke="#4B5565" strokeWidth="1.6" />
              </svg>
              <svg onClick={calNextMonth} width="18" height="18" viewBox="0 0 18 18" style={{ cursor: "pointer" }}>
                <path d="M7 3l6 6-6 6" fill="none" stroke="#4B5565" strokeWidth="1.6" />
              </svg>
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
            {calCells.map((cell, i) => (
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
                  cursor: "pointer",
                  borderRadius: 8,
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
        </div>

        <div style={{ position: "relative", paddingLeft: 18 }}>
          <div style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 1, background: "#D9DCE3" }} />
          <div style={{ position: "absolute", left: -4, top: 8, width: 9, height: 9, borderRadius: "50%", background: "#9AA1AC" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433" }}>{calPanelTitle}</div>
            {calDateSelected && (
              <svg onClick={() => setCalSelectedDay(null)} width="16" height="16" viewBox="0 0 16 16" style={{ cursor: "pointer" }}>
                <path d="M3 3l10 10M13 3L3 13" stroke="#6B7280" strokeWidth="1.5" />
              </svg>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {calShowTodayLabel && <div style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>{calTodayLabel}</div>}
            {calPanelEvents.map((ev, i) => (
              <div
                key={i}
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
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>{ev.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB" }} />
                      <span style={{ fontSize: 13, color: "#1D2433" }}>{ev.statusLabel}</span>
                      {ev.done && (
                        <svg width="16" height="16" viewBox="0 0 16 16">
                          <circle cx="8" cy="8" r="7" fill="#16A34A" />
                          <path d="M4.6 8.2l2.2 2.2 4.4-4.4" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
                        </svg>
                      )}
                      {ev.pending && (
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
                      <span style={{ fontSize: 13, color: "#4B5565" }}>{ev.assignedBy}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16">
                        <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                        <circle cx="6" cy="7" r="1.8" fill="none" stroke="#6B7280" strokeWidth="1.2" />
                      </svg>
                      <span style={{ fontSize: 13, color: "#4B5565" }}>{ev.assignTo}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16">
                        <circle cx="8" cy="8" r="6.4" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                        <path d="M8 4.6V8l2.6 1.6" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                      </svg>
                      <span style={{ fontSize: 13, color: "#4B5565" }}>{ev.time}</span>
                    </div>
                  </div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #FFD9CC", background: "#FFF5F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
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
            ))}
            {calNoEvents && <div style={{ fontSize: 13, color: "#9AA1AC", padding: "20px 0" }}>No follow-ups scheduled for this date.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
