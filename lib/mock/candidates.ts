import { avatarColorFor } from "./styles";

export type MockCall = {
  date: string;
  by: string;
  durationSeconds: number;
  disposition: "Connected" | "Not Connected";
  recording: boolean;
};

export type ApplicationStatus =
  | "new"
  | "contacted"
  | "interview_scheduled"
  | "interview_done"
  | "selected"
  | "rejected"
  | "not_interested"
  | "no_response"
  | "joined";

export type MockCandidate = {
  id: string;
  name: string;
  phone: string;
  jobId: string;
  status: ApplicationStatus;
  recruiterId: string | null;
  source: string;
  createdOn: string;
  isDuplicate: boolean;
  hasResume: boolean;
  notes: string;
  calls: MockCall[];
};

// Verbatim from candidatesSeed / Phase 0 seed (14 candidates, all 9 application_status
// values covered). Status strings converted to the schema's application_status enum
// values; original display text lives in lib/mock/styles.ts's statusStyles.
export const candidatesSeed: MockCandidate[] = [
  {
    id: "c1",
    name: "Ananya Sharma",
    phone: "+91 98201 34567",
    jobId: "j1",
    status: "interview_scheduled",
    recruiterId: "u3",
    source: "Naukri",
    createdOn: "28 Aug 2026",
    isDuplicate: false,
    hasResume: true,
    notes: "Strong React + TypeScript background, 5 yrs experience. Currently serving notice.",
    calls: [
      { date: "28 Aug, 11:20 AM", by: "Ayesha Khan", durationSeconds: 284, disposition: "Connected", recording: true },
      { date: "26 Aug, 4:05 PM", by: "Ayesha Khan", durationSeconds: 0, disposition: "Not Connected", recording: false },
    ],
  },
  {
    id: "c2",
    name: "Rohit Verma",
    phone: "+91 99887 65432",
    jobId: "j2",
    status: "new",
    recruiterId: null,
    source: "LinkedIn",
    createdOn: "31 Aug 2026",
    isDuplicate: true,
    hasResume: true,
    notes: "",
    calls: [],
  },
  {
    id: "c3",
    name: "Priya Nair",
    phone: "+91 97654 32109",
    jobId: "j3",
    status: "selected",
    recruiterId: "u5",
    source: "Referral",
    createdOn: "20 Aug 2026",
    isDuplicate: false,
    hasResume: true,
    notes: "Offer letter to be issued this week.",
    calls: [{ date: "27 Aug, 2:15 PM", by: "Kavya Menon", durationSeconds: 512, disposition: "Connected", recording: true }],
  },
  {
    id: "c4",
    name: "Karan Malhotra",
    phone: "+91 98123 45678",
    jobId: "j4",
    status: "not_interested",
    recruiterId: "u4",
    source: "Indeed",
    createdOn: "22 Aug 2026",
    isDuplicate: false,
    hasResume: false,
    notes: "Relocation to Bengaluru not possible for this candidate.",
    calls: [{ date: "23 Aug, 10:40 AM", by: "Rohan Deshmukh", durationSeconds: 96, disposition: "Connected", recording: true }],
  },
  {
    id: "c5",
    name: "Sneha Reddy",
    phone: "+91 90001 22334",
    jobId: "j5",
    status: "interview_done",
    recruiterId: "u7",
    source: "Naukri",
    createdOn: "19 Aug 2026",
    isDuplicate: false,
    hasResume: true,
    notes: "Awaiting client feedback after final round.",
    calls: [{ date: "25 Aug, 1:10 PM", by: "Anjali Bhatt", durationSeconds: 355, disposition: "Connected", recording: true }],
  },
  {
    id: "c6",
    name: "Vikram Singh",
    phone: "+91 91234 56780",
    jobId: "j6",
    status: "no_response",
    recruiterId: "u3",
    source: "Apna",
    createdOn: "21 Aug 2026",
    isDuplicate: false,
    hasResume: false,
    notes: "",
    calls: [
      { date: "24 Aug, 9:30 AM", by: "Ayesha Khan", durationSeconds: 0, disposition: "Not Connected", recording: false },
      { date: "21 Aug, 5:00 PM", by: "Ayesha Khan", durationSeconds: 0, disposition: "Not Connected", recording: false },
    ],
  },
  {
    id: "c7",
    name: "Divya Iyer",
    phone: "+91 89012 34567",
    jobId: "j7",
    status: "new",
    recruiterId: null,
    source: "CSV Import",
    createdOn: "31 Aug 2026",
    isDuplicate: false,
    hasResume: true,
    notes: "",
    calls: [],
  },
  {
    id: "c8",
    name: "Arjun Mehta",
    phone: "+91 88990 11223",
    jobId: "j8",
    status: "contacted",
    recruiterId: "u6",
    source: "Naukri",
    createdOn: "26 Aug 2026",
    isDuplicate: false,
    hasResume: true,
    notes: "Requested JD by email, follow up in 2 days.",
    calls: [{ date: "27 Aug, 3:45 PM", by: "Suresh Pillai", durationSeconds: 142, disposition: "Connected", recording: true }],
  },
  {
    id: "c9",
    name: "Neha Kapoor",
    phone: "+91 97001 88990",
    jobId: "j9",
    status: "rejected",
    recruiterId: "u5",
    source: "LinkedIn",
    createdOn: "18 Aug 2026",
    isDuplicate: false,
    hasResume: true,
    notes: "Portfolio below required level for this role.",
    calls: [{ date: "19 Aug, 12:00 PM", by: "Kavya Menon", durationSeconds: 210, disposition: "Connected", recording: true }],
  },
  {
    id: "c10",
    name: "Rahul Chauhan",
    phone: "+91 96543 21098",
    jobId: "j10",
    status: "interview_scheduled",
    recruiterId: "u4",
    source: "Referral",
    createdOn: "27 Aug 2026",
    isDuplicate: false,
    hasResume: true,
    notes: "Interview scheduled for 3 Sep, 11:00 AM with client.",
    calls: [{ date: "28 Aug, 11:55 AM", by: "Rohan Deshmukh", durationSeconds: 298, disposition: "Connected", recording: true }],
  },
  {
    id: "c11",
    name: "Pooja Joshi",
    phone: "+91 95678 90123",
    jobId: "j11",
    status: "new",
    recruiterId: null,
    source: "Naukri",
    createdOn: "31 Aug 2026",
    isDuplicate: true,
    hasResume: true,
    notes: "",
    calls: [],
  },
  {
    id: "c12",
    name: "Aditya Rao",
    phone: "+91 94445 67788",
    jobId: "j12",
    status: "joined",
    recruiterId: "u7",
    source: "Indeed",
    createdOn: "10 Aug 2026",
    isDuplicate: false,
    hasResume: true,
    notes: "Joined client on 25 Aug 2026.",
    calls: [{ date: "12 Aug, 10:00 AM", by: "Anjali Bhatt", durationSeconds: 410, disposition: "Connected", recording: true }],
  },
  {
    id: "c13",
    name: "Simran Kaur",
    phone: "+91 93210 98765",
    jobId: "j13",
    status: "new",
    recruiterId: null,
    source: "Apna",
    createdOn: "30 Aug 2026",
    isDuplicate: false,
    hasResume: false,
    notes: "",
    calls: [],
  },
  {
    id: "c14",
    name: "Manish Gupta",
    phone: "+91 92109 87654",
    jobId: "j14",
    status: "new",
    recruiterId: null,
    source: "CSV Import",
    createdOn: "31 Aug 2026",
    isDuplicate: false,
    hasResume: true,
    notes: "",
    calls: [],
  },
];

