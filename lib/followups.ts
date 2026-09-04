import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { escapeFilterValue, formatDisplayDateTime, phoneSearchPattern, type Pagination } from "@/lib/format";
import type { FollowUpRow, FollowUpStatus } from "@/lib/followups.shared";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export type { FollowUpRow, FollowUpStatus } from "@/lib/followups.shared";
export { PAGE_SIZES, DEFAULT_PAGE_SIZE } from "@/lib/followups.shared";

// `!inner` on the application embed is only needed when a query actually filters on
// `application.status` — PostgREST's default (outer) embed only filters the nested
// resource, not the parent row, so an application-status filter without the hint
// would silently do nothing. Everywhere else (detail fetch, create/update re-fetch,
// calendar) uses the plain outer embed.
function followUpSelect(needsInnerApplication: boolean): string {
  return `
    id, application_id, candidate_id, due_at, assigned_by, assign_to, is_recurring,
    recurrence_rule, status, note, created_at, completed_at,
    candidate:candidates(id, name, phone, created_by),
    application:applications${needsInnerApplication ? "!inner" : ""}(id, status, job:jobs(id, title))
  `;
}
const FOLLOWUP_SELECT = followUpSelect(false);

type RawFollowUp = {
  id: string;
  application_id: string;
  candidate_id: string;
  due_at: string;
  assigned_by: string | null;
  assign_to: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  status: FollowUpStatus;
  note: string | null;
  created_at: string;
  completed_at: string | null;
  candidate: { id: string; name: string; phone: string | null; created_by: string | null } | null;
  application: { id: string; status: ApplicationStatus; job: { id: string; title: string } | null } | null;
};

// "Today" for the Pending/Upcoming split is IST wall-clock, matching every other
// date anchor in this codebase (Calendar/Follow-ups' own comments). The cutoff is
// the end of today IST expressed as a UTC instant, so `due_at <= cutoff` reads as
// "due today or earlier" regardless of the server process's own timezone.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function endOfTodayIstUtc(): Date {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const istMidnightTomorrow = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, 0, 0, 0, 0);
  return new Date(istMidnightTomorrow - IST_OFFSET_MS - 1);
}

function bucketFor(status: FollowUpStatus, dueAtRaw: string, cutoffMs: number): "pending" | "upcoming" | null {
  if (status !== "pending") return null;
  return new Date(dueAtRaw).getTime() <= cutoffMs ? "pending" : "upcoming";
}

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

function toFollowUpRow(f: RawFollowUp, names: Map<string, string>, cutoffMs: number): FollowUpRow {
  const sourcedById = f.candidate?.created_by ?? null;
  return {
    id: f.id,
    applicationId: f.application_id,
    candidateId: f.candidate_id,
    candidateName: f.candidate?.name ?? "--",
    phone: f.candidate?.phone ?? "--",
    jobTitle: f.application?.job?.title ?? null,
    applicationStatus: f.application?.status ?? null,
    followUpStatus: f.status,
    dueAt: formatDisplayDateTime(f.due_at),
    dueAtRaw: f.due_at,
    bucket: bucketFor(f.status, f.due_at, cutoffMs),
    assignedById: f.assigned_by,
    assignedByName: f.assigned_by ? names.get(f.assigned_by) ?? null : null,
    assignToId: f.assign_to,
    assignToName: f.assign_to ? names.get(f.assign_to) ?? null : null,
    sourcedById,
    sourcedByName: sourcedById ? names.get(sourcedById) ?? null : null,
    note: f.note,
    isRecurring: f.is_recurring,
    recurrenceRule: f.recurrence_rule,
    completedAt: f.completed_at,
    createdAt: f.created_at,
  };
}

