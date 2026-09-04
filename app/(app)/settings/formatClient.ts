// Client-safe copy of lib/format.ts's formatDisplayDateTime — that module is
// `server-only` and this file backs a "use client" component (activity log timestamps).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function formatDisplayDateTimeClient(value: string | null): string {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const day = String(ist.getUTCDate()).padStart(2, "0");
  let hours = ist.getUTCHours();
  const minutes = String(ist.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${ampm}, ${day} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}