export function avatarLetterFor(name: string) {
  return name.charAt(0).toUpperCase();
}

export function candidateAvatarColor(candidate: MockCandidate) {
  return avatarColorFor(candidate.name);
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseCreatedOn(createdOn: string): number {
  const [day, mon, year] = createdOn.split(" ");
  return new Date(Number(year), MONTHS[mon], Number(day)).getTime();
}

// Exposed so the Select Range date/time picker can compare a candidate's "28 Aug 2026"
// createdOn against the ISO dates the <input type="date"> fields produce.
export function candidateCreatedOnMs(createdOn: string): number {
  return parseCreatedOn(createdOn);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// "Today" anchors to the most recent createdOn in the seed (the mock's own frozen
// "now"), not the real wall-clock date — this data was authored once and doesn't
// track the actual calendar. Mirrors lib/mock/callLogs.ts's dayRank for the same reason.
const latestCreatedOnMs = Math.max(...candidatesSeed.map((c) => parseCreatedOn(c.createdOn)));

export function candidateDayRank(createdOn: string): number {
  return Math.round((latestCreatedOnMs - parseCreatedOn(createdOn)) / MS_PER_DAY);
}

export function withinCandidateRange(
  createdOn: string,
  range: "Today" | "Y'day" | "Last 7 Days" | "Last 30 Days"
): boolean {
  const rank = candidateDayRank(createdOn);
  if (range === "Today") return rank === 0;
  if (range === "Y'day") return rank === 1;
  if (range === "Last 7 Days") return rank <= 6;
  return rank <= 29;
}

// Each candidate's embedded call history uses its own "DD Mon, HH:MM AM/PM" format
// (no year — same mock-frozen "today" convention as createdOn/calledAt elsewhere).
const allCallDatesMs = candidatesSeed.flatMap((c) => c.calls.map((call) => parseCreatedOn(call.date.split(",")[0] + " 2026")));
const latestCallDateMs = allCallDatesMs.length ? Math.max(...allCallDatesMs) : latestCreatedOnMs;

export function callDateRank(date: string): number {
  const dayPart = date.split(",")[0] + " 2026";
  return Math.round((latestCallDateMs - parseCreatedOn(dayPart)) / MS_PER_DAY);
}

// Absolute timestamp for an embedded call ("28 Aug, 11:20 AM"), so the Select Range
// date picker can compare against it the same way it does a candidate's createdOn.
export function callDateMs(date: string): number {
  return parseCreatedOn(date.split(",")[0] + " 2026");
}