async function resolveSearchCandidateIds(supabase: SupabaseClient<Database>, search: string): Promise<string[]> {
  const term = escapeFilterValue(search);
  const phonePattern = phoneSearchPattern(search);
  const clauses = [`name.ilike.%${term}%`];
  if (term) clauses.push(`phone.ilike.%${term}%`);
  if (phonePattern) clauses.push(`phone.ilike.${phonePattern}`);
  const { data, error } = await supabase.from("candidates").select("id").or(clauses.join(","));
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

export type FollowUpListOptions = {
  search?: string;
  candidateId?: string;
  applicationId?: string;
  bucket?: "pending" | "upcoming";
  followUpStatus?: FollowUpStatus;
  isRecurring?: boolean;
  statuses?: ApplicationStatus[];
  dueFrom?: string;
  dueTo?: string;
  sort?: "due-asc" | "due-desc" | "name-asc" | "name-desc";
  pagination: Pagination;
};

function buildQuery(
  supabase: SupabaseClient<Database>,
  options: Omit<FollowUpListOptions, "pagination">,
  searchCandidateIds: string[] | null,
  cutoff: Date,
  countExact: boolean
) {
  const needsInnerApplication = Boolean(options.statuses?.length);
  let query = supabase
    .from("follow_ups")
    .select(followUpSelect(needsInnerApplication), countExact ? { count: "exact" } : undefined);

  if (options.candidateId) query = query.eq("candidate_id", options.candidateId);
  if (options.applicationId) query = query.eq("application_id", options.applicationId);
  if (options.isRecurring !== undefined) query = query.eq("is_recurring", options.isRecurring);
  if (options.dueFrom) query = query.gte("due_at", options.dueFrom);
  if (options.dueTo) query = query.lte("due_at", options.dueTo);

  if (options.bucket === "pending") query = query.eq("status", "pending").lte("due_at", cutoff.toISOString());
  else if (options.bucket === "upcoming") query = query.eq("status", "pending").gt("due_at", cutoff.toISOString());
  else if (options.followUpStatus) query = query.eq("status", options.followUpStatus);

  if (options.statuses?.length) query = query.in("application.status", options.statuses);

  if (options.search?.trim() && searchCandidateIds) {
    if (searchCandidateIds.length) query = query.in("candidate_id", searchCandidateIds);
    else query = query.eq("candidate_id", "00000000-0000-0000-0000-000000000000"); // no match
  }

  return query;
}

export async function getFollowUpRows(
  supabase: SupabaseClient<Database>,
  options: FollowUpListOptions
): Promise<{ rows: FollowUpRow[]; total: number }> {
  const cutoff = endOfTodayIstUtc();
  const searchCandidateIds = options.search?.trim() ? await resolveSearchCandidateIds(supabase, options.search) : null;
  let query = buildQuery(supabase, options, searchCandidateIds, cutoff, true);

  const sort = options.sort ?? "due-asc";
  if (sort === "name-asc") query = query.order("name", { ascending: true, foreignTable: "candidate" });
  else if (sort === "name-desc") query = query.order("name", { ascending: false, foreignTable: "candidate" });
  else query = query.order("due_at", { ascending: sort === "due-asc" });

  const { data, error, count } = await query
    .range(options.pagination.from, options.pagination.to)
    .returns<RawFollowUp[]>();
  if (error) throw error;

  const rows = data ?? [];
  const names = await resolveUserNames(supabase, [
    ...rows.map((r) => r.assigned_by),
    ...rows.map((r) => r.assign_to),
    ...rows.map((r) => r.candidate?.created_by ?? null),
  ]);
  const cutoffMs = cutoff.getTime();

  return { rows: rows.map((r) => toFollowUpRow(r, names, cutoffMs)), total: count ?? 0 };
}

// Pending/Upcoming counts for a filter set that excludes the bucket itself, same
// pattern as lib/allocations.ts's getAllocationBucketCounts — so switching tabs
// never changes what a filter narrowed down to.
export async function getFollowUpBucketCounts(
  supabase: SupabaseClient<Database>,
  options: Omit<FollowUpListOptions, "bucket" | "pagination" | "sort">
): Promise<{ pending: number; upcoming: number }> {
  const cutoff = endOfTodayIstUtc();
  const searchCandidateIds = options.search?.trim() ? await resolveSearchCandidateIds(supabase, options.search) : null;
  const [pending, upcoming] = await Promise.all([
    buildQuery(supabase, { ...options, bucket: "pending" }, searchCandidateIds, cutoff, true).range(0, 0),
    buildQuery(supabase, { ...options, bucket: "upcoming" }, searchCandidateIds, cutoff, true).range(0, 0),
  ]);
  if (pending.error) throw pending.error;
  if (upcoming.error) throw upcoming.error;
  return { pending: pending.count ?? 0, upcoming: upcoming.count ?? 0 };
}

export async function getFollowUpCalendarEvents(
  supabase: SupabaseClient<Database>,
  { year, month }: { year: number; month: number } // month: 1-12
): Promise<FollowUpRow[]> {
  // Month window expressed in IST, converted to UTC bounds for the query.
  const monthStartUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
  const monthEndUtc = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - IST_OFFSET_MS);

  const { data, error } = await supabase
    .from("follow_ups")
    .select(FOLLOWUP_SELECT)
    .gte("due_at", monthStartUtc.toISOString())
    .lt("due_at", monthEndUtc.toISOString())
    .order("due_at", { ascending: true })
    .returns<RawFollowUp[]>();
  if (error) throw error;

  const rows = data ?? [];
  const names = await resolveUserNames(supabase, [
    ...rows.map((r) => r.assigned_by),
    ...rows.map((r) => r.assign_to),
    ...rows.map((r) => r.candidate?.created_by ?? null),
  ]);
  const cutoffMs = endOfTodayIstUtc().getTime();
  return rows.map((r) => toFollowUpRow(r, names, cutoffMs));
}

