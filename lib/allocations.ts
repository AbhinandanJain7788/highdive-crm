import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { rangeOverflow, escapeFilterValue, formatDisplayDate, phoneSearchPattern, type Pagination } from "@/lib/format";
import type { AllocationRow, AllocationBucket } from "@/lib/allocations.shared";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

// v_allocations already encodes the bucket logic (new = no assigned_recruiter_id,
// attempted = has a recruiter and >=1 call, excluding selected/rejected/joined) —
// claude.md: "query the view, do not reimplement the filter in application code."
// The view only carries uuids for created_by/sourced_by/assign_to; names are
// resolved with a second batched lookup below rather than an embed, since embedding
// through a view's constraint hints (two columns sharing one FK name) is unreliable
// via PostgREST.
export type { AllocationRow, AllocationBucket } from "@/lib/allocations.shared";

export type AllocationListOptions = {
  bucket: AllocationBucket;
  search?: string;
  statuses?: ApplicationStatus[];
  createdFrom?: string;
  createdTo?: string;
  // "Common Pool" (unassigned-only) vs "Selected Users" (no extra scoping) — mirrors
  // the UserScopeDropdown semantics already built for Candidates/Allocations.
  pool?: boolean;
  // Real per-recruiter narrowing for the "Selected Users" scope — previously the
  // dropdown's "Selected Users" option applied no filtering at all (Phase 9 finding).
  // Ignored when `pool` is true (Common Pool is defined as assign_to IS NULL, which
  // this would never match anyway).
  assignToIds?: string[];
  sort?: "name-asc" | "name-desc" | "created-new" | "created-old";
  pagination: Pagination;
};

type RawAllocation = {
  application_id: string | null;
  candidate_id: string | null;
  name: string | null;
  phone: string | null;
  application_status: ApplicationStatus | null;
  job_id: string | null;
  job_title: string | null;
  created_on: string | null;
  created_by: string | null;
  assign_to: string | null;
  sourced_by: string | null;
};

const ALLOCATION_COLUMNS = `
  application_id, candidate_id, name, phone, application_status,
  job_id, job_title, created_on, created_by, assign_to, sourced_by
`;

function buildQuery(
  supabase: SupabaseClient<Database>,
  options: AllocationListOptions,
  countExact: boolean
) {
  let query = supabase
    .from("v_allocations")
    .select(ALLOCATION_COLUMNS, countExact ? { count: "exact" } : undefined)
    .eq("bucket", options.bucket);

  if (options.search?.trim()) {
    const term = escapeFilterValue(options.search);
    const phonePattern = phoneSearchPattern(options.search);
    const clauses = [`name.ilike.%${term}%`];
    if (term) clauses.push(`phone.ilike.%${term}%`);
    if (phonePattern) clauses.push(`phone.ilike.${phonePattern}`);
    query = query.or(clauses.join(","));
  }
  if (options.statuses?.length) query = query.in("application_status", options.statuses);
  if (options.createdFrom) query = query.gte("created_on", options.createdFrom);
  if (options.createdTo) query = query.lte("created_on", options.createdTo);
  if (options.pool) query = query.is("assign_to", null);
  else if (options.assignToIds?.length) query = query.in("assign_to", options.assignToIds);

  return query;
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

function toAllocationRow(a: RawAllocation, names: Map<string, string>): AllocationRow {
  return {
    applicationId: a.application_id ?? "",
    candidateId: a.candidate_id ?? "",
    name: a.name ?? "",
    phone: a.phone ?? "",
    status: a.application_status,
    jobId: a.job_id,
    jobTitle: a.job_title,
    createdOn: formatDisplayDate(a.created_on),
    createdAt: a.created_on ?? "",
    createdById: a.created_by,
    createdByName: a.created_by ? names.get(a.created_by) ?? null : null,
    assignToId: a.assign_to,
    assignToName: a.assign_to ? names.get(a.assign_to) ?? null : null,
    sourcedById: a.sourced_by,
    sourcedByName: a.sourced_by ? names.get(a.sourced_by) ?? null : null,
  };
}

export async function getAllocationRows(
  supabase: SupabaseClient<Database>,
  options: AllocationListOptions
): Promise<{ rows: AllocationRow[]; total: number }> {
  let query = buildQuery(supabase, options, true);

  const sort = options.sort ?? "created-new";
  if (sort === "name-asc") query = query.order("name", { ascending: true });
  else if (sort === "name-desc") query = query.order("name", { ascending: false });
  else query = query.order("created_on", { ascending: sort === "created-old" });

  const { data, error, count } = await query
    .range(options.pagination.from, options.pagination.to)
    .returns<RawAllocation[]>();
  const overflow = rangeOverflow(error);
  if (overflow) return { rows: [], total: overflow.total };
  if (error) throw error;

  const rows = data ?? [];
  const names = await resolveUserNames(supabase, [
    ...rows.map((r) => r.created_by),
    ...rows.map((r) => r.assign_to),
    ...rows.map((r) => r.sourced_by),
  ]);

  return { rows: rows.map((r) => toAllocationRow(r, names)), total: count ?? 0 };
}

// Tab counts read the same filters as the list (search/date/status/scope) minus the
// bucket itself, so switching tabs never changes what a filter narrowed down to.
export async function getAllocationBucketCounts(
  supabase: SupabaseClient<Database>,
  options: Omit<AllocationListOptions, "bucket" | "pagination" | "sort">
): Promise<{ new: number; attempted: number }> {
  const [newCount, attemptedCount] = await Promise.all([
    buildQuery(supabase, { ...options, bucket: "new", pagination: { page: 1, pageSize: 1, from: 0, to: 0 } }, true)
      .range(0, 0)
      .returns<RawAllocation[]>(),
    buildQuery(
      supabase,
      { ...options, bucket: "attempted", pagination: { page: 1, pageSize: 1, from: 0, to: 0 } },
      true
    )
      .range(0, 0)
      .returns<RawAllocation[]>(),
  ]);
  if (newCount.error) throw newCount.error;
  if (attemptedCount.error) throw attemptedCount.error;
  return { new: newCount.count ?? 0, attempted: attemptedCount.count ?? 0 };
}
