// Matches the 9 follow-ups seeded in Phase 0 — reassigned onto the real user/candidate
// cast (per your call that followUpsSeed's names in the HTML are disconnected placeholder
// data, not real people). status is always 'pending'; Pending vs Upcoming is computed from
// dueAt at render time, matching claude.md Phase 5's rule.
export type MockFollowUp = {
  id: string;
  candidateId: string;
  jobId: string;
  dueAt: string; // ISO
  assignedById: string;
  assignToId: string;
  note: string;
};

export const followUpsSeed: MockFollowUp[] = [
  { id: "f1", candidateId: "c1", jobId: "j1", dueAt: "2026-09-01T15:00:00+05:30", assignedById: "u2", assignToId: "u3", note: "Confirm interview slot with candidate" },
  { id: "f2", candidateId: "c10", jobId: "j10", dueAt: "2026-09-03T11:00:00+05:30", assignedById: "u2", assignToId: "u4", note: "Interview scheduled with client at 11:00 AM" },
  { id: "f3", candidateId: "c8", jobId: "j8", dueAt: "2026-08-28T10:00:00+05:30", assignedById: "u2", assignToId: "u6", note: "Follow up on JD sent by email" },
  { id: "f4", candidateId: "c6", jobId: "j6", dueAt: "2026-09-02T09:00:00+05:30", assignedById: "u2", assignToId: "u3", note: "Re-attempt contact, no response so far" },
  { id: "f5", candidateId: "c3", jobId: "j3", dueAt: "2026-09-05T12:00:00+05:30", assignedById: "u2", assignToId: "u5", note: "Confirm offer acceptance" },
  { id: "f6", candidateId: "c5", jobId: "j5", dueAt: "2026-09-04T14:00:00+05:30", assignedById: "u2", assignToId: "u7", note: "Chase client for final round feedback" },
  { id: "f7", candidateId: "c1", jobId: "j4", dueAt: "2026-09-06T10:00:00+05:30", assignedById: "u2", assignToId: "u4", note: "Initial screening call" },
  { id: "f8", candidateId: "c12", jobId: "j12", dueAt: "2026-09-10T10:00:00+05:30", assignedById: "u2", assignToId: "u7", note: "Onboarding check-in after joining" },
  { id: "f9", candidateId: "c7", jobId: "j7", dueAt: "2026-09-02T16:00:00+05:30", assignedById: "u2", assignToId: "u2", note: "Initial screening call for new candidate" },
];
