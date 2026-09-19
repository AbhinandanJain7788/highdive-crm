import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { formatDisplayDateTime } from "@/lib/format";
import type { InterviewRow, InterviewStatus } from "@/lib/interviews.shared";

export type { InterviewRow, InterviewStatus } from "@/lib/interviews.shared";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const INTERVIEW_SELECT = `
  id, application_id, candidate_id, client_id, interviewer_id, scheduled_by,
  scheduled_at, duration_minutes, location, status, note, created_at, completed_at,
  candidate:candidates!inner(id, name, phone),
  client:clients(id, company),
  application:applications(id, job:jobs(id, title))
`;

type RawInterview = {
  id: string;
  application_id: string;
  candidate_id: string;
  client_id: string;
  interviewer_id: string | null;
  scheduled_by: string | null;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  status: InterviewStatus;
  note: string | null;
  created_at: string;
  completed_at: string | null;
  candidate: { id: string; name: string; phone: string | null } | null;
  client: { id: string; company: string } | null;
  application: { id: string; job: { id: string; title: string } | null } | null;
};

async function resolveUserNames(
  supabase: SupabaseClient<Database>,
  ids: (string | null)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from("users").select("id, name").in("id", unique);
  if (error) throw error;
  return new Map((data ?? []).map((u) => [u.id, u.name]));
}

function toInterviewRow(r: RawInterview, names: Map<string, string>): InterviewRow {
  return {
    id: r.id,
    applicationId: r.application_id,
    candidateId: r.candidate_id,
    candidateName: r.candidate?.name ?? "--",
    phone: r.candidate?.phone ?? "--",
    jobId: r.application?.job?.id ?? null,
    jobTitle: r.application?.job?.title ?? null,
    clientId: r.client_id,
    clientName: r.client?.company ?? "--",
    interviewerId: r.interviewer_id,
    interviewerName: r.interviewer_id ? names.get(r.interviewer_id) ?? null : null,
    scheduledById: r.scheduled_by,
    scheduledByName: r.scheduled_by ? names.get(r.scheduled_by) ?? null : null,
    scheduledAt: formatDisplayDateTime(r.scheduled_at),
    scheduledAtRaw: r.scheduled_at,
    durationMinutes: r.duration_minutes,
    location: r.location,
    status: r.status,
    note: r.note,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

export type InterviewListOptions = {
  candidateId?: string;
  applicationId?: string;
  clientId?: string;
  interviewerId?: string;
  status?: InterviewStatus;
};

async function fetchRows(
  supabase: SupabaseClient<Database>,
  options: InterviewListOptions
): Promise<InterviewRow[]> {
  let query = supabase.from("interviews").select(INTERVIEW_SELECT).is("candidate.deleted_at", null);

  if (options.candidateId) query = query.eq("candidate_id", options.candidateId);
  if (options.applicationId) query = query.eq("application_id", options.applicationId);
  if (options.clientId) query = query.eq("client_id", options.clientId);
  if (options.interviewerId) query = query.eq("interviewer_id", options.interviewerId);
  if (options.status) query = query.eq("status", options.status);

  const { data, error } = await query.order("scheduled_at", { ascending: false }).returns<RawInterview[]>();
  if (error) throw error;

  const rows = data ?? [];
  const names = await resolveUserNames(supabase, [
    ...rows.map((r) => r.interviewer_id),
    ...rows.map((r) => r.scheduled_by),
  ]);
  return rows.map((r) => toInterviewRow(r, names));
}

export async function getInterviewRows(
  supabase: SupabaseClient<Database>,
  options: InterviewListOptions
): Promise<InterviewRow[]> {
  return fetchRows(supabase, options);
}

export async function getInterviewCalendarEvents(
  supabase: SupabaseClient<Database>,
  { year, month }: { year: number; month: number } // month: 1-12
): Promise<InterviewRow[]> {
  const monthStartUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
  const monthEndUtc = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - IST_OFFSET_MS);

  const { data, error } = await supabase
    .from("interviews")
    .select(INTERVIEW_SELECT)
    .is("candidate.deleted_at", null)
    .gte("scheduled_at", monthStartUtc.toISOString())
    .lt("scheduled_at", monthEndUtc.toISOString())
    .order("scheduled_at", { ascending: true })
    .returns<RawInterview[]>();
  if (error) throw error;

  const rows = data ?? [];
  const names = await resolveUserNames(supabase, [
    ...rows.map((r) => r.interviewer_id),
    ...rows.map((r) => r.scheduled_by),
  ]);
  return rows.map((r) => toInterviewRow(r, names));
}

export type CreateInterviewInput = {
  applicationId: string;
  interviewerId?: string | null;
  scheduledBy: string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string | null;
  note?: string | null;
};

export async function createInterview(
  supabase: SupabaseClient<Database>,
  input: CreateInterviewInput
): Promise<InterviewRow | { error: "application_not_found" }> {
  const { data: application, error: appErr } = await supabase
    .from("applications")
    .select("id, candidate_id, job:jobs(id, client_id)")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (appErr) throw appErr;
  if (!application || !application.job) return { error: "application_not_found" };

  const { data: inserted, error: insertErr } = await supabase
    .from("interviews")
    .insert({
      application_id: input.applicationId,
      candidate_id: application.candidate_id,
      client_id: application.job.client_id,
      interviewer_id: input.interviewerId || null,
      scheduled_by: input.scheduledBy,
      scheduled_at: input.scheduledAt,
      duration_minutes: input.durationMinutes ?? 60,
      location: input.location?.trim() || null,
      note: input.note?.trim() || null,
      status: "scheduled",
    })
    .select("id")
    .single();
  if (insertErr) throw insertErr;

  const { data, error } = await supabase
    .from("interviews")
    .select(INTERVIEW_SELECT)
    .eq("id", inserted.id)
    .single<RawInterview>();
  if (error) throw error;
  const names = await resolveUserNames(supabase, [data.interviewer_id, data.scheduled_by]);
  return toInterviewRow(data, names);
}

export type UpdateInterviewInput = {
  status?: InterviewStatus;
  interviewerId?: string | null;
  scheduledAt?: string;
  durationMinutes?: number;
  location?: string | null;
  note?: string | null;
};

export async function updateInterview(
  supabase: SupabaseClient<Database>,
  id: string,
  patch: UpdateInterviewInput
): Promise<InterviewRow | null> {
  const update: Database["public"]["Tables"]["interviews"]["Update"] = {};
  if (patch.status) {
    update.status = patch.status;
    update.completed_at = patch.status === "completed" ? new Date().toISOString() : null;
  }
  if (patch.interviewerId !== undefined) update.interviewer_id = patch.interviewerId || null;
  if (patch.scheduledAt) update.scheduled_at = patch.scheduledAt;
  if (patch.durationMinutes !== undefined) update.duration_minutes = patch.durationMinutes;
  if (patch.location !== undefined) update.location = patch.location?.trim() || null;
  if (patch.note !== undefined) update.note = patch.note?.trim() || null;

  if (Object.keys(update).length === 0) return null;

  const { data, error } = await supabase.from("interviews").update(update).eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: full, error: fullErr } = await supabase
    .from("interviews")
    .select(INTERVIEW_SELECT)
    .eq("id", id)
    .single<RawInterview>();
  if (fullErr) throw fullErr;
  const names = await resolveUserNames(supabase, [full.interviewer_id, full.scheduled_by]);
  return toInterviewRow(full, names);
}
