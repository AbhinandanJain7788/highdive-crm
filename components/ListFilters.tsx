"use client";

import { useEffect, useRef, useState } from "react";
import {
  candidatesSeed,
  recruiters,
  usersSeed,
  statusStyles,
  defaultPipelineStages,
  candidateProfileFor,
  currentUser,
  type ApplicationStatus,
  type MockCandidate,
} from "@/lib/mock";

export type StatusMode = "status" | "stage";
export type SortKey = "name-asc" | "name-desc" | "created-new" | "created-old";
export type UserScope = "selected" | "pool";

// The two columns the table always shows — they can't be turned off.
export const FIXED_COLUMN_LABELS = ["Name & Phone Number", "Status"];

// Everything under "Available columns to customize", in the order the design lists them.
export type ColumnId =
  | "email"
  | "address"
  | "city"
  | "state"
  | "country"
  | "pincode"
  | "altName"
  | "altPhone"
  | "notes"
  | "interviewScheduledOn"
  | "highestEducation"
  | "instituteName"
  | "yearsOfExperience"
  | "employmentType"
  | "createdOn"
  | "assignTo"
  | "companyName"
  | "source"
  | "currentDesignation"
  | "lastCtc"
  | "age";

export const ALL_COLUMN_IDS: ColumnId[] = [
  "email",
  "address",
  "city",
  "state",
  "country",
  "pincode",
  "altName",
  "altPhone",
  "notes",
  "interviewScheduledOn",
  "highestEducation",
  "instituteName",
  "yearsOfExperience",
  "employmentType",
  "createdOn",
  "assignTo",
  "companyName",
  "source",
  "currentDesignation",
  "lastCtc",
  "age",
];

export const COLUMN_LABELS: Record<ColumnId, string> = {
  email: "Email",
  address: "Address",
  city: "City",
  state: "State",
  country: "Country",
  pincode: "Pincode",
  altName: "Alternate name",
  altPhone: "Alternate phone",
  notes: "Notes",
  interviewScheduledOn: "Interview Scheduled On",
  highestEducation: "Highest Education",
  instituteName: "Institute Name",
  yearsOfExperience: "Years of Experience",
  employmentType: "Employment Type",
  createdOn: "Created On",
  assignTo: "Assign To",
  companyName: "Company name",
  source: "Source",
  currentDesignation: "Current Designation",
  lastCtc: "Last CTC",
  age: "Age",
};

// At most 10 of the customizable columns can be on at once.
export const MAX_SELECTED_COLUMNS = 10;
export const DEFAULT_COLUMNS: ColumnId[] = ["createdOn", "assignTo", "source"];

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name-asc", label: "Name: A-Z" },
  { key: "name-desc", label: "Name: Z-A" },
  { key: "created-new", label: "Created: New to Old" },
  { key: "created-old", label: "Created: Old to New" },
];

export const ALL_STATUSES = Object.keys(statusStyles) as ApplicationStatus[];
export const ALL_SOURCES = Array.from(new Set(candidatesSeed.map((c) => c.source))).sort();
export const UNASSIGNED_ID = "__unassigned__";
export const ALL_USER_KEYS = [UNASSIGNED_ID, ...recruiters.map((r) => r.id)];

export function statusOptionsFor(mode: StatusMode) {
  const values = mode === "status" ? ALL_STATUSES : defaultPipelineStages;
  return values.map((v) => ({ id: v, label: mode === "status" ? statusStyles[v]?.label ?? v : v }));
}

export const userOptions = [
  { id: UNASSIGNED_ID, label: "Unassigned (Common Pool)" },
  ...recruiters.map((r) => ({ id: r.id, label: r.name })),
];

export function userName(id: string | null): string {
  if (!id) return "--";
  return usersSeed.find((u) => u.id === id)?.name ?? "--";
}

export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

export const iconBtnStyle: React.CSSProperties = {
  position: "relative",
  width: 34,
  height: 34,
  borderRadius: 6,
  border: "1px solid #E7E9EE",
  background: "#FFFFFF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

export const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #D9DCE3",
  borderRadius: 6,
  fontSize: 12.5,
  color: "#4B5565",
  background: "#FFFFFF",
};

