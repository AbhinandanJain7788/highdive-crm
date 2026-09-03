// Verbatim from the HTML's statusStyles / dispositionStyles / liveStatusColors / avatarColors,
// keyed by the schema's enum values (application_status, live_status) instead of the HTML's
// display strings, with a label alongside each so the UI still renders identical text.

export const statusStyles: Record<string, { label: string; bg: string; color: string }> = {
  new: { label: "New", bg: "#E8F0FE", color: "#1A56DB" },
  contacted: { label: "Contacted", bg: "#FFF4E5", color: "#B15C00" },
  no_response: { label: "No Response", bg: "#EEF0F5", color: "#5B6472" },
  not_interested: { label: "Not Interested", bg: "#FDECEC", color: "#C0392B" },
  interview_scheduled: { label: "Interview Scheduled", bg: "#E8F0FE", color: "#1A56DB" },
  interview_done: { label: "Interview Done", bg: "#F1EAFE", color: "#6B3FA0" },
  selected: { label: "Selected", bg: "#E6F4EA", color: "#1E7F43" },
  joined: { label: "Joined", bg: "#DCF5E1", color: "#157347" },
  rejected: { label: "Rejected", bg: "#FDECEC", color: "#C0392B" },
  not_eligible: { label: "Not Eligible", bg: "#EEF0F5", color: "#5B6472" },
};

export const dispositionStyles: Record<string, { bg: string; color: string }> = {
  Connected: { bg: "#E6F4EA", color: "#1E7F43" },
  "Not Connected": { bg: "#FDECEC", color: "#C0392B" },
  Busy: { bg: "#FFF4E5", color: "#B15C00" },
  "Switched Off": { bg: "#EEF0F5", color: "#5B6472" },
};

export const liveStatusColors: Record<string, string> = {
  idle: "#D97706",
  on_call: "#16A34A",
  on_break: "#2563EB",
  offline: "#94A3B8",
};

export const liveStatusLabels: Record<string, string> = {
  idle: "Idle",
  on_call: "On Call",
  on_break: "On Break",
  offline: "Offline",
};

export const avatarColors = ["#FF5C35", "#2563EB", "#16A34A", "#7C3AED", "#0F7A6C", "#B15C00", "#DB2777"];

export function avatarColorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarColors[hash % avatarColors.length];
}

export function fmtDuration(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}
