"use client";

import { useEffect, useMemo, useState } from "react";
import { statusStyles } from "@/lib/mock/styles";
import { APPLICATION_STATUSES } from "@/lib/candidates.shared";
import type { CallRow } from "@/lib/calls.shared";
import type { CandidateDetail } from "@/lib/candidates.shared";
import { CheckboxListPopover, MoreFiltersPanel, IconButton, FunnelIcon, selectStyle } from "@/components/ListFilters";
import type { FollowUpRow } from "@/lib/followups.shared";
import type { InterviewRow } from "@/lib/interviews.shared";
import { interviewStatusStyles } from "@/lib/interviews.shared";
import CandidateDetailClient from "@/app/(app)/candidates/[id]/CandidateDetailClient";

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

const selectInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  border: "1px solid #D9DCE3",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  background: "#fff",
};

const modalBtnSecondary: React.CSSProperties = {
  flex: 1,
  background: "#FFFFFF",
  border: "1px solid #D9DCE3",
  color: "#4B5565",
  borderRadius: 6,
  padding: "10px 0",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const modalBtnPrimary: React.CSSProperties = {
  flex: 1,
  background: "#1A56DB",
  border: "none",
  color: "#FFFFFF",
  borderRadius: 6,
  padding: "10px 0",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

function istCalendarParts(iso: string): { year: number; month: number; day: number; time: string } {
  const d = new Date(iso);
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth(), day: ist.getUTCDate(), time: "" };
}

function timePart(displayDateTime: string): string {
  return displayDateTime.split(",")[0]?.trim() ?? "";
}

function dateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CalendarClient({
  initialYear,
  initialMonth,
  initialEvents,
  initialInterviewEvents,
}: {
  initialYear: number;
  initialMonth: number;
  initialEvents: FollowUpRow[];
  initialInterviewEvents: InterviewRow[];
}) {
  const today = useMemo(() => istCalendarParts(new Date().toISOString()), []);
  const [view, setView] = useState({ year: initialYear, month: initialMonth - 1 });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [events, setEvents] = useState<FollowUpRow[]>(initialEvents);
  const [interviewEvents, setInterviewEvents] = useState<InterviewRow[]>(initialInterviewEvents);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [openStatusPopover, setOpenStatusPopover] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpRow | null>(null);
  const [editingInterview, setEditingInterview] = useState<InterviewRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [fuStatus, setFuStatus] = useState("");
  const [fuDueAt, setFuDueAt] = useState("");
  const [fuAssignTo, setFuAssignTo] = useState("");
  const [fuNote, setFuNote] = useState("");

  const [ivScheduledAt, setIvScheduledAt] = useState("");
  const [ivInterviewerId, setIvInterviewerId] = useState("");
  const [ivStatus, setIvStatus] = useState("");
  const [ivDuration, setIvDuration] = useState("");
  const [ivLocation, setIvLocation] = useState("");
  const [ivNote, setIvNote] = useState("");

  const firstRender = useMemo(() => ({ current: true }), []);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    Promise.all([
      fetch(`/api/follow-ups/calendar?year=${view.year}&month=${view.month + 1}`, { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error("Could not load the calendar.");
        return res.json();
      }),
      fetch(`/api/interviews/calendar?year=${view.year}&month=${view.month + 1}`, { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error("Could not load the calendar.");
        return res.json();
      }),
    ])
      .then(([followUpBody, interviewBody]) => {
        setEvents(followUpBody.data ?? []);
        setInterviewEvents(interviewBody.data ?? []);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setLoadError(err instanceof Error ? err.message : "Could not load the calendar.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.year, view.month]);

  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    fetch("/api/team")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body) => {
        if (cancelled) return;
        const rows = (body.data ?? []) as { id: string; name: string }[];
        setUsers(rows);
      })
      .catch(() => { if (!cancelled) setUsers([]); })
      .finally(() => { if (!cancelled) setUsersLoading(false); });
    return () => { cancelled = true; };
  }, []);

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

  const interviewsByDay = useMemo(() => {
    const map = new Map<number, InterviewRow[]>();
    for (const iv of interviewEvents) {
      const parts = istCalendarParts(iv.scheduledAtRaw);
      if (parts.year !== view.year || parts.month !== view.month) continue;
      const list = map.get(parts.day) ?? [];
      list.push(iv);
      map.set(parts.day, list);
    }
    return map;
  }, [interviewEvents, view.year, view.month]);

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

  function openFollowUpModal(ev: FollowUpRow) {
    setSubmitError(null);
    setFuStatus(ev.followUpStatus);
    setFuDueAt(dateTimeLocalValue(ev.dueAtRaw));
    setFuAssignTo(ev.assignToId ?? "");
    setFuNote(ev.note ?? "");
    setEditingFollowUp(ev);
  }

  function openInterviewModal(iv: InterviewRow) {
    setSubmitError(null);
    setIvScheduledAt(dateTimeLocalValue(iv.scheduledAtRaw));
    setIvInterviewerId(iv.interviewerId ?? "");
    setIvStatus(iv.status);
    setIvDuration(String(iv.durationMinutes));
    setIvLocation(iv.location ?? "");
    setIvNote(iv.note ?? "");
    setEditingInterview(iv);
  }

  async function submitFollowUp() {
    if (!editingFollowUp || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = {};
      if (fuStatus !== editingFollowUp.followUpStatus) body.status = fuStatus;
      if (fuDueAt) body.dueAt = new Date(fuDueAt).toISOString();
      if (fuAssignTo !== (editingFollowUp.assignToId ?? "")) body.assignTo = fuAssignTo || null;
      if (fuNote !== (editingFollowUp.note ?? "")) body.note = fuNote;

      const res = await fetch(`/api/follow-ups/${editingFollowUp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? "Failed to save.");
      }
      const json = await res.json();
      const updated = json.data as FollowUpRow;
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditingFollowUp(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelFollowUp() {
    if (!editingFollowUp || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/follow-ups/${editingFollowUp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? "Failed to cancel.");
      }
      const json = await res.json();
      const updated = json.data as FollowUpRow;
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditingFollowUp(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to cancel.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInterview() {
    if (!editingInterview || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = {};
      if (ivScheduledAt !== dateTimeLocalValue(editingInterview.scheduledAtRaw)) body.scheduledAt = new Date(ivScheduledAt).toISOString();
      if (ivInterviewerId !== (editingInterview.interviewerId ?? "")) body.interviewerId = ivInterviewerId || null;
      if (ivStatus !== editingInterview.status) body.status = ivStatus;
      if (Number(ivDuration) !== editingInterview.durationMinutes) body.durationMinutes = Number(ivDuration);
      if (ivLocation !== (editingInterview.location ?? "")) body.location = ivLocation;
      if (ivNote !== (editingInterview.note ?? "")) body.note = ivNote;

      const res = await fetch(`/api/interviews/${editingInterview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? "Failed to save.");
      }
      const json = await res.json();
      const updated = json.data as InterviewRow;
      setInterviewEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditingInterview(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelInterview() {
    if (!editingInterview || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/interviews/${editingInterview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } }).error?.message ?? "Failed to cancel.");
      }
      const json = await res.json();
      const updated = json.data as InterviewRow;
      setInterviewEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditingInterview(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to cancel.");
    } finally {
      setSubmitting(false);
    }
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
    const interviewList = inMonth ? interviewsByDay.get(day) ?? [] : [];
    const isToday = inMonth && isCurrentMonth && day === today.day;
    const isSelected = inMonth && selectedDay === day;
    const highlighted = isSelected || (isToday && selectedDay === null);
    cells.push({
      day,
      inMonth,
      hasEvents: list.length + interviewList.length > 0,
      count: list.length + interviewList.length,
      cellStyle: highlighted ? { background: "#1A56DB" } : {},
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
  const todayInterviews = isCurrentMonth ? interviewsByDay.get(today.day) ?? [] : [];
  const panelInterviews = selectedDay !== null ? interviewsByDay.get(selectedDay) ?? [] : todayInterviews;
  const panelTotal = panelEvents.length + panelInterviews.length;
  const panelTitle =
    selectedDay !== null
      ? `${selectedDay} ${MONTH_NAMES[view.month]}  ${panelTotal} Event${panelTotal === 1 ? "" : "s"}`
      : "Quick Look - Upcoming Schedule";
  const noEvents = panelTotal === 0;
  const showTodayLabel = selectedDay === null;

  const activeFilterCount = selectedStatuses.size > 0 ? 1 : 0;

  const [detailCandidateId, setDetailCandidateId] = useState<string | null>(null);
  const [detailCandidate, setDetailCandidate] = useState<CandidateDetail | null>(null);
  const [detailCalls, setDetailCalls] = useState<CallRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canAssign, setCanAssign] = useState(false);

  async function openCandidateDetail(id: string) {
    setDetailCandidateId(id);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [profileRes, candRes, callsRes] = await Promise.all([
        fetch("/api/users/me").then((r) => (r.ok ? r.json() : Promise.reject(r))),
        fetch(`/api/candidates/${id}`).then((r) => (r.ok ? r.json() : Promise.reject(r))),
        fetch(`/api/candidates/${id}/calls?pageSize=50`).then((r) => (r.ok ? r.json() : Promise.reject(r))),
      ]);
      const candidate = candRes.data as CandidateDetail;
      if (!candidate) throw new Error("Candidate not found.");
      setDetailCandidate(candidate);
      setDetailCalls(callsRes.data ?? []);
      const perms = (profileRes.data?.permissions ?? []) as string[];
      setCanEdit(perms.includes("manage_candidates"));
      setCanAssign(perms.includes("manage_assignment"));
    } catch {
      setDetailError("Could not load candidate details.");
    } finally {
      setDetailLoading(false);
    }
  }

  const CandidateLink: React.FC<{ id: string; name: string }> = ({ id, name }) => (
    <span
      onClick={() => openCandidateDetail(id)}
      style={{ fontWeight: 600, color: "#1D4FD8", cursor: "pointer", textDecoration: "none", fontSize: 14 }}
      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
    >
      {name}
    </span>
  );

  const iconBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid #E7E9EE",
    background: "#FFFFFF",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  };

  const iconBtnDangerStyle: React.CSSProperties = {
    ...iconBtnStyle,
    borderColor: "#FECACA",
    background: "#FEF2F2",
  };

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
        <div style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,40,0.04)", padding: 22 }}>
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
            {showTodayLabel && <div style={{ fontSize: 14, fontWeight: 600, color: "#1D2433" }}>Today ({panelTotal})</div>}
            {panelEvents.map((ev) => {
              const style = ev.applicationStatus ? statusStyles[ev.applicationStatus] : null;
              const done = ev.followUpStatus === "completed";
              return (
                <div
                  key={ev.id}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E7E9EE",
                    borderLeft: "3px solid #1A56DB",
                    borderRadius: 8,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                      <CandidateLink id={ev.candidateId} name={ev.candidateName} />
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <svg width="14" height="14" viewBox="0 0 16 16">
                          <circle cx="8" cy="8" r="6.4" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                          <path d="M8 4.6V8l2.6 1.6" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                        </svg>
                        <span style={{ fontSize: 13, color: "#4B5565" }}>{timePart(ev.dueAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <button type="button" onClick={() => openFollowUpModal(ev)} title="Edit follow-up" style={iconBtnStyle}>
                      <svg width="14" height="14" viewBox="0 0 16 16"><path d="M11.5 1.5l3 3L5 14l-3-3z" fill="none" stroke="#4B5565" strokeWidth="1.3" strokeLinejoin="round"/><path d="M10.3 4.3l1.2-1.2" fill="none" stroke="#4B5565" strokeWidth="1.3"/></svg>
                    </button>
                    <button type="button" onClick={() => openFollowUpModal(ev)} title="Cancel follow-up" style={iconBtnDangerStyle}>
                      <svg width="14" height="14" viewBox="0 0 16 16"><line x1="4" y1="4" x2="12" y2="12" stroke="#B42318" strokeWidth="1.6" strokeLinecap="round"/><line x1="12" y1="4" x2="4" y2="12" stroke="#B42318" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #B8CFFA", background: "#E8F0FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <path d="M3 2.5c1.2 0 1.6 2 2 2.6.4.7-.8 1.3-.5 2 .5 1.2 1.7 2.4 2.9 2.9.7.3 1.3-.9 2-.5.6.4 2.6.8 2.6 2 0 1.3-1.2 2-2.4 2C6.9 13.5 2.5 9.1 2.5 4.9c0-1.2.7-2.4 2-2.4z" fill="none" stroke="#1A56DB" strokeWidth="1.4" />
                    </svg>
                  </div>
                </div>
              );
            })}
            {panelInterviews.map((iv) => {
              const badge = interviewStatusStyles[iv.status];
              return (
                <div
                  key={iv.id}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E7E9EE",
                    borderLeft: "3px solid #7C3AED",
                    borderRadius: 8,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                      <CandidateLink id={iv.candidateId} name={iv.candidateName} />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: badge.bg,
                          color: badge.color,
                          flexShrink: 0,
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#4B5565", marginBottom: 6 }}>
                      Interview — {iv.clientName} · {iv.jobTitle ?? "--"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <svg width="14" height="14" viewBox="0 0 16 16">
                          <circle cx="8" cy="8" r="6.4" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                          <path d="M8 4.6V8l2.6 1.6" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                        </svg>
                        <span style={{ fontSize: 12.5, color: "#6B7280" }}>Time</span>
                        <span style={{ fontSize: 13, color: "#1D2433", fontWeight: 500 }}>{timePart(iv.scheduledAt)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <svg width="14" height="14" viewBox="0 0 16 16">
                          <circle cx="8" cy="5.5" r="2.6" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                          <path d="M2.8 14c0-2.6 2.3-4.4 5.2-4.4s5.2 1.8 5.2 4.4" fill="none" stroke="#6B7280" strokeWidth="1.3" />
                        </svg>
                        <span style={{ fontSize: 12.5, color: "#6B7280" }}>Interviewer</span>
                        <span style={{ fontSize: 13, color: "#1D2433", fontWeight: 500 }}>{iv.interviewerName ?? "Unassigned"}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <button type="button" onClick={() => openInterviewModal(iv)} title="Edit interview" style={iconBtnStyle}>
                      <svg width="14" height="14" viewBox="0 0 16 16"><path d="M11.5 1.5l3 3L5 14l-3-3z" fill="none" stroke="#4B5565" strokeWidth="1.3" strokeLinejoin="round"/><path d="M10.3 4.3l1.2-1.2" fill="none" stroke="#4B5565" strokeWidth="1.3"/></svg>
                    </button>
                    <button type="button" onClick={() => openInterviewModal(iv)} title="Cancel interview" style={iconBtnDangerStyle}>
                      <svg width="14" height="14" viewBox="0 0 16 16"><line x1="4" y1="4" x2="12" y2="12" stroke="#B42318" strokeWidth="1.6" strokeLinecap="round"/><line x1="12" y1="4" x2="4" y2="12" stroke="#B42318" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}
            {noEvents && <div style={{ fontSize: 13, color: "#9AA1AC", padding: "20px 0" }}>No follow-ups or interviews scheduled for this date.</div>}
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

      {editingFollowUp && (
        <div
          onClick={() => !submitting && setEditingFollowUp(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(29,36,51,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: "92vw", background: "#FFFFFF", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#1D2433" }}>Edit Follow-Up</div>
              <div onClick={() => setEditingFollowUp(null)} style={{ cursor: "pointer", fontSize: 20, color: "#9AA1AC", lineHeight: 1 }}>×</div>
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 18 }}>{editingFollowUp.candidateName}</div>

            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>Status</div>
            <select
              value={fuStatus}
              onChange={(e) => setFuStatus(e.target.value)}
              style={selectInputStyle}
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6, marginTop: 14 }}>Due Date &amp; Time</div>
            <input
              type="datetime-local"
              value={fuDueAt}
              onChange={(e) => setFuDueAt(e.target.value)}
              style={selectInputStyle}
            />

            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6, marginTop: 14 }}>Assign To</div>
            <select
              value={fuAssignTo}
              onChange={(e) => setFuAssignTo(e.target.value)}
              style={selectInputStyle}
            >
              <option value="">-- Select --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {usersLoading && <div style={{ fontSize: 11.5, color: "#9AA1AC", marginTop: 4 }}>Loading users…</div>}

            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6, marginTop: 14 }}>Note (optional)</div>
            <textarea
              value={fuNote}
              onChange={(e) => setFuNote(e.target.value)}
              placeholder="Add a note…"
              rows={3}
              style={{ ...selectInputStyle, resize: "vertical" }}
            />

            {submitError && <div style={{ fontSize: 12.5, color: "#B42318", marginTop: 12 }}>{submitError}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={cancelFollowUp} disabled={submitting} style={{ ...modalBtnSecondary, color: "#B42318", borderColor: "#FECACA" }}>
                Cancel Follow-Up
              </button>
              <button onClick={submitFollowUp} disabled={submitting} style={{ ...modalBtnPrimary, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingInterview && (
        <div
          onClick={() => !submitting && setEditingInterview(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(29,36,51,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "92vw", background: "#FFFFFF", borderRadius: 12, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#1D2433" }}>Edit Interview</div>
              <div onClick={() => setEditingInterview(null)} style={{ cursor: "pointer", fontSize: 20, color: "#9AA1AC", lineHeight: 1 }}>×</div>
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 18 }}>{editingInterview.candidateName}</div>

            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>Scheduled Date &amp; Time</div>
            <input
              type="datetime-local"
              value={ivScheduledAt}
              onChange={(e) => setIvScheduledAt(e.target.value)}
              style={selectInputStyle}
            />

            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6, marginTop: 14 }}>Interviewer</div>
            <select
              value={ivInterviewerId}
              onChange={(e) => setIvInterviewerId(e.target.value)}
              style={selectInputStyle}
            >
              <option value="">-- Select --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {usersLoading && <div style={{ fontSize: 11.5, color: "#9AA1AC", marginTop: 4 }}>Loading users…</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>Status</div>
                <select value={ivStatus} onChange={(e) => setIvStatus(e.target.value)} style={selectInputStyle}>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No-Show</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>Duration (min)</div>
                <input type="number" value={ivDuration} onChange={(e) => setIvDuration(e.target.value)} min={15} step={15} style={selectInputStyle} />
              </div>
            </div>

            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6, marginTop: 14 }}>Location</div>
            <input
              type="text"
              value={ivLocation}
              onChange={(e) => setIvLocation(e.target.value)}
              placeholder="e.g. Zoom / Office"
              style={selectInputStyle}
            />

            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6, marginTop: 14 }}>Note (optional)</div>
            <textarea
              value={ivNote}
              onChange={(e) => setIvNote(e.target.value)}
              placeholder="Add a note…"
              rows={3}
              style={{ ...selectInputStyle, resize: "vertical" }}
            />

            {submitError && <div style={{ fontSize: 12.5, color: "#B42318", marginTop: 12 }}>{submitError}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={cancelInterview} disabled={submitting} style={{ ...modalBtnSecondary, color: "#B42318", borderColor: "#FECACA" }}>
                Cancel Interview
              </button>
              <button onClick={submitInterview} disabled={submitting} style={{ ...modalBtnPrimary, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailCandidateId && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 640, maxWidth: "92vw", background: "#FFFFFF", zIndex: 70, boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #E7E9EE" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1D2433" }}>Candidate Details</div>
            <div
              onClick={() => { setDetailCandidateId(null); setDetailCandidate(null); }}
              style={{ cursor: "pointer", fontSize: 22, color: "#9AA1AC", lineHeight: 1 }}
            >
              ×
            </div>
          </div>
          {detailLoading && <div style={{ padding: 20, color: "#9AA1AC", fontSize: 13 }}>Loading…</div>}
          {detailError && <div style={{ padding: 20, color: "#B42318", fontSize: 13 }}>{detailError}</div>}
          {detailCandidate && !detailLoading && (
            <div style={{ padding: 20 }}>
              <CandidateDetailClient
                candidate={detailCandidate}
                canEdit={canEdit}
                canAssign={canAssign}
                calls={detailCalls}
                onClose={() => { setDetailCandidateId(null); setDetailCandidate(null); }}
                onStatusChanged={() => {}}
                onRecruiterChanged={() => {}}
              />
            </div>
          )}
        </div>
      )}
      {detailCandidateId && (
        <div onClick={() => { setDetailCandidateId(null); setDetailCandidate(null); }} style={{ position: "fixed", inset: 0, background: "rgba(29,36,51,0.25)", zIndex: 69 }} />
      )}
    </div>
  );
}