export const rangeBtnStyle: React.CSSProperties = { padding: "6px 14px", borderRadius: 6, fontSize: 12.5, cursor: "pointer" };

export function rangeStyle(active: boolean): React.CSSProperties {
  return active ? { background: "#1D2433", color: "#FFFFFF" } : { color: "#4B5565" };
}

export function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: active ? "1px solid #FF5C35" : "1px solid #D9DCE3",
    background: active ? "#FFF5F2" : "#FFFFFF",
    color: active ? "#FF5C35" : "#4B5565",
  };
}

export function tabStyle(active: boolean): React.CSSProperties {
  return active
    ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" }
    : { color: "#4B5565", borderBottom: "2px solid transparent" };
}

/* ---------------------------------- icons --------------------------------- */

export function FunnelIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <path d="M2 3h12l-4.6 5.4v4.2l-2.8 1.4V8.4z" fill="none" stroke="#4B5565" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function SortAzIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <text x="0.5" y="7" fontSize="7" fontWeight="700" fill="#4B5565">
        A
      </text>
      <text x="0.5" y="15" fontSize="7" fontWeight="700" fill="#4B5565">
        Z
      </text>
      <path d="M12 2.5v10M9.6 10.2L12 12.8l2.4-2.6" fill="none" stroke="#4B5565" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ColumnsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <line x1="1.5" y1="4" x2="14.5" y2="4" stroke="#4B5565" strokeWidth="1.3" />
      <line x1="1.5" y1="8" x2="14.5" y2="8" stroke="#4B5565" strokeWidth="1.3" />
      <line x1="1.5" y1="12" x2="14.5" y2="12" stroke="#4B5565" strokeWidth="1.3" />
      <circle cx="5" cy="4" r="1.7" fill="#FFFFFF" stroke="#4B5565" strokeWidth="1.3" />
      <circle cx="10.5" cy="8" r="1.7" fill="#FFFFFF" stroke="#4B5565" strokeWidth="1.3" />
      <circle cx="6.5" cy="12" r="1.7" fill="#FFFFFF" stroke="#4B5565" strokeWidth="1.3" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <circle cx="6" cy="5.5" r="2.4" fill="none" stroke="#4B5565" strokeWidth="1.2" />
      <circle cx="11.4" cy="6.3" r="1.7" fill="none" stroke="#4B5565" strokeWidth="1.2" />
      <path d="M1.6 13c0-2.2 2-3.7 4.4-3.7s4.4 1.5 4.4 3.7" fill="none" stroke="#4B5565" strokeWidth="1.2" />
      <path d="M11.6 9.6c1.7.1 2.9 1.4 2.9 3.4" fill="none" stroke="#4B5565" strokeWidth="1.2" />
    </svg>
  );
}

function PoolIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <rect x="1.6" y="2.8" width="12.8" height="11" rx="1.6" fill="none" stroke="#4B5565" strokeWidth="1.2" />
      <line x1="1.6" y1="6.2" x2="14.4" y2="6.2" stroke="#4B5565" strokeWidth="1.2" />
      <line x1="5" y1="1.5" x2="5" y2="4" stroke="#4B5565" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="11" y1="1.5" x2="11" y2="4" stroke="#4B5565" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------- tooltip --------------------------------- */

// Hover label for the icon-only buttons, so "AZ" reads as "Sort by" and the sliders
// icon reads as "Manage Table Columns" instead of the user having to guess.
export function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ position: "relative", display: "flex" }}>
      <div
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={label}
        aria-label={label}
        style={{ ...iconBtnStyle, borderColor: hover ? "#C9CED6" : "#E7E9EE" }}
      >
        {children}
        {active && <div style={{ position: "absolute", top: -3, right: -3, width: 6, height: 6, borderRadius: "50%", background: "#FF5C35" }} />}
      </div>
      {hover && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 7px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#FFFFFF",
            border: "1px solid #E7E9EE",
            boxShadow: "0 6px 18px rgba(23,26,32,0.12)",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 12,
            color: "#1D2433",
            whiteSpace: "nowrap",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- popovers -------------------------------- */

export function PopoverShell({
  outsideRef,
  width = 240,
  align = "left",
  children,
}: {
  outsideRef: React.RefObject<HTMLDivElement | null>;
  width?: number;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div
      ref={outsideRef}
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        [align]: 0,
        width,
        background: "#FFFFFF",
        border: "1px solid #E7E9EE",
        borderRadius: 10,
        boxShadow: "0 10px 28px rgba(23,26,32,0.14)",
        zIndex: 40,
        padding: 10,
      }}
    >
      {children}
    </div>
  );
}

