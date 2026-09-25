"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { avatarLetterFor } from "@/lib/mock";
import { fmtDuration, callDispositionStyles, callDirectionLabels } from "@/lib/mock/styles";
import {
  selectStyle,
  CheckboxListPopover,
  SortPopover,
  DateRangeBar,
  DEFAULT_DATE_RANGE,
  dateRangeBounds,
  IconButton,
  SortAzIcon,
  CallButton,
  type SortKey,
  type DateRange,
  type ApplicationStatus,
  ALL_STATUSES,
} from "@/components/ListFilters";
import { PAGE_SIZES, type CallRow } from "@/lib/calls.shared";
import { statusStyles } from "@/lib/mock/styles";

type CallLogsTab = "all" | "unattributed";
type TypeFilter = "All" | "Outgoing" | "Incoming";
type ConnFilter = "All" | "Connected" | "Not Connected";
type RangeFilter = "Today" | "Last 30 Days" | "Select Range";

const CL_SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name-asc", label: "Name: A-Z" },
  { key: "name-desc", label: "Name: Z-A" },
  { key: "created-new", label: "Called: New to Old" },
  { key: "created-old", label: "Called: Old to New" },
];

const activeTabStyle = { background: "#1D2433", color: "#FFFFFF" } as const;
const inactiveTabStyle = { color: "#4B5565" } as const;

const miniPlayerBtnStyle = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "1px solid #E7E9EE",
  background: "#FFFFFF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  cursor: "pointer",
  padding: 0,
} as const;

type TeamOption = { id: string; label: string };

function directionArrow(direction: CallDirection | null): { color: string; path: string; label: string } {
  if (direction === "inbound") {
    return { color: "#0F7A6C", path: "M12 12L3 3M9 12H3V6", label: callDirectionLabels.inbound };
  }
  return { color: "#1A56DB", path: "M3 12L12 3M6 3h6v6", label: callDirectionLabels.outbound };
}

