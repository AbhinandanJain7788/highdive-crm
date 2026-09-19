// Types shared by the server query module and client components — mirrors
// lib/followups.shared.ts's split (free of `server-only`/Supabase imports so
// "use client" components can import it directly).
import type { Database } from "@/types/supabase";

export type InterviewStatus = Database["public"]["Enums"]["interview_status"];

export const INTERVIEW_STATUSES: InterviewStatus[] = ["scheduled", "completed", "cancelled", "no_show"];

export const interviewStatusStyles: Record<InterviewStatus, { bg: string; color: string; label: string }> = {
  scheduled: { bg: "#EAF1FF", color: "#1D4FD8", label: "Scheduled" },
  completed: { bg: "#E7F6EC", color: "#1E7F43", label: "Completed" },
  cancelled: { bg: "#F4F5F8", color: "#6B7280", label: "Cancelled" },
  no_show: { bg: "#FEF2F2", color: "#B42318", label: "No-Show" },
};

export type InterviewRow = {
  id: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  phone: string;
  jobId: string | null;
  jobTitle: string | null;
  clientId: string;
  clientName: string;
  interviewerId: string | null;
  interviewerName: string | null;
  scheduledById: string | null;
  scheduledByName: string | null;
  scheduledAt: string;
  scheduledAtRaw: string;
  durationMinutes: number;
  location: string | null;
  status: InterviewStatus;
  note: string | null;
  createdAt: string;
  completedAt: string | null;
};
