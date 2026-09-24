import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import { rangeOverflow, escapeFilterValue, formatDisplayDateTime, phoneSearchPattern, type Pagination } from "@/lib/format";
import type { CallRow, CallDetail, UnattributedCallRow, CallDirection, CallDisposition } from "@/lib/calls.shared";

export type { CallRow, CallDetail, UnattributedCallRow, CallDirection, CallDisposition } from "@/lib/calls.shared";
export { PAGE_SIZES, DEFAULT_PAGE_SIZE } from "@/lib/calls.shared";

// The CRM writes to `calls` only for `notes` and `application_id` (claude.md) —
// every other column belongs to the Android pipeline and is read-only here.
const CALL_SELECT = `
  id, candidate_id, number, direction_normalized, duration_seconds, disposition,
  call_time, notes, b2_url, storage_path, resolved_agent_id, application_id, callback_due_at,
  next_action_type, next_action_at, next_action_note,
  candidate:candidates(id, name, phone),
  agent:users(id, name),
  application:applications(id, job:jobs(id, title, client_id))
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
  next_action_type: string | null;
  next_action_at: string | null;
  next_action_note: string | null;
  candidate: { id: string; name: string; phone: string | null } | null;
  agent: { id: string; name: string } | null;
  application: { id: string; job: { id: string; title: string; client_id: string } | null } | null;
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
    connected: durationSeconds > 0,
    disposition: c.disposition,
    byUserId: c.resolved_agent_id,
    byUserName: c.agent?.name ?? null,
    hasRecording: Boolean(c.b2_url || c.storage_path),
    notes: c.notes,
    applicationId: c.application_id,
    jobTitle: c.application?.job?.title ?? null,
    nextActionType: (c.next_action_type as CallRow["nextActionType"]) ?? null,
    nextActionAt: c.next_action_at ?? null,
    nextActionNote: c.next_action_note ?? null,
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

// Keeps only the last N digits of a phone string, so "+91 98201 34567" and
// "918201234567"/"8201234567" all reduce to the same comparison key regardless
// of country-code prefix or the seed's display spacing.
function lastDigits(value: string, n = 10): string {
  return value.replace(/\D/g, "").slice(-n);
}

// The Android pipeline leaves `candidate_id` null whenever its own number match
// failed (claude.md's boundary means this codebase can't fix that matching or
// write the link back) — but this is a pure read-time lookup against
// `candidates.phone` to show the right name instead of "Unknown Caller". It never
// writes to `calls`, never sets `candidate_id`, and never touches the pipeline.
async function resolveNamesByNumber(
  supabase: SupabaseClient<Database>,
  numbers: string[]
): Promise<Map<string, string>> {
  const targets = [...new Set(numbers.map((n) => lastDigits(n)).filter((d) => d.length >= 7))];
  if (!targets.length) return new Map();

  const patterns = targets.map((d) => `phone.ilike.%${d.split("").join("%")}%`);
  const { data, error } = await supabase.from("candidates").select("name, phone").or(patterns.join(","));
  if (error || !data) return new Map();

  const nameByDigits = new Map<string, string>();
  for (const c of data) {
    if (!c.phone) continue;
    const digits = lastDigits(c.phone);
    if (!nameByDigits.has(digits)) nameByDigits.set(digits, c.name);
  }

  const result = new Map<string, string>();
  for (const number of numbers) {
    const name = nameByDigits.get(lastDigits(number));
    if (name) result.set(number, name);
  }
  return result;
}

async function applyNameFallback(supabase: SupabaseClient<Database>, rows: CallRow[]): Promise<void> {
  const unresolved = rows.filter((r) => !r.candidateId && r.phone && r.phone !== "--");
  if (!unresolved.length) return;
  const nameByNumber = await resolveNamesByNumber(supabase, unresolved.map((r) => r.phone));
  for (const r of unresolved) {
    const name = nameByNumber.get(r.phone);
    if (name) r.candidateName = name;
  }
}

// The Android app uploads every recording straight to this public Storage bucket,
// but doesn't reliably write `calls.storage_path`/`b2_url` back onto the row it
// already inserted — confirmed against the live bucket, where uploaded files exist
// for calls whose `storage_path` is still null. This resolves the display URL by
// nearest recording time instead, purely at read time: it never writes storage_path
// back onto `calls`.
const RECORDING_BUCKET = "call-recordings";
const RECORDING_FOLDER = "recordings";
// Filenames are "recording_<epoch-ms>.wav" — that embedded timestamp tracks the
// call's own call_time far more tightly (~3-25s, checked against the live table)
// than the object's storage `created_at` (upload time, which drifts 20-95s behind
// depending on upload delay) — so the filename, not the metadata, is the key.
const RECORDING_FILENAME_RE = /recording_(\d+)\.\w+$/;
const RECORDING_MATCH_WINDOW_MS = 30_000;

type RecordingObject = { path: string; recordedAtMs: number };

let recordingObjectsCache: { at: number; objects: RecordingObject[] } | null = null;

async function listRecordingObjects(): Promise<RecordingObject[]> {
  if (recordingObjectsCache && Date.now() - recordingObjectsCache.at < 30_000) {
    return recordingObjectsCache.objects;
  }
  // storage.objects has no SELECT policy for the signed-in (anon-key) role, only
  // the Android app's own authenticated INSERT — listing needs the admin client
  // even though the bucket itself is public (public only makes the object payload
  // fetchable by URL, not its metadata listable via the API).
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(RECORDING_BUCKET)
    .list(RECORDING_FOLDER, { limit: 500, sortBy: { column: "created_at", order: "desc" } });
  if (error || !data) return recordingObjectsCache?.objects ?? [];

  const objects: RecordingObject[] = [];
  for (const o of data) {
    const match = RECORDING_FILENAME_RE.exec(o.name);
    if (!match) continue;
    objects.push({ path: `${RECORDING_FOLDER}/${o.name}`, recordedAtMs: Number(match[1]) });
  }
  recordingObjectsCache = { at: Date.now(), objects };
  return objects;
}

// Nearest-by-time, one object per call: each call claims its closest upload within
// the window, closest match first, so two calls a few seconds apart can't both grab
// the same file.
async function matchRecordingPaths(calls: { id: number; callTime: string }[]): Promise<Map<number, string>> {
  const objects = await listRecordingObjects();
  if (!objects.length) return new Map();

  const candidates = calls
    .map((c) => {
      const callMs = new Date(c.callTime).getTime();
      if (!Number.isFinite(callMs)) return null;
      let best: { path: string; diff: number } | null = null;
      for (const o of objects) {
        const diff = Math.abs(o.recordedAtMs - callMs);
        if (diff <= RECORDING_MATCH_WINDOW_MS && (!best || diff < best.diff)) best = { path: o.path, diff };
      }
      return best ? { id: c.id, path: best.path, diff: best.diff } : null;
    })
    .filter((x): x is { id: number; path: string; diff: number } => x !== null)
    .sort((a, b) => a.diff - b.diff);

  const claimed = new Set<string>();
  const result = new Map<number, string>();
  for (const c of candidates) {
    if (claimed.has(c.path)) continue;
    claimed.add(c.path);
    result.set(c.id, c.path);
  }
  return result;
}

async function applyRecordingFallback(rows: CallRow[]): Promise<void> {
  const missing = rows.filter((r) => !r.hasRecording);
  if (!missing.length) return;
  const matches = await matchRecordingPaths(missing.map((r) => ({ id: r.id, callTime: r.calledAtRaw })));
  for (const r of missing) {
    if (matches.has(r.id)) r.hasRecording = true;
  }
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

  const rows = (data ?? []).map(toCallRow);
  await applyNameFallback(supabase, rows);
  await applyRecordingFallback(rows);
  return { rows, total: count ?? 0 };
}

export async function getCallById(supabase: SupabaseClient<Database>, id: number): Promise<CallDetail | null> {
  const { data, error } = await supabase.from("calls").select(CALL_SELECT).eq("id", id).maybeSingle<RawCall>();
  if (error) throw error;
  if (!data) return null;
  const detail = toCallDetail(data);
  await applyNameFallback(supabase, [detail]);

  if (!detail.hasRecording) {
    const matches = await matchRecordingPaths([{ id: detail.id, callTime: detail.calledAtRaw }]);
    const path = matches.get(detail.id);
    if (path) {
      detail.hasRecording = true;
      detail.storagePath = path;
      detail.b2Url = supabase.storage.from(RECORDING_BUCKET).getPublicUrl(path).data.publicUrl;
    }
  }

  return detail;
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

// Completes a pending next_action on a call: creates a follow-up or interview
// in CRM, then clears the action fields on the call row.
export type CompleteCallActionInput =
  | { type: "follow_up"; dueAt: string; note?: string | null; assignTo: string; assignedBy: string }
  | { type: "interview_scheduled"; scheduledAt: string; note?: string | null; interviewerId?: string | null; location?: string | null };

export type CompleteCallActionResult =
  | { kind: "follow_up_created"; followUpId: string }
  | { kind: "interview_created"; interviewId: string }
  | { error: "call_not_found" | "no_application" | "application_not_found" | "no_candidate" | "action_not_pending" };

export async function completeCallAction(
  supabase: SupabaseClient<Database>,
  callId: number,
  input: CompleteCallActionInput,
  actorId: string
): Promise<CompleteCallActionResult> {
  const { data: call, error: callErr } = await supabase
    .from("calls")
    .select("id, candidate_id, application_id, next_action_type, next_action_at, next_action_note, application:applications(id, job:jobs(id, client_id, title))")
    .eq("id", callId)
    .maybeSingle();
  if (callErr) throw callErr;
  if (!call) return { error: "call_not_found" };
  if (!call.next_action_type || !call.next_action_at) return { error: "action_not_pending" };
  if (!call.candidate_id) return { error: "no_candidate" };
  if (!call.application_id) return { error: "no_application" };

  const { data: app, error: appErr } = await supabase
    .from("applications")
    .select("id, candidate_id")
    .eq("id", call.application_id)
    .maybeSingle();
  if (appErr) throw appErr;
  if (!app || app.candidate_id !== call.candidate_id) return { error: "application_not_found" };

  const dueAtIso = new Date(input.type === "follow_up" ? input.dueAt : input.scheduledAt).toISOString();

  if (input.type === "follow_up") {
    const { data: fu, error: fuErr } = await supabase
      .from("follow_ups")
      .insert({
        application_id: call.application_id,
        candidate_id: call.candidate_id,
        due_at: dueAtIso,
        assign_to: input.assignTo,
        assigned_by: input.assignedBy,
        note: input.note?.trim() || null,
        status: "pending",
        is_recurring: false,
      })
      .select("id")
      .single();
    if (fuErr) throw fuErr;
    if (!fu) return { error: "application_not_found" };

    await supabase
      .from("calls")
      .update({ next_action_type: null, next_action_at: null, next_action_note: null })
      .eq("id", callId);

    return { kind: "follow_up_created", followUpId: fu.id };
  }

  // interview_scheduled
  const clientId = call.application?.job?.client_id;
  if (!clientId) return { error: "application_not_found" };

  const { data: iv, error: ivErr } = await supabase
    .from("interviews")
    .insert({
      application_id: call.application_id,
      candidate_id: call.candidate_id,
      client_id: clientId,
      scheduled_at: dueAtIso,
      interviewer_id: input.interviewerId ?? null,
      location: input.location?.trim() || null,
      note: input.note?.trim() || null,
      status: "scheduled",
      duration_minutes: 60,
      scheduled_by: actorId,
    })
    .select("id")
    .single();
  if (ivErr) throw ivErr;
  if (!iv) return { error: "application_not_found" };

  await supabase
    .from("calls")
    .update({ next_action_type: null, next_action_at: null, next_action_note: null })
    .eq("id", callId);

  return { kind: "interview_created", interviewId: iv.id };
}