export default function CallLogsClient({
  initialRows,
  initialTotal,
  initialUnattributedRows,
  initialUnattributedTotal,
}: {
  initialRows: CallRow[];
  initialTotal: number;
  initialUnattributedRows: UnattributedCallRow[];
  initialUnattributedTotal: number;
}) {
  const [callLogsTab, setCallLogsTab] = useState<CallLogsTab>("all");

  // ---- "All" tab state ----
  const [rows, setRows] = useState<CallRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [connFilter, setConnFilter] = useState<ConnFilter>("All");
  const [range, setRange] = useState<RangeFilter>("Last 30 Days");
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("created-new");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [selectedUserKeys, setSelectedUserKeys] = useState<Set<string>>(new Set());
  const [openUsersPopover, setOpenUsersPopover] = useState(false);
  const [openSortPopover, setOpenSortPopover] = useState(false);

  // ---- Playback ----
  // activeCallId is which call's recording is loaded (playing OR paused) —
  // separate from isPlaying so pausing/resuming reuses the same <audio> element
  // instead of re-assigning `src`, which would otherwise restart from 0 every time.
  const [activeCallId, setActiveCallId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrlCache, setAudioUrlCache] = useState<Record<number, string | null>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // ---- "Unattributed" tab state ----
  const [unattributedRows, setUnattributedRows] = useState<UnattributedCallRow[]>(initialUnattributedRows);
  const [unattributedTotal, setUnattributedTotal] = useState(initialUnattributedTotal);
  const [unattributedSearch, setUnattributedSearch] = useState("");
  const [unattributedLoading, setUnattributedLoading] = useState(false);
  const [attributeChoice, setAttributeChoice] = useState<Record<number, string>>({});
  const [attributing, setAttributing] = useState<number | null>(null);
  const [attributeError, setAttributeError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/team")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.data) {
          const opts = body.data.map((u: { id: string; name: string }) => ({ id: u.id, label: u.name }));
          setTeamOptions(opts);
          setSelectedUserKeys(new Set(opts.map((o: TeamOption) => o.id)));
        }
      })
      .catch(() => {});
  }, []);

  const usersNarrowed = teamOptions.length > 0 && selectedUserKeys.size < teamOptions.length;

  function toggleUser(id: string) {
    setSelectedUserKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) return;
    setPage(1);
  }, [search, typeFilter, connFilter, range, appliedDateRange, selectedUserKeys, sortKey, pageSize]);

  useEffect(() => {
    if (callLogsTab !== "all") return;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (typeFilter === "Outgoing") params.set("direction", "outbound");
    else if (typeFilter === "Incoming") params.set("direction", "inbound");
    if (connFilter === "Connected") params.set("connected", "true");
    else if (connFilter === "Not Connected") params.set("connected", "false");
    if (teamOptions.length > 0 && selectedUserKeys.size < teamOptions.length) {
      params.set("byUser", [...selectedUserKeys].join(","));
    }
    params.set("sort", sortKey);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    const now = new Date();
    if (range === "Today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      params.set("dateFrom", start.toISOString());
    } else if (range === "Last 30 Days") {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      params.set("dateFrom", from.toISOString());
    } else if (range === "Select Range" && appliedDateRange) {
      const bounds = dateRangeBounds(appliedDateRange);
      if (bounds) {
        params.set("dateFrom", new Date(bounds.from).toISOString());
        params.set("dateTo", new Date(bounds.to).toISOString());
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/calls?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Could not load call logs.");
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
          setLoadError(err instanceof Error ? err.message : "Could not load call logs.");
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [callLogsTab, search, typeFilter, connFilter, range, appliedDateRange, selectedUserKeys, teamOptions.length, sortKey, page, pageSize]);

  // Unattributed tab fetch
  const unattributedFirstRender = useRef(true);
  useEffect(() => {
    if (callLogsTab !== "unattributed") return;
    if (unattributedFirstRender.current) {
      unattributedFirstRender.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (unattributedSearch.trim()) params.set("search", unattributedSearch.trim());
    params.set("pageSize", "50");

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setUnattributedLoading(true);
      try {
        const res = await fetch(`/api/calls/unattributed?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Could not load unattributed calls.");
        const body = await res.json();
        setUnattributedRows(body.data ?? []);
        setUnattributedTotal(body.total ?? 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setAttributeError(err instanceof Error ? err.message : "Could not load unattributed calls.");
        }
      } finally {
        setUnattributedLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [callLogsTab, unattributedSearch]);

  async function resolveRecordingUrl(call: CallRow): Promise<string | null> {
    let url = audioUrlCache[call.id];
    if (url === undefined) {
      try {
        const res = await fetch(`/api/calls/${call.id}`);
        if (res.ok) {
          const body = await res.json();
          url = body.data?.b2Url ?? null;
        } else {
          url = null;
        }
      } catch {
        url = null;
      }
      setAudioUrlCache((prev) => ({ ...prev, [call.id]: url ?? null }));
    }
    return url ?? null;
  }

  async function startPlayback(call: CallRow) {
    if (!call.hasRecording) return;
    const url = await resolveRecordingUrl(call);
    if (!url || !audioRef.current) return;
    audioRef.current.src = url;
    setCurrentTime(0);
    setDuration(0);
    setActiveCallId(call.id);
    audioRef.current.play().catch(() => {});
    setIsPlaying(true);
  }

  function togglePlayPause() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }

  function stopPlayback() {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setActiveCallId(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }

  function seekBy(deltaSeconds: number) {
    if (!audioRef.current) return;
    const total = duration || audioRef.current.duration || 0;
    audioRef.current.currentTime = Math.min(Math.max(audioRef.current.currentTime + deltaSeconds, 0), total);
    setCurrentTime(audioRef.current.currentTime);
  }

  function seekToClientX(clientX: number) {
    if (!audioRef.current || !progressRef.current) return;
    const total = duration || audioRef.current.duration || 0;
    if (!total) return;
    const rect = progressRef.current.getBoundingClientRect();
    const fraction = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    audioRef.current.currentTime = fraction * total;
    setCurrentTime(fraction * total);
  }

  function fmtClock(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // ---- Status state (application status, shared with the Customers tab) ----
  const [crmStatusChoice, setCrmStatusChoice] = useState<Record<number, ApplicationStatus>>({});
  const [updatingCrmStatusId, setUpdatingCrmStatusId] = useState<number | null>(null);
  const [crmStatusError, setCrmStatusError] = useState<string | null>(null);
  const [crmStatusSuccess, setCrmStatusSuccess] = useState<string | null>(null);
  const [openCrmStatusFor, setOpenCrmStatusFor] = useState<number | null>(null);

  // ---- Action completion modal state ----
  const [actionCallId, setActionCallId] = useState<CallRow | null>(null);
  const [completing, setCompleting] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [actionDate, setActionDate] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [assignToId, setAssignToId] = useState("");
  const [interviewerId, setInterviewerId] = useState("");
  const [interviewLocation, setInterviewLocation] = useState("");

  async function downloadRecording(call: CallRow) {
    if (!call.hasRecording || downloadingId === call.id) return;
    setDownloadingId(call.id);
    try {
      const url = await resolveRecordingUrl(call);
      if (!url) {
        setLoadError("Recording is not available for download.");
        return;
      }
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `call-${call.id}-${call.candidateName.replace(/\s+/g, "_")}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setLoadError("Could not download the recording.");
    } finally {
      setDownloadingId(null);
    }
  }

  function onAttributeChoiceChange(id: number, val: string) {
    setAttributeChoice((prev) => ({ ...prev, [id]: val }));
  }

  function openActionModal(call: CallRow) {
    setActionCallId(call);
    const dt = call.nextActionAt ? new Date(call.nextActionAt) : null;
    const pad = (n: number) => String(n).padStart(2, "0");
    const localStr = dt
      ? `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
      : "";
    setActionDate(localStr);
    setActionNote(call.nextActionNote || "");
    setAssignToId("");
    setInterviewerId("");
    setInterviewLocation("");
    setActionError(null);
    setActionSuccess(null);
  }

  function closeActionModal() {
    setActionCallId(null);
    setCompleting(false);
  }

  async function submitCrmStatus(id: number) {
    const nextStatus = crmStatusChoice[id];
    if (!nextStatus) return;
    const row = rows.find((r) => r.id === id);
    if (!row?.applicationId) return;

    setUpdatingCrmStatusId(id);
    setCrmStatusError(null);
    setCrmStatusSuccess(null);
    try {
      const res = await fetch(`/api/applications/${row.applicationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error?.message ?? "Could not update status.");
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, applicationStatus: nextStatus } : r
        )
      );
      setCrmStatusChoice((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setOpenCrmStatusFor(null);
      setCrmStatusSuccess("Status updated.");
      setTimeout(() => setCrmStatusSuccess(null), 3000);
    } catch (err) {
      setCrmStatusError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setUpdatingCrmStatusId(null);
    }
  }

  async function submitAction() {
    if (!actionCallId || !actionDate) return;
    setCompleting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const isFollowUp = actionCallId.nextActionType === "follow_up";
      const body: Record<string, unknown> = { type: isFollowUp ? "follow_up" : "interview_scheduled" };

      if (isFollowUp) {
        body.dueAt = new Date(actionDate).toISOString();
        body.assignTo = assignToId;
        body.note = actionNote;
      } else {
        body.scheduledAt = new Date(actionDate).toISOString();
        body.interviewerId = interviewerId || null;
        body.location = interviewLocation;
        body.note = actionNote;
      }

      const res = await fetch(`/api/calls/${actionCallId.id}/complete-action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error?.message ?? "Could not complete action.");
      }
      const result = await res.json();
      setActionSuccess(result.message ?? "Action completed.");

      // Refresh the row to clear action fields.
      setRows((prev) =>
        prev.map((r) =>
          r.id === actionCallId.id
            ? { ...r, nextActionType: null, nextActionAt: null, nextActionNote: null }
            : r
        )
      );
      setTimeout(closeActionModal, 800);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not complete action.");
    } finally {
      setCompleting(false);
    }
  }

  async function onAttribute(row: UnattributedCallRow) {
    const applicationId = attributeChoice[row.id];
    if (!applicationId) return;
    setAttributing(row.id);
    setAttributeError(null);
    try {
      const res = await fetch(`/api/calls/${row.id}/attribute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not attribute call.");
      }
      setUnattributedRows((prev) => prev.filter((r) => r.id !== row.id));
      setUnattributedTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setAttributeError(err instanceof Error ? err.message : "Could not attribute call.");
    } finally {
      setAttributing(null);
    }
  }

  const rangeStyle = (active: boolean) => (active ? activeTabStyle : inactiveTabStyle);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const noUnattributed = !unattributedLoading && unattributedRows.length === 0;

  const enrichedRows = useMemo(
    () =>
      rows.map((l) => {
        const arrow = directionArrow(l.direction);
        return { ...l, arrow };
      }),
    [rows]
  );

  return (
    <div data-screen-label="Call Logs">
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        style={{ display: "none" }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>
          {total}
          <br />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4B5565" }}>Call Logs</span>
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
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} style={{ ...selectStyle, minWidth: 80 }}>
          <option value="All">All</option>
          <option value="Outgoing">Outgoing</option>
          <option value="Incoming">Incoming</option>
        </select>
        {/* Repurposes the signed-off "Select Status" filter as the Connected/Not
            Connected axis (claude.md Open Question 1) — the live schema has no
            Busy/Switched Off states, only duration_seconds > 0 or not. */}
        <select value={connFilter} onChange={(e) => setConnFilter(e.target.value as ConnFilter)} style={{ ...selectStyle, minWidth: 150 }}>
          <option value="All">Select Status</option>
          <option value="Connected">Connected</option>
          <option value="Not Connected">Not Connected</option>
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 8, padding: 3 }}>
          <div onClick={() => setRange("Today")} style={{ padding: "6px 16px", borderRadius: 6, fontSize: 12.5, cursor: "pointer", ...rangeStyle(range === "Today") }}>
            Today
          </div>
          <div onClick={() => setRange("Last 30 Days")} style={{ padding: "6px 16px", borderRadius: 6, fontSize: 12.5, cursor: "pointer", ...rangeStyle(range === "Last 30 Days") }}>
            Last 30 Days
          </div>
          <div onClick={() => setRange("Select Range")} style={{ padding: "6px 16px", borderRadius: 6, fontSize: 12.5, cursor: "pointer", ...rangeStyle(range === "Select Range") }}>
            Select Range
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <div onClick={() => setOpenUsersPopover((v) => !v)} style={{ ...selectStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, minWidth: 150 }}>
            {usersNarrowed ? `${selectedUserKeys.size} Users Selected` : "Selected Users"}
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#9AA1AC" }}>▾</span>
          </div>
          {openUsersPopover && (
            <CheckboxListPopover
              options={teamOptions}
              selected={selectedUserKeys}
              onToggle={toggleUser}
              onClose={() => setOpenUsersPopover(false)}
              searchPlaceholder="Search Users"
            />
          )}
        </div>
        <div style={{ position: "relative" }}>
          <IconButton label="Sort by" onClick={() => setOpenSortPopover((v) => !v)}>
            <SortAzIcon />
          </IconButton>
          {openSortPopover && (
            <SortPopover value={sortKey} onChange={setSortKey} onClose={() => setOpenSortPopover(false)} options={CL_SORT_OPTIONS} />
          )}
        </div>
        <div
          onClick={() => setCallLogsTab(callLogsTab === "all" ? "unattributed" : "all")}
          title={callLogsTab === "all" ? "Unattributed Calls" : "Back to Call Logs"}
          style={{
            width: 34,
            height: 34,
            borderRadius: 6,
            border: "1px solid #E7E9EE",
            background: callLogsTab === "unattributed" ? "#1D2433" : "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path
              d="M2 3h12M4 3v9a1.5 1.5 0 001.5 1.5h5A1.5 1.5 0 0012 12V3M6.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1"
              fill="none"
              stroke={callLogsTab === "unattributed" ? "#FFFFFF" : "#4B5565"}
              strokeWidth="1.3"
            />
            <path d="M4 6.5h8" stroke={callLogsTab === "unattributed" ? "#FFFFFF" : "#4B5565"} strokeWidth="1.3" />
          </svg>
        </div>
        {loading && <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>Loading…</span>}
      </div>

      {callLogsTab === "all" && range === "Select Range" && (
        <DateRangeBar value={dateRange} onChange={setDateRange} onApply={() => setAppliedDateRange(dateRange)} />
      )}

      {loadError && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {loadError}
        </div>
      )}
      {attributeError && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {attributeError}
        </div>
      )}
      {crmStatusError && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {crmStatusError}
        </div>
      )}
      {crmStatusSuccess && (
        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          {crmStatusSuccess}
        </div>
      )}

      {callLogsTab === "all" && (
        <>
          <div style={{ position: "relative" }}>
            {scrollOffset > 0 && (
              <button
                onClick={() => tableScrollRef.current?.scrollBy({ left: -300, behavior: "smooth" })}
                style={{
                  position: "absolute",
                  left: 8,
                  top: 12,
                  zIndex: 5,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "1px solid #E7E9EE",
                  background: "#FFFFFF",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#4B5565",
                }}
                title="Scroll left"
              >
                <svg width="14" height="14" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => tableScrollRef.current?.scrollBy({ left: 300, behavior: "smooth" })}
                style={{
                  position: "absolute",
                  right: 8,
                  top: 12,
                  zIndex: 5,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "1px solid #E7E9EE",
                  background: "#FFFFFF",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#4B5565",
                }}
                title="Scroll right"
              >
                <svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </button>
            )}
            <div
              ref={tableScrollRef}
              onScroll={() => {
                if (tableScrollRef.current) {
                  const el = tableScrollRef.current;
                  setScrollOffset(el.scrollLeft);
                  setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
                }
              }}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E7E9EE",
                borderRadius: 10,
                overflow: "auto",
                maxHeight: "calc(100vh - 320px)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "0.35fr 0.9fr 1.7fr 1fr 1.1fr 1fr 1fr 1.1fr 1.1fr",
                  gap: 10,
                  padding: "10px 16px",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "#9AA1AC",
                  textTransform: "uppercase",
                  borderBottom: "1px solid #EEF0F4",
                  background: "#FAFBFC",
                  whiteSpace: "nowrap",
                  minWidth: 900,
                }}
              >
                <div>
                  <input type="checkbox" readOnly />
                </div>
                <div>Call Type</div>
                <div>Name</div>
                <div>By</div>
                <div>Called At</div>
                <div>AI Score</div>
                <div>Duration</div>
                <div>Next Action</div>
                <div>Status</div>
                <div>CRM Status</div>
              </div>
              {enrichedRows.map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "0.35fr 0.9fr 1.7fr 1fr 1.1fr 1fr 1fr 1.1fr 1.1fr",
                    gap: 10,
                    alignItems: "center",
                    padding: "9px 16px",
                    borderBottom: "1px solid #F4F5F8",
                    whiteSpace: "nowrap",
                    minWidth: 900,
                  }}
                >
                <div>
                  <input type="checkbox" readOnly />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: l.arrow.color }}>
                  <svg width="13" height="13" viewBox="0 0 16 16">
                    <path d={l.arrow.path} fill="none" stroke={l.arrow.color} strokeWidth="1.6" />
                  </svg>
                  {l.arrow.label}
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{l.candidateName}</div>
                  <div style={{ fontSize: 12, color: "#9AA1AC", marginBottom: 4 }}>{l.phone}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {l.hasRecording ? (
                      activeCallId === l.id ? (
                        <>
                          <button onClick={() => seekBy(-5)} title="Back 5 seconds" style={{ ...miniPlayerBtnStyle, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24">
                              <path d="M11 5V1L6 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H3c0 4.42 3.58 8 8 8s8-3.58-8-8-3.58-8-8-8z" fill="#4B5565" />
                            </svg>
                          </button>
                          <button onClick={togglePlayPause} title={isPlaying ? "Pause" : "Play"} style={{ ...miniPlayerBtnStyle, width: 24, height: 24, border: "none", background: "#FF5C35", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {isPlaying ? (
                              <svg width="8" height="8" viewBox="0 0 12 12"><rect x="2" y="1.5" width="3" height="9" fill="#FFFFFF" /><rect x="7" y="1.5" width="3" height="9" fill="#FFFFFF" /></svg>
                            ) : (
                              <svg width="8" height="8" viewBox="0 0 12 12"><path d="M2.5 1.5l7 4.5-7 4.5z" fill="#FFFFFF" /></svg>
                            )}
                          </button>
                          <button onClick={() => seekBy(5)} title="Forward 5 seconds" style={{ ...miniPlayerBtnStyle, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24">
                              <path d="M13 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6-6-2.69-6-6h2c0 4.42-3.58 8-8 8s8-3.58-8-8-3.58-8-8-8z" fill="#4B5565" />
                            </svg>
                          </button>
                          <div
                            ref={progressRef}
                            onClick={(e) => seekToClientX(e.clientX)}
                            title={`${fmtClock(currentTime)} / ${fmtClock(duration)}`}
                            style={{ width: 40, height: 4, background: "#EEF0F5", borderRadius: 2, position: "relative", cursor: "pointer" }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                bottom: 0,
                                left: 0,
                                width: `${duration ? Math.min((currentTime / duration) * 100, 100) : 0}%`,
                                background: "#FF5C35",
                                borderRadius: 2,
                              }}
                            />
                          </div>
                          <button onClick={stopPlayback} title="Stop" style={{ ...miniPlayerBtnStyle, width: 24, height: 24, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="8" height="8" viewBox="0 0 12 12">
                              <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="#9AA1AC" strokeWidth="1.4" strokeLinecap="round" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startPlayback(l)}
                          disabled={!l.hasRecording}
                          title="Play recording"
                          style={{
                            border: "1px solid #D9DCE3",
                            background: "#FFFFFF",
                            borderRadius: 4,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#4B5565",
                            cursor: l.hasRecording ? "pointer" : "default",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            opacity: l.hasRecording ? 1 : 0.4,
                          }}
                        >
                          <svg width="9" height="9" viewBox="0 0 12 12">
                            <path d="M2.5 1.5l7 4.5-7 4.5z" fill="#4B5565" />
                          </svg>
                          Play
                        </button>
                      )
                    ) : (
                      <button disabled style={{ border: "1px solid #EEF0F4", background: "#FAFBFC", borderRadius: 4, padding: "2px 8px", fontSize: 11, color: "#C9CED6", cursor: "default", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <svg width="9" height="9" viewBox="0 0 12 12">
                          <path d="M2.5 1.5l7 4.5-7 4.5z" fill="#C9CED6" />
                        </svg>
                        Play
                      </button>
                    )}
                    <button
                      onClick={() => downloadRecording(l)}
                      disabled={!l.hasRecording || downloadingId === l.id}
                      title={l.hasRecording ? "Download" : "No recording"}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        border: "1px solid #E7E9EE",
                        background: "#FFFFFF",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: l.hasRecording ? "pointer" : "default",
                        opacity: l.hasRecording ? 1 : 0.4,
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16">
                        <path d="M8 1.5v9M4.5 7l3.5 3.5L11.5 7" fill="none" stroke="#4B5565" strokeWidth="1.3" />
                        <line x1="2" y1="13.5" x2="14" y2="13.5" stroke="#4B5565" strokeWidth="1.3" />
                      </svg>
                    </button>
                    <CallButton phone={l.phone} />
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#4B5565" }}>{l.byUserName ?? "--"}</div>
                <div style={{ fontSize: 12.5, color: "#4B5565" }}>{l.calledAt}</div>
                <div>
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9.5" fill="none" stroke="#EEF0F5" strokeWidth="2.4" />
                    <path d="M12 2.5a9.5 9.5 0 018.2 14.4" fill="none" stroke="#F4A9A0" strokeWidth="2.4" />
                    <text x="12" y="15" textAnchor="middle" fontSize="8" fill="#C0392B" fontWeight="700">
                      !
                    </text>
                  </svg>
                </div>
                <div style={{ fontSize: 13, color: "#1D2433" }}>{fmtDuration(l.durationSeconds)}</div>
                <div>{renderNextAction(l, openActionModal)}</div>
                <div style={{ justifySelf: "start" }}>
                  {renderCrmStatus(l, {
                    openCrmStatusFor,
                    updatingCrmStatusId,
                    crmStatusChoice,
                    setOpenCrmStatusFor,
                    setCrmStatusChoice,
                    submitCrmStatus,
                  })}
                </div>
              </div>
            ))}
            {enrichedRows.length === 0 && (
              <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
                {loading ? "Loading call logs…" : "No calls match the current filters."}
              </div>
            )}
          </div>
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
        </>
      )}

      {callLogsTab === "unattributed" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
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
                value={unattributedSearch}
                onChange={(e) => setUnattributedSearch(e.target.value)}
                placeholder="Search Phone/Name"
                style={{ border: "none", outline: "none", fontSize: 13, color: "#1D2433", flex: 1, background: "transparent" }}
              />
            </div>
            <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>{unattributedTotal} unattributed</span>
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr 1.1fr 0.9fr 1.2fr 1.8fr",
                gap: 10,
                padding: "10px 16px",
                fontSize: 11.5,
                fontWeight: 600,
                color: "#9AA1AC",
                textTransform: "uppercase",
                borderBottom: "1px solid #EEF0F4",
                background: "#FAFBFC",
              }}
            >
              <div>Caller</div>
              <div>By</div>
              <div>Called At</div>
              <div>Duration</div>
              <div>Disposition</div>
              <div>Attribute to Job</div>
            </div>
            {unattributedRows.map((l) => {
              const dispStyle = l.disposition ? callDispositionStyles[l.disposition] : null;
              return (
                <div
                  key={l.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.6fr 1fr 1.1fr 0.9fr 1.2fr 1.8fr",
                    gap: 10,
                    alignItems: "center",
                    padding: "11px 16px",
                    borderBottom: "1px solid #F4F5F8",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{l.candidateName}</div>
                    <div style={{ fontSize: 12, color: "#9AA1AC" }}>{l.phone}</div>
                  </div>
                  <div style={{ fontSize: 13, color: "#4B5565" }}>{l.byUserName ?? "--"}</div>
                  <div style={{ fontSize: 12.5, color: "#9AA1AC" }}>{l.calledAt}</div>
                  <div style={{ fontSize: 13, color: "#1D2433" }}>{fmtDuration(l.durationSeconds)}</div>
                  <div>
                    {dispStyle ? (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 20,
                          background: dispStyle.bg,
                          color: dispStyle.color,
                        }}
                      >
                        {dispStyle.label}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#9AA1AC" }}>--</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select
                      value={attributeChoice[l.id] || ""}
                      onChange={(e) => onAttributeChoiceChange(l.id, e.target.value)}
                      disabled={l.candidateJobs.length === 0}
                      style={{ flex: 1, padding: "6px 8px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12 }}
                    >
                      <option value="">{l.candidateJobs.length === 0 ? "No applications" : "Select job…"}</option>
                      {l.candidateJobs.map((cj) => (
                        <option key={cj.applicationId} value={cj.applicationId}>
                          {cj.jobTitle}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => onAttribute(l)}
                      disabled={!attributeChoice[l.id] || attributing === l.id}
                      style={{
                        background: "#1D2433",
                        border: "none",
                        color: "#FFFFFF",
                        borderRadius: 6,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: !attributeChoice[l.id] || attributing === l.id ? "default" : "pointer",
                        opacity: !attributeChoice[l.id] ? 0.6 : 1,
                      }}
                    >
                      {attributing === l.id ? "Linking…" : "Link"}
                    </button>
                  </div>
                </div>
              );
            })}
            {noUnattributed && (
              <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
                No unattributed calls — everything is linked to a job.
              </div>
            )}
          </div>
        </>
      )}
      {actionCallId && (
        <ActionModal
          call={actionCallId}
          actionDate={actionDate}
          setActionDate={setActionDate}
          actionNote={actionNote}
          setActionNote={setActionNote}
          assignToId={assignToId}
          setAssignToId={setAssignToId}
          interviewerId={interviewerId}
          setInterviewerId={setInterviewerId}
          interviewLocation={interviewLocation}
          setInterviewLocation={setInterviewLocation}
          actionError={actionError}
          actionSuccess={actionSuccess}
          completing={completing}
          onClose={closeActionModal}
          onSubmit={submitAction}
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

// -- Status renderer (applications.status — the same value shown/edited on the Customers tab) --
function renderCrmStatus(
  l: CallRow,
  props: {
    openCrmStatusFor: number | null;
    updatingCrmStatusId: number | null;
    crmStatusChoice: Record<number, ApplicationStatus>;
    setOpenCrmStatusFor: (id: number | null) => void;
    setCrmStatusChoice: (updater: (prev: Record<number, ApplicationStatus>) => Record<number, ApplicationStatus>) => void;
    submitCrmStatus: (id: number) => void;
  }
): React.ReactNode {
  const { openCrmStatusFor, updatingCrmStatusId, crmStatusChoice, setOpenCrmStatusFor, setCrmStatusChoice, submitCrmStatus } = props;

  if (!l.applicationId) {
    return <span style={{ fontSize: 12, color: "#9AA1AC" }}>--</span>;
  }

  if (openCrmStatusFor === l.id) {
    return (
      <div style={{ position: "relative" }}>
        <select
          autoFocus
          value={crmStatusChoice[l.id] ?? l.applicationStatus ?? ""}
          onChange={(e) => {
            setCrmStatusChoice((prev) => ({ ...prev, [l.id]: e.target.value as ApplicationStatus }));
          }}
          style={{
            padding: "4px 8px",
            border: "1px solid #1D2433",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: "#FFFFFF",
            color: "#1D2433",
            cursor: "pointer",
            width: "100%",
            boxSizing: "border-box",
          }}
          onBlur={() => {
            const val = crmStatusChoice[l.id];
            if (val && val !== l.applicationStatus) {
              submitCrmStatus(l.id);
            } else {
              setOpenCrmStatusFor(null);
              setCrmStatusChoice((prev) => {
                const next = { ...prev };
                delete next[l.id];
                return next;
              });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = crmStatusChoice[l.id];
              if (val) submitCrmStatus(l.id);
            }
            if (e.key === "Escape") {
              setOpenCrmStatusFor(null);
              setCrmStatusChoice((prev) => {
                const next = { ...prev };
                delete next[l.id];
                return next;
              });
            }
          }}
        >
          <option value="">Select…</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusStyles[s]?.label ?? s}
            </option>
          ))}
        </select>
        {updatingCrmStatusId === l.id && (
          <span style={{ fontSize: 11, color: "#9AA1AC", marginLeft: 4 }}>Saving…</span>
        )}
      </div>
    );
  }

  const current = l.applicationStatus;
  if (!current) {
    return (
      <button
        onClick={() => setOpenCrmStatusFor(l.id)}
        style={{
          border: "1px dashed #D9DCE3",
          background: "#FAFBFC",
          color: "#9AA1AC",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        + Set Status
      </button>
    );
  }

  const style = statusStyles[current] ?? { bg: "#EEF0F5", color: "#5B6472", label: current };
  return (
    <button
      onClick={() => setOpenCrmStatusFor(l.id)}
      title="Click to change status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 20,
        border: "none",
        background: style.bg,
        color: style.color,
        fontSize: 11.5,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {style.label}
      <svg width="10" height="10" viewBox="0 0 16 16" style={{ opacity: 0.5 }}>
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function renderNextAction(l: CallRow, onOpen: (c: CallRow) => void): React.ReactNode {
  if (!l.nextActionType || !l.nextActionAt) return <span style={{ color: "#9AA1AC", fontSize: 12 }}>--</span>;

  const isFU = l.nextActionType === "follow_up";
  const label = isFU ? "Follow-up" : "Interview";
  const when = new Date(l.nextActionAt);
  const dateStr = when.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const timeStr = when.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <button
      onClick={() => onOpen(l)}
      title={l.nextActionNote ?? undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 6,
        border: "1px solid #D9DCE3",
        background: "#FFFFFF",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        color: isFU ? "#1A56DB" : "#7C3AED",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" fill="none" stroke={isFU ? "#1A56DB" : "#7C3AED"} strokeWidth="1.5" />
        <path d="M8 5v3.5l2.5 1.5" fill="none" stroke={isFU ? "#1A56DB" : "#7C3AED"} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      {label}
      <span style={{ color: "#9AA1AC", fontWeight: 400 }}>{dateStr} {timeStr}</span>
    </button>
  );
}

// -- Action completion modal --
function ActionModal({
  call,
  actionDate,
  setActionDate,
  actionNote,
  setActionNote,
  assignToId,
  setAssignToId,
  interviewerId,
  setInterviewerId,
  interviewLocation,
  setInterviewLocation,
  actionError,
  actionSuccess,
  completing,
  onClose,
  onSubmit,
}: {
  call: CallRow;
  actionDate: string;
  setActionDate: (v: string) => void;
  actionNote: string;
  setActionNote: (v: string) => void;
  assignToId: string;
  setAssignToId: (v: string) => void;
  interviewerId: string;
  setInterviewerId: (v: string) => void;
  interviewLocation: string;
  setInterviewLocation: (v: string) => void;
  actionError: string | null;
  actionSuccess: string | null;
  completing: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isFU = call.nextActionType === "follow_up";
  const title = isFU ? "Complete Follow-up" : "Schedule Interview";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 12,
          padding: 24,
          width: 480,
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9AA1AC" }}>✕</button>
        </div>

        <div style={{ fontSize: 13, color: "#4B5565", marginBottom: 12 }}>
          <strong>{call.candidateName}</strong> &middot; {call.phone}
        </div>

        {call.nextActionNote && (
          <div style={{ fontSize: 12, color: "#6B7280", background: "#F9FAFB", padding: "8px 12px", borderRadius: 6, marginBottom: 12 }}>
            Agent note: {call.nextActionNote}
          </div>
        )}

        {actionError && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
            {actionSuccess}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "#4B5565", display: "block", marginBottom: 4 }}>
            {isFU ? "Follow-up Date & Time" : "Interview Date & Time"} *
          </label>
          <input
            type="datetime-local"
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid #D9DCE3",
              borderRadius: 7,
              fontSize: 13,
              color: "#1D2433",
              boxSizing: "border-box",
            }}
          />
        </div>

        {!isFU && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#4B5565", display: "block", marginBottom: 4 }}>Location (optional)</label>
              <input
                type="text"
                value={interviewLocation}
                onChange={(e) => setInterviewLocation(e.target.value)}
                placeholder="Office / Video call / etc."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid #D9DCE3",
                  borderRadius: 7,
                  fontSize: 13,
                  color: "#1D2433",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#4B5565", display: "block", marginBottom: 4 }}>Interviewer (optional)</label>
              <input
                type="text"
                value={interviewerId}
                onChange={(e) => setInterviewerId(e.target.value)}
                placeholder="Interviewer name"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid #D9DCE3",
                  borderRadius: 7,
                  fontSize: 13,
                  color: "#1D2433",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "#4B5565", display: "block", marginBottom: 4 }}>Note (optional)</label>
          <textarea
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            rows={2}
            placeholder={isFU ? "Any follow-up note..." : "Interview notes..."}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid #D9DCE3",
              borderRadius: 7,
              fontSize: 13,
              color: "#1D2433",
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={completing}
            style={{
              padding: "8px 16px",
              border: "1px solid #D9DCE3",
              borderRadius: 7,
              background: "#FFFFFF",
              cursor: completing ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#4B5565",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={completing || !actionDate}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 7,
              background: completing || !actionDate ? "#C9CED6" : (isFU ? "#1A56DB" : "#7C3AED"),
              color: "#FFFFFF",
              cursor: completing || !actionDate ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {completing ? "Saving…" : (isFU ? "Create Follow-up" : "Schedule Interview")}
          </button>
        </div>
      </div>
    </div>
  );
}
