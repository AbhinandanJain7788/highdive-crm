import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { rangeOverflow, escapeFilterValue, formatDisplayDateTime, phoneSearchPattern, type Pagination } from "@/lib/format";
import type { CallRow, CallDetail, UnattributedCallRow, CallDirection, CallDisposition } from "@/lib/calls.shared";

export type { CallRow, CallDetail, UnattributedCallRow, CallDirection, CallDisposition } from "@/lib/calls.shared";
export { PAGE_SIZES, DEFAULT_PAGE_SIZE } from "@/lib/calls.shared";

// The CRM writes to `calls` only for `notes` and `application_id` (claude.md) —
// every other column belongs to the Android pipeline and is read-only here.
const CALL_SELECT = `
  id, candidate_id, number, direction_normalized, duration_seconds, disposition,
  call_time, notes, b2_url, storage_path, resolved_agent_id, application_id, callback_due_at,
  candidate:candidates(id, name, phone),
  agent:users(id, name),
  application:applications(id, job:jobs(id, title))
`;

type RawCall = {
  id: number;
  candidate_id: string | null;
  number: string | null;
  direction_normalized: CallDirection | null;
  duration_seconds: number | null;
  disposition: CallDisposition | null;
  call_time: string;
  notes: string | null;
  b2_url: string | null;
  storage_path: string | null;
  resolved_agent_id: string | null;
  application_id: string | null;
  callback_due_at: string | null;
  candidate: { id: string; name: string; phone: string | null } | null;
  agent: { id: string; name: string } | null;
  application: { id: string; job: { id: string; title: string } | null } | null;
};

function toCallRow(c: RawCall): CallRow {
  const durationSeconds = c.duration_seconds ?? 0;
  return {
    id: c.id,
    candidateId: c.candidate_id,
    candidateName: c.candidate?.name ?? "Unknown Caller",
    phone: c.candidate?.phone ?? c.number ?? "--",
    direction: c.direction_normalized,
    calledAt: formatDisplayDateTime(c.call_time),
    calledAtRaw: c.call_time,
    durationSeconds,
    // claude.md Open Question 1: Connected/Not Connected is derived from
    // duration_seconds > 0, never from `disposition` — kept as a separate axis.
    connected: durationSeconds > 0,
    disposition: c.disposition,
    byUserId: c.resolved_agent_id,
    byUserName: c.agent?.name ?? null,
    // A call with both b2_url and storage_path null has no recording (claude.md /
    // Open Question 3) — render the disabled state, never a broken player.
    hasRecording: Boolean(c.b2_url || c.storage_path),
    notes: c.notes,
    applicationId: c.application_id,
    jobTitle: c.application?.job?.title ?? null,
  };
}

function toCallDetail(c: RawCall): CallDetail {
  return {
    ...toCallRow(c),
    b2Url: c.b2_url,
    storagePath: c.storage_path,
    callbackDueAt: c.callback_due_at,
  };
}

export type CallListOptions = {
  search?: string;
  candidateId?: string;
  direction?: CallDirection;
  disposition?: CallDisposition;
  connected?: boolean;
  unattributedOnly?: boolean;
  userIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  sort?: "called-new" | "called-old" | "name-asc" | "name-desc";
  pagination: Pagination;
};

// Resolves candidate ids matching a search term via a direct lookup rather than a
// PostgREST embed filter — the established pattern for name/phone search across
// this codebase (see lib/allocations.ts) — so a search also catches calls whose raw
// `number` matches even when the candidate link itself is missing/ambiguous.
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

// Deliberately NOT async: a Supabase query builder is itself thenable, so an async
// function that `return`s one gets its return value adopted by Promise resolution
// (the query executes immediately and `await`ing the function yields the *result*,
// not a further-chainable builder) instead of being handed back as-is. The search
// lookup that needs `await` happens in the caller and its result is passed in.
function buildQuery(
  supabase: SupabaseClient<Database>,
  options: CallListOptions,
  searchCandidateIds: string[] | null,
  countExact: boolean
) {
  let query = supabase.from("calls").select(CALL_SELECT, countExact ? { count: "exact" } : undefined);

  if (options.candidateId) query = query.eq("candidate_id", options.candidateId);
  if (options.direction) query = query.eq("direction_normalized", options.direction);
  if (options.disposition) query = query.eq("disposition", options.disposition);
  if (options.unattributedOnly) query = query.is("application_id", null);
  if (options.userIds?.length) query = query.in("resolved_agent_id", options.userIds);
  if (options.dateFrom) query = query.gte("call_time", options.dateFrom);
  if (options.dateTo) query = query.lte("call_time", options.dateTo);

  if (options.search?.trim()) {
    const term = escapeFilterValue(options.search);
    const clauses = [`number.ilike.%${term}%`];
    if (searchCandidateIds?.length) clauses.push(`candidate_id.in.(${searchCandidateIds.join(",")})`);
    query = query.or(clauses.join(","));
  }

  // duration_seconds > 0 is the Connected/Not Connected axis (claude.md Open
  // Question 1) — filtered here, not re-derived downstream.
  if (options.connected === true) query = query.gt("duration_seconds", 0);
  else if (options.connected === false) query = query.or("duration_seconds.is.null,duration_seconds.eq.0");

  return query;
}