export function CheckboxListPopover({
  options,
  selected,
  onToggle,
  onClose,
  searchPlaceholder,
}: {
  options: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
  searchPlaceholder: string;
}) {
  const [q, setQ] = useState("");
  const ref = useClickOutside<HTMLDivElement>(onClose);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <PopoverShell outsideRef={ref}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #E7E9EE", borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>
        <svg width="13" height="13" viewBox="0 0 14 14">
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
          <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#9AA1AC" strokeWidth="1.4" />
        </svg>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          style={{ border: "none", outline: "none", fontSize: 12.5, flex: 1, color: "#1D2433" }}
        />
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {filtered.map((o) => (
          <label
            key={o.id}
            style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#1D2433", cursor: "pointer", padding: "6px 4px", borderRadius: 6 }}
          >
            <input type="checkbox" checked={selected.has(o.id)} onChange={() => onToggle(o.id)} />
            {o.label}
          </label>
        ))}
        {filtered.length === 0 && <div style={{ fontSize: 12.5, color: "#9AA1AC", padding: "10px 4px" }}>No matches</div>}
      </div>
      <button
        onClick={onClose}
        style={{ marginTop: 10, width: "100%", background: "#FF5C35", border: "none", color: "#FFFFFF", borderRadius: 6, padding: "8px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
      >
        OK
      </button>
    </PopoverShell>
  );
}

export function SortPopover({
  value,
  onChange,
  onClose,
  options = SORT_OPTIONS,
}: {
  value: SortKey;
  onChange: (k: SortKey) => void;
  onClose: () => void;
  options?: { key: SortKey; label: string }[];
}) {
  const ref = useClickOutside<HTMLDivElement>(onClose);
  return (
    <PopoverShell outsideRef={ref} width={190} align="left">
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {options.map((o) => (
          <div
            key={o.key}
            onClick={() => {
              onChange(o.key);
              onClose();
            }}
            style={{
              fontSize: 13,
              padding: "8px 8px",
              borderRadius: 6,
              cursor: "pointer",
              color: value === o.key ? "#FF5C35" : "#1D2433",
              background: value === o.key ? "#FFF5F2" : "transparent",
              fontWeight: value === o.key ? 700 : 500,
            }}
          >
            {o.label}
          </div>
        ))}
      </div>
    </PopoverShell>
  );
}

/* --------------------------- user scope dropdown --------------------------- */

// The allocations list is scoped either to the users' own allocations or to the
// unassigned Common Pool — those are the only two choices.
export function UserScopeDropdown({ value, onChange }: { value: UserScope; onChange: (v: UserScope) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const options: { id: UserScope; label: string; icon: React.ReactNode }[] = [
    { id: "selected", label: "Selected Users", icon: <PeopleIcon /> },
    { id: "pool", label: "Common Pool", icon: <PoolIcon /> },
  ];
  const current = options.find((o) => o.id === value) ?? options[0];

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{ ...selectStyle, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, minWidth: 170 }}
      >
        {current.icon}
        <span style={{ fontSize: 12.5, color: "#1D2433" }}>{current.label}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#9AA1AC" }}>▾</span>
      </div>
      {open && (
        <div
          ref={ref}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            minWidth: 200,
            background: "#FFFFFF",
            border: "1px solid #E7E9EE",
            borderRadius: 8,
            boxShadow: "0 10px 28px rgba(23,26,32,0.14)",
            zIndex: 40,
            padding: 4,
          }}
        >
          {options.map((o) => (
            <div
              key={o.id}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                color: "#1D2433",
                background: o.id === value ? "#F1F3F7" : "transparent",
              }}
            >
              {o.icon}
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- date range bar ----------------------------- */

export type DateRange = { fromDate: string; fromTime: string; fromAmPm: string; toDate: string; toTime: string; toAmPm: string };

export const DEFAULT_DATE_RANGE: DateRange = {
  fromDate: "2026-08-05",
  fromTime: "12:00",
  fromAmPm: "AM",
  toDate: "2026-09-03",
  toTime: "11:59",
  toAmPm: "PM",
};

// "11:59" + "PM" -> milliseconds past midnight, so the range covers whole days properly.
function clockMs(time: string, amPm: string): number {
  const [hRaw, mRaw] = time.split(":");
  let h = parseInt(hRaw, 10);
  const m = parseInt(mRaw, 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  if (amPm === "PM" && h !== 12) h += 12;
  if (amPm === "AM" && h === 12) h = 0;
  return h * 3600000 + m * 60000;
}

export function dateRangeBounds(r: DateRange): { from: number; to: number } | null {
  if (!r.fromDate || !r.toDate) return null;
  const from = new Date(r.fromDate + "T00:00:00").getTime() + clockMs(r.fromTime, r.fromAmPm);
  const to = new Date(r.toDate + "T00:00:00").getTime() + clockMs(r.toTime, r.toAmPm);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return from <= to ? { from, to } : { from: to, to: from };
}

const dateFieldStyle: React.CSSProperties = {
  border: "none",
  borderBottom: "1px dashed #C9CED6",
  background: "transparent",
  fontSize: 13,
  color: "#4B5565",
  padding: "3px 2px",
  outline: "none",
};

export function DateRangeBar({
  value,
  onChange,
  onApply,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  onApply: () => void;
}) {
  const set = (patch: Partial<DateRange>) => onChange({ ...value, ...patch });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", margin: "4px 0 14px" }}>
      <input type="date" value={value.fromDate} onChange={(e) => set({ fromDate: e.target.value })} style={{ ...dateFieldStyle, width: 132 }} />
      <input type="text" value={value.fromTime} onChange={(e) => set({ fromTime: e.target.value })} style={{ ...dateFieldStyle, width: 52, textAlign: "center" }} />
      <select value={value.fromAmPm} onChange={(e) => set({ fromAmPm: e.target.value })} style={{ ...dateFieldStyle, borderBottom: "none" }}>
        <option>AM</option>
        <option>PM</option>
      </select>
      <span style={{ color: "#9AA1AC" }}>-</span>
      <input type="date" value={value.toDate} onChange={(e) => set({ toDate: e.target.value })} style={{ ...dateFieldStyle, width: 132 }} />
      <input type="text" value={value.toTime} onChange={(e) => set({ toTime: e.target.value })} style={{ ...dateFieldStyle, width: 52, textAlign: "center" }} />
      <select value={value.toAmPm} onChange={(e) => set({ toAmPm: e.target.value })} style={{ ...dateFieldStyle, borderBottom: "none" }}>
        <option>AM</option>
        <option>PM</option>
      </select>
      <button
        onClick={onApply}
        style={{ background: "transparent", border: "none", color: "#FF5C35", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "4px 6px" }}
      >
        Apply
      </button>
    </div>
  );
}

/* ------------------------------ more filters ------------------------------ */

export function MoreFiltersPanel({
  initialStatusMode,
  initialStatuses,
  initialSources,
  onCancel,
  onApply,
}: {
  initialStatusMode: StatusMode;
  initialStatuses: Set<string>;
  initialSources: Set<string>;
  onCancel: () => void;
  onApply: (mode: StatusMode, statuses: Set<string>, sources: Set<string>) => void;
}) {
  const [mode, setMode] = useState<StatusMode>(initialStatusMode);
  const [statuses, setStatuses] = useState<Set<string>>(new Set(initialStatuses));
  const [sources, setSources] = useState<Set<string>>(new Set(initialSources));

  const statusOptions = mode === "status" ? ALL_STATUSES : defaultPipelineStages;
  const statusLabel = (v: string) => (mode === "status" ? statusStyles[v]?.label ?? v : v);

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, v: string) {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setSet(next);
  }

  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(29,36,51,0.4)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 380, maxWidth: "90vw", height: "100%", background: "#FFFFFF", padding: 24, overflowY: "auto", display: "flex", flexDirection: "column" }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", marginBottom: 20 }}>More filters</div>

        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#4B5565", marginBottom: 10 }}>Filter by Source</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {ALL_SOURCES.map((s) => (
            <div key={s} onClick={() => toggle(sources, setSources, s)} style={pillStyle(sources.has(s))}>
              {s}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#4B5565", marginBottom: 10, display: "flex", alignItems: "center", gap: 18 }}>
          Filter by
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 500, cursor: "pointer" }}>
            <input
              type="radio"
              checked={mode === "status"}
              onChange={() => {
                setMode("status");
                setStatuses(new Set());
              }}
            />
            Status
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 500, cursor: "pointer" }}>
            <input
              type="radio"
              checked={mode === "stage"}
              onChange={() => {
                setMode("stage");
                setStatuses(new Set());
              }}
            />
            Stage
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
          {statusOptions.map((s) => (
            <div key={s} onClick={() => toggle(statuses, setStatuses, s)} style={pillStyle(statuses.has(s))}>
              {statusLabel(s)}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 10, paddingTop: 16, borderTop: "1px solid #EEF0F4" }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "10px", borderRadius: 6, border: "1px solid #D9DCE3", background: "#FFFFFF", color: "#4B5565", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(mode, statuses, sources)}
            style={{ flex: 1, padding: "10px", borderRadius: 6, border: "none", background: "#FF5C35", color: "#FFFFFF", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- manage columns ----------------------------- */

export function ManageColumnsModal({
  initialColumns,
  onCancel,
  onSave,
}: {
  initialColumns: ColumnId[];
  onCancel: () => void;
  onSave: (cols: ColumnId[]) => void;
}) {
  const [columns, setColumns] = useState<ColumnId[]>(initialColumns);
  const [q, setQ] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const atLimit = columns.length >= MAX_SELECTED_COLUMNS;
  const available = ALL_COLUMN_IDS.filter(
    (id) => !columns.includes(id) && COLUMN_LABELS[id].toLowerCase().includes(q.toLowerCase())
  );

  function removeColumn(id: ColumnId) {
    setColumns((prev) => prev.filter((c) => c !== id));
  }
  function addColumn(id: ColumnId) {
    setColumns((prev) => (prev.length >= MAX_SELECTED_COLUMNS ? prev : [...prev, id]));
  }

  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(29,36,51,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 440, maxWidth: "92vw", maxHeight: "88vh", background: "#FFFFFF", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1D2433" }}>Manage Columns</div>
          <div onClick={onCancel} style={{ cursor: "pointer", fontSize: 20, color: "#9AA1AC", lineHeight: 1 }}>
            ×
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#4B5565", marginBottom: 14 }}>
          Selected Columns
          <span style={{ background: "#EEF0F5", color: "#4B5565", borderRadius: 20, padding: "3px 10px", fontWeight: 600, fontSize: 12 }}>
            {columns.length} out of {MAX_SELECTED_COLUMNS}
          </span>
        </div>

        <div style={{ overflowY: "auto", flex: 1, marginBottom: 16 }}>
          {FIXED_COLUMN_LABELS.map((label) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 4px", borderBottom: "1px solid #F4F5F8" }}>
              <input type="checkbox" checked disabled style={{ accentColor: "#C9CED6" }} />
              <span style={{ fontSize: 14, color: "#9AA1AC" }}>{label}</span>
            </div>
          ))}
          {columns.map((id, i) => (
            <div
              key={id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex === null || dragIndex === i) return;
                setColumns((prev) => {
                  const next = [...prev];
                  const [moved] = next.splice(dragIndex, 1);
                  next.splice(i, 0, moved);
                  return next;
                });
                setDragIndex(null);
              }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 4px", borderBottom: "1px solid #F4F5F8", cursor: "grab", background: dragIndex === i ? "#FAFBFC" : "transparent" }}
            >
              <span style={{ color: "#C9CED6", fontSize: 13 }}>⠿</span>
              <input type="checkbox" checked onChange={() => removeColumn(id)} style={{ accentColor: "#FF5C35" }} />
              <span style={{ fontSize: 14, color: "#1D2433" }}>{COLUMN_LABELS[id]}</span>
            </div>
          ))}

          <div style={{ marginTop: 20, background: "#F7F8FA", borderRadius: 10, padding: 14 }}>
            <div style={{ marginBottom: 12, fontSize: 13.5, fontWeight: 600, color: "#4B5565" }}>Available columns to customize</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #E7E9EE", background: "#FFFFFF", borderRadius: 7, padding: "8px 10px", marginBottom: 10 }}>
              <svg width="13" height="13" viewBox="0 0 14 14">
                <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
                <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#9AA1AC" strokeWidth="1.4" />
              </svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a column" style={{ border: "none", outline: "none", fontSize: 13, flex: 1, background: "transparent" }} />
            </div>
            {atLimit && (
              <div style={{ fontSize: 12, color: "#B15C00", background: "#FFF4E5", borderRadius: 6, padding: "7px 10px", marginBottom: 10 }}>
                You can select up to {MAX_SELECTED_COLUMNS} columns. Uncheck one to add another.
              </div>
            )}
            <div style={{ background: "#FFFFFF", borderRadius: 8, maxHeight: 210, overflowY: "auto" }}>
              {available.map((id) => (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderBottom: "1px solid #F4F5F8", opacity: atLimit ? 0.5 : 1 }}>
                  <input type="checkbox" checked={false} disabled={atLimit} onChange={() => addColumn(id)} style={{ accentColor: "#FF5C35" }} />
                  <span style={{ fontSize: 14, color: "#1D2433" }}>{COLUMN_LABELS[id]}</span>
                </div>
              ))}
              {available.length === 0 && <div style={{ fontSize: 12.5, color: "#9AA1AC", padding: "12px" }}>No more columns to add</div>}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{ padding: "10px 24px", borderRadius: 7, border: "1px solid #D9DCE3", background: "#FFFFFF", color: "#4B5565", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(columns)}
            style={{ padding: "10px 24px", borderRadius: 7, border: "none", background: "#FF5C35", color: "#FFFFFF", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- cell render ------------------------------ */

const cellText: React.CSSProperties = { fontSize: 13, color: "#4B5565", overflow: "hidden", textOverflow: "ellipsis" };
const cellMuted: React.CSSProperties = { fontSize: 12.5, color: "#9AA1AC", overflow: "hidden", textOverflow: "ellipsis" };

export function renderColumnCell(id: ColumnId, c: MockCandidate) {
  const p = candidateProfileFor(c.id);
  switch (id) {
    case "createdOn":
      return <div style={cellMuted}>{c.createdOn}</div>;
    case "assignTo":
      return <div style={cellText}>{userName(c.recruiterId)}</div>;
    case "source":
      return <div style={cellText}>{c.source}</div>;
    case "notes":
      return <div style={cellMuted} title={c.notes || undefined}>{c.notes || "--"}</div>;
    case "email":
      return <div style={cellText}>{p.email}</div>;
    case "address":
      return <div style={cellText} title={p.address}>{p.address}</div>;
    case "city":
      return <div style={cellText}>{p.city}</div>;
    case "state":
      return <div style={cellText}>{p.state}</div>;
    case "country":
      return <div style={cellText}>{p.country}</div>;
    case "pincode":
      return <div style={cellText}>{p.pincode}</div>;
    case "altName":
      return <div style={cellText}>{p.altName}</div>;
    case "altPhone":
      return <div style={cellText}>{p.altPhone}</div>;
    case "interviewScheduledOn":
      return <div style={cellMuted}>{p.interviewScheduledOn}</div>;
    case "highestEducation":
      return <div style={cellText}>{p.highestEducation}</div>;
    case "instituteName":
      return <div style={cellText}>{p.instituteName}</div>;
    case "yearsOfExperience":
      return <div style={cellText}>{p.yearsOfExperience}</div>;
    case "employmentType":
      return <div style={cellText}>{p.employmentType}</div>;
    case "companyName":
      return <div style={cellText}>{p.companyName}</div>;
    case "currentDesignation":
      return <div style={cellText} title={p.currentDesignation}>{p.currentDesignation}</div>;
    case "lastCtc":
      return <div style={cellText}>{p.lastCtc}</div>;
    case "age":
      return <div style={cellText}>{p.age}</div>;
  }
}

// Kept for the pages that still show a "Created By" cell outside the configurable set.
export function createdByName() {
  return currentUser.name;
}
