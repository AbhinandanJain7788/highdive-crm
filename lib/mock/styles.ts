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
};

export const dispositionStyles: Record<string, { bg: string; color: string }> = {
  Connected: { bg: "#E6F4EA", color: "#1E7F43" },
  "Not Connected": { bg: "#FDECEC", color: "#C0392B" },
  Busy: { bg: "#FFF4E5", color: "#B15C00" },
  "Switched Off": { bg: "#EEF0F5", color: "#5B6472" },
};

// Phase 5 / claude.md Open Question 1 (resolved): Connected/Not Connected is derived
// from `duration_seconds > 0`, kept as its own axis alongside the live
// `call_disposition` enum's outcome vocabulary (interested/callback_later/
// not_reachable) — the two are never merged into one badge.
export const connectionStyles: Record<"connected" | "not_connected", { label: string; bg: string; color: string }> = {
  connected: { label: "Connected", bg: "#E6F4EA", color: "#1E7F43" },
  not_connected: { label: "Not Connected", bg: "#FDECEC", color: "#C0392B" },
};

export const callDispositionStyles: Record<string, { label: string; bg: string; color: string }> = {
  interested: { label: "Interested", bg: "#E6F4EA", color: "#1E7F43" },
  callback_later: { label: "Callback Later", bg: "#FFF4E5", color: "#B15C00" },
  not_reachable: { label: "Not Reachable", bg: "#EEF0F5", color: "#5B6472" },
};

export const callDirectionLabels: Record<"outbound" | "inbound", string> = {
  outbound: "Outgoing",
  inbound: "Incoming",
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

// Orange is reserved for the brand/primary-action accent, so it's deliberately
// excluded here — a name-hashed avatar landing on the same orange as the "Add
// Customer" button and sidebar mark read as one more accent instead of a neutral
// identity color. Muted jewel tones instead of the old bright primaries.
export const avatarColors = ["#534AB7", "#185FA5", "#0F6E56", "#993556", "#3B6D11", "#5F5E5A"];

export function avatarColorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarColors[hash % avatarColors.length];
}

export function fmtDuration(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}