export async function getCallRows(
  supabase: SupabaseClient<Database>,
  options: CallListOptions
): Promise<{ rows: CallRow[]; total: number }> {
  const searchCandidateIds = options.search?.trim() ? await resolveSearchCandidateIds(supabase, options.search) : null;
  let query = buildQuery(supabase, options, searchCandidateIds, true);

  // call_time is what every metric/report/sort uses — never created_at
  // (claude.md's own rule, and Phase 5 Checkpoint 2).
  const sort = options.sort ?? "called-new";
  if (sort === "name-asc") query = query.order("name", { ascending: true, foreignTable: "candidate" });
  else if (sort === "name-desc") query = query.order("name", { ascending: false, foreignTable: "candidate" });
  else query = query.order("call_time", { ascending: sort === "called-old" });

  const { data, error, count } = await query
    .range(options.pagination.from, options.pagination.to)
    .returns<RawCall[]>();
  const overflow = rangeOverflow(error);
  if (overflow) return { rows: [], total: overflow.total };
  if (error) throw error;

  return { rows: (data ?? []).map(toCallRow), total: count ?? 0 };
}

export async function getCallById(supabase: SupabaseClient<Database>, id: number): Promise<CallDetail | null> {
  const { data, error } = await supabase.from("calls").select(CALL_SELECT).eq("id", id).maybeSingle<RawCall>();
  if (error) throw error;
  if (!data) return null;
  return toCallDetail(data);
}

// PATCH /api/calls/:id — notes only. Every other column belongs to the Android
// pipeline; enforced here (not just by the route's body-field filtering) by never
// accepting anything but `notes` in this function's own signature.
export async function updateCallNotes(
  supabase: SupabaseClient<Database>,
  id: number,
  notes: string | null
): Promise<CallDetail | null> {
  const { data, error } = await supabase.from("calls").update({ notes }).eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getCallById(supabase, id);
}

export async function getUnattributedCalls(
  supabase: SupabaseClient<Database>,
  options: { search?: string; pagination: Pagination }
): Promise<{ rows: UnattributedCallRow[]; total: number }> {
  const { rows, total } = await getCallRows(supabase, {
    search: options.search,
    unattributedOnly: true,
    sort: "called-new",
    pagination: options.pagination,
  });

  const candidateIds = [...new Set(rows.map((r) => r.candidateId).filter((id): id is string => Boolean(id)))];
  const jobsByCandidate = new Map<string, UnattributedCallRow["candidateJobs"]>();
  if (candidateIds.length) {
    const { data, error } = await supabase
      .from("applications")
      .select("id, candidate_id, job_id, job:jobs(id, title)")
      .in("candidate_id", candidateIds);
    if (error) throw error;
    for (const a of data ?? []) {
      const list = jobsByCandidate.get(a.candidate_id) ?? [];
      if (a.job) list.push({ applicationId: a.id, jobId: a.job.id, jobTitle: a.job.title });
      jobsByCandidate.set(a.candidate_id, list);
    }
  }

  return {
    rows: rows.map((r) => ({ ...r, candidateJobs: (r.candidateId && jobsByCandidate.get(r.candidateId)) || [] })),
    total,
  };
}

// POST /api/calls/:id/attribute — links a call to one of the candidate's own real
// applications. Never accepts an arbitrary job/application unless it actually
// belongs to the call's candidate, and never overwrites an already-attributed call
// (the auto-resolution trigger owns that; this only fills a genuinely null slot).
export async function attributeCall(
  supabase: SupabaseClient<Database>,
  callId: number,
  applicationId: string
): Promise<{ ok: true } | { ok: false; reason: "call_not_found" | "no_candidate" | "application_mismatch" }> {
  const { data: call, error: callErr } = await supabase
    .from("calls")
    .select("id, candidate_id, application_id")
    .eq("id", callId)
    .maybeSingle();
  if (callErr) throw callErr;
  if (!call) return { ok: false, reason: "call_not_found" };
  if (!call.candidate_id) return { ok: false, reason: "no_candidate" };

  const { data: application, error: appErr } = await supabase
    .from("applications")
    .select("id, candidate_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (appErr) throw appErr;
  if (!application || application.candidate_id !== call.candidate_id) {
    return { ok: false, reason: "application_mismatch" };
  }

  const { error: updateErr } = await supabase
    .from("calls")
    .update({ application_id: applicationId })
    .eq("id", callId)
    .is("application_id", null);
  if (updateErr) throw updateErr;

  return { ok: true };
}