export type CreateFollowUpInput = {
  applicationId: string;
  dueAt: string;
  assignTo: string;
  assignedBy: string;
  note?: string | null;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
};

export async function createFollowUp(
  supabase: SupabaseClient<Database>,
  input: CreateFollowUpInput
): Promise<FollowUpRow | { error: "application_not_found" }> {
  const { data: application, error: appErr } = await supabase
    .from("applications")
    .select("id, candidate_id")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (appErr) throw appErr;
  if (!application) return { error: "application_not_found" };

  const { data: inserted, error: insertErr } = await supabase
    .from("follow_ups")
    .insert({
      application_id: input.applicationId,
      candidate_id: application.candidate_id,
      due_at: input.dueAt,
      assign_to: input.assignTo,
      assigned_by: input.assignedBy,
      note: input.note?.trim() || null,
      is_recurring: input.isRecurring ?? false,
      recurrence_rule: input.recurrenceRule?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertErr) throw insertErr;

  const cutoffMs = endOfTodayIstUtc().getTime();
  const { data, error } = await supabase
    .from("follow_ups")
    .select(FOLLOWUP_SELECT)
    .eq("id", inserted.id)
    .single<RawFollowUp>();
  if (error) throw error;
  const names = await resolveUserNames(supabase, [data.assigned_by, data.assign_to, data.candidate?.created_by ?? null]);
  return toFollowUpRow(data, names, cutoffMs);
}

export type UpdateFollowUpInput = {
  status?: FollowUpStatus;
  assignTo?: string;
  dueAt?: string;
  note?: string | null;
};

export async function updateFollowUp(
  supabase: SupabaseClient<Database>,
  id: string,
  patch: UpdateFollowUpInput
): Promise<FollowUpRow | null> {
  const update: Database["public"]["Tables"]["follow_ups"]["Update"] = {};
  if (patch.status) {
    update.status = patch.status;
    // Completing/cancelling clears the "todo" state; re-opening a follow-up (status
    // set back to pending) clears completed_at again rather than leaving a stale
    // timestamp on an active row.
    update.completed_at = patch.status === "completed" ? new Date().toISOString() : null;
  }
  if (patch.assignTo) update.assign_to = patch.assignTo;
  if (patch.dueAt) update.due_at = patch.dueAt;
  if (patch.note !== undefined) update.note = patch.note?.trim() || null;

  if (Object.keys(update).length === 0) return null;

  const { data, error } = await supabase.from("follow_ups").update(update).eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const cutoffMs = endOfTodayIstUtc().getTime();
  const { data: full, error: fullErr } = await supabase
    .from("follow_ups")
    .select(FOLLOWUP_SELECT)
    .eq("id", id)
    .single<RawFollowUp>();
  if (fullErr) throw fullErr;
  const names = await resolveUserNames(supabase, [full.assigned_by, full.assign_to, full.candidate?.created_by ?? null]);
  return toFollowUpRow(full, names, cutoffMs);
}
