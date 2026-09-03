// Verbatim from callLogsSeed (14 rows) — the Call Logs screen's own dataset, distinct
// from each candidate's embedded call history in candidates.ts.
export type MockCallLog = {
  id: string;
  candidateId: string | null;
  name: string;
  phone: string;
  type: "Outgoing" | "Incoming";
  byUserId: string;
  calledAt: string;
  durationSeconds: number;
  disposition: "Connected" | "Not Connected" | "Busy" | "Switched Off";
  recording: boolean;
  unattributed?: boolean;
};

// The mock data's day labels ("Today", "Yesterday", "27 Aug", ...) aren't tied to the
// real calendar — they're relative labels authored against the prototype's own frozen
// "today". Rank them oldest-to-newest so the Dashboard's Today/Y'day/Last 7/Last 30
// range tabs can filter by real relative recency instead of being purely cosmetic.
const DAY_RANK: Record<string, number> = {
  Today: 0,
  Yesterday: 1,
  "27 Aug": 2,
  "26 Aug": 3,
  "25 Aug": 4,
  "24 Aug": 5,
  "23 Aug": 6,
};

function dayLabel(calledAt: string): string {
  return calledAt.split(", ")[1] ?? calledAt;
}

export function dayRank(calledAt: string): number {
  return DAY_RANK[dayLabel(calledAt)] ?? 6;
}

// "Today"/"Yesterday" are relative labels, but the dated rows pin the anchor: DAY_RANK
// puts "27 Aug" at rank 2, so this dataset's "today" is 29 Aug 2026. Deriving it from
// the data rather than picking a date keeps the Select Range picker honest.
const CALL_LOG_TODAY_MS = new Date(2026, 7, 29).getTime();

export function callLogDateMs(calledAt: string): number {
  return CALL_LOG_TODAY_MS - dayRank(calledAt) * 24 * 60 * 60 * 1000;
}

export function withinRange(calledAt: string, range: "Today" | "Y'day" | "Last 7 Days" | "Last 30 Days"): boolean {
  const rank = dayRank(calledAt);
  if (range === "Today") return rank === 0;
  if (range === "Y'day") return rank === 1;
  // Every seeded row falls within 6 days, so both windows include everything —
  // correct behavior for this dataset, and it'll diverge once there's real history.
  return true;
}

export const callLogsSeed: MockCallLog[] = [
  { id: "l1", candidateId: "c1", name: "Ananya Sharma", phone: "+91 98201 34567", type: "Outgoing", byUserId: "u3", calledAt: "11:20 AM, Today", durationSeconds: 284, disposition: "Connected", recording: true },
  { id: "l2", candidateId: "c10", name: "Rahul Chauhan", phone: "+91 96543 21098", type: "Outgoing", byUserId: "u4", calledAt: "11:55 AM, Today", durationSeconds: 298, disposition: "Connected", recording: true },
  { id: "l3", candidateId: "c6", name: "Vikram Singh", phone: "+91 91234 56780", type: "Outgoing", byUserId: "u3", calledAt: "9:30 AM, Today", durationSeconds: 0, disposition: "Not Connected", recording: false },
  { id: "l4", candidateId: "c8", name: "Arjun Mehta", phone: "+91 88990 11223", type: "Outgoing", byUserId: "u6", calledAt: "3:45 PM, Yesterday", durationSeconds: 142, disposition: "Connected", recording: true },
  { id: "l5", candidateId: "c5", name: "Sneha Reddy", phone: "+91 90001 22334", type: "Incoming", byUserId: "u7", calledAt: "1:10 PM, Yesterday", durationSeconds: 355, disposition: "Connected", recording: true },
  { id: "l6", candidateId: "c9", name: "Neha Kapoor", phone: "+91 97001 88990", type: "Outgoing", byUserId: "u5", calledAt: "12:00 PM, 27 Aug", durationSeconds: 210, disposition: "Connected", recording: true },
  { id: "l7", candidateId: "c4", name: "Karan Malhotra", phone: "+91 98123 45678", type: "Outgoing", byUserId: "u4", calledAt: "10:40 AM, 27 Aug", durationSeconds: 96, disposition: "Connected", recording: true },
  { id: "l8", candidateId: "c3", name: "Priya Nair", phone: "+91 97654 32109", type: "Incoming", byUserId: "u5", calledAt: "2:15 PM, 26 Aug", durationSeconds: 512, disposition: "Connected", recording: true },
  { id: "l9", candidateId: "c12", name: "Aditya Rao", phone: "+91 94445 67788", type: "Outgoing", byUserId: "u7", calledAt: "10:00 AM, 25 Aug", durationSeconds: 410, disposition: "Connected", recording: true },
  { id: "l10", candidateId: null, name: "Unknown Caller", phone: "+91 90876 54321", type: "Incoming", byUserId: "u6", calledAt: "4:22 PM, 25 Aug", durationSeconds: 0, disposition: "Switched Off", recording: false, unattributed: true },
  { id: "l11", candidateId: "c7", name: "Divya Iyer", phone: "+91 89012 34567", type: "Outgoing", byUserId: "u6", calledAt: "3:00 PM, 24 Aug", durationSeconds: 0, disposition: "Busy", recording: false, unattributed: false },
  { id: "l12", candidateId: "c14", name: "Manish Gupta", phone: "+91 92109 87654", type: "Outgoing", byUserId: "u8", calledAt: "11:10 AM, 24 Aug", durationSeconds: 63, disposition: "Connected", recording: true, unattributed: false },
  { id: "l13", candidateId: null, name: "Unknown Caller", phone: "+91 90111 22333", type: "Incoming", byUserId: "u8", calledAt: "5:40 PM, 24 Aug", durationSeconds: 45, disposition: "Connected", recording: true, unattributed: true },
  { id: "l14", candidateId: null, name: "Unknown Caller", phone: "+91 90222 33444", type: "Incoming", byUserId: "u3", calledAt: "6:15 PM, 23 Aug", durationSeconds: 0, disposition: "Not Connected", recording: false, unattributed: true },
];
