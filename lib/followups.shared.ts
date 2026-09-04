// Types shared by the server query module and client components — free of
// `server-only`/Supabase imports, same reason as lib/allocations.shared.ts.
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];
export type FollowUpStatus = Database["public"]["Enums"]["follow_up_status"];

export const PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 25;

// Field names mirror lib/mock/followUps.ts's MockFollowUp shape plus the display
// fields the Follow-Ups/Calendar/Recurring screens actually render.
export type FollowUpRow = {
  id: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  phone: string;
  jobTitle: string | null;
  applicationStatus: ApplicationStatus | null;
  followUpStatus: FollowUpStatus;
  dueAt: string;
  dueAtRaw: string;
  // Only meaningful while followUpStatus === "pending": due today-or-earlier vs a
  // future date, IST day boundary. null once completed/cancelled — those don't
  // belong in either tab (claude.md Phase 5 Checkpoint 4: "Completing a follow-up
  // moves it out of Pending").
  bucket: "pending" | "upcoming" | null;
  assignedById: string | null;
  assignedByName: string | null;
  assignToId: string | null;
  assignToName: string | null;
  sourcedById: string | null;
  sourcedByName: string | null;
  note: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  completedAt: string | null;
  createdAt: string;
};
