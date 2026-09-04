"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { avatarLetterFor } from "@/lib/mock";
import { avatarColorFor, fmtDuration, callDispositionStyles, callDirectionLabels } from "@/lib/mock/styles";
import {
  selectStyle,
  CheckboxListPopover,
  SortPopover,
  DateRangeBar,
  DEFAULT_DATE_RANGE,
  dateRangeBounds,
  IconButton,
  SortAzIcon,
  type SortKey,
  type DateRange,
} from "@/components/ListFilters";
import { PAGE_SIZES } from "@/lib/calls.shared";
import type { CallRow, UnattributedCallRow, CallDirection } from "@/lib/calls.shared";

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
  const [range, setRange] = useState<RangeFilter>("Today");
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
  const [playingCallId, setPlayingCallId] = useState<number | null>(null);
  const [audioUrlCache, setAudioUrlCache] = useState<Record<number, string | null>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        setTotal(body.total ?? 0);
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

  async function togglePlay(call: CallRow) {
    if (!call.hasRecording) return;
    if (playingCallId === call.id) {
      audioRef.current?.pause();
      setPlayingCallId(null);
      return;
    }
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
    if (!url || !audioRef.current) return;
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
    setPlayingCallId(call.id);
  }

  function onAttributeChoiceChange(id: number, val: string) {
    setAttributeChoice((prev) => ({ ...prev, [id]: val }));
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
      <audio ref={audioRef} onEnded={() => setPlayingCallId(null)} style={{ display: "none" }} />

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

      {callLogsTab === "all" && (
        <>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden", overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "0.35fr 0.9fr 1.5fr 1fr 1.1fr 1fr 0.9fr 1.6fr",
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
                <input type="checkbox" readOnly />
              </div>
              <div>Call Type</div>
              <div>Name</div>
              <div>By</div>
              <div>Called At</div>
              <div>AI Score</div>
              <div>Duration</div>
              <div>Actions</div>
            </div>
            {enrichedRows.map((l) => (
              <div
                key={l.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "0.35fr 0.9fr 1.5fr 1fr 1.1fr 1fr 0.9fr 1.6fr",
                  gap: 10,
                  alignItems: "center",
                  padding: "11px 16px",
                  borderBottom: "1px solid #F4F5F8",
                  whiteSpace: "nowrap",
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
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: avatarColorFor(l.candidateName),
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {avatarLetterFor(l.candidateName)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{l.candidateName}</div>
                    <div style={{ fontSize: 12, color: "#9AA1AC" }}>{l.phone}</div>
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
                <div style={{ display: "flex", gap: 8 }}>
                  {l.hasRecording ? (
                    <button
                      onClick={() => togglePlay(l)}
                      style={{
                        border: "1px solid #D9DCE3",
                        background: playingCallId === l.id ? "#FFF0EA" : "#FFFFFF",
                        color: playingCallId === l.id ? "#FF5C35" : "#4B5565",
                        borderRadius: 6,
                        padding: "7px 14px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12">
                        <path d="M2.5 1.5l7 4.5-7 4.5z" fill={playingCallId === l.id ? "#FF5C35" : "#4B5565"} />
                      </svg>
                      {playingCallId === l.id ? "Playing…" : "Play Recording"}
                    </button>
                  ) : (
                    <button
                      disabled
                      style={{
                        border: "1px solid #EEF0F4",
                        background: "#FAFBFC",
                        color: "#C9CED6",
                        borderRadius: 6,
                        padding: "7px 14px",
                        fontSize: 12.5,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12">
                        <path d="M2.5 1.5l7 4.5-7 4.5z" fill="#C9CED6" />
                      </svg>
                      Play Recording
                    </button>
                  )}
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 6,
                      border: "1px solid #E7E9EE",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16">
                      <path d="M8 1.5v9M4.5 7l3.5 3.5L11.5 7" fill="none" stroke="#4B5565" strokeWidth="1.3" />
                      <line x1="2" y1="13.5" x2="14" y2="13.5" stroke="#4B5565" strokeWidth="1.3" />
                    </svg>
                  </div>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      border: "1px solid #FFD9CC",
                      background: "#FFF5F2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
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
            {enrichedRows.length === 0 && (
              <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
                {loading ? "Loading call logs…" : "No calls match the current filters."}
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
