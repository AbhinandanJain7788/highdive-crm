import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { escapeFilterValue, formatDisplayDate, phoneSearchPattern } from "@/lib/format";
import { reassign } from "@/lib/assignment";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export const MAX_EXPORT_ROWS = 20_000;

export type BulkExportFilters = {
  search?: string;
  statuses?: ApplicationStatus[];
  createdFrom?: string;
  createdTo?: string;
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// POST /api/data/bulk-export — CSV text, row count matches the applied filters
// exactly because it's the same query shape candidates.ts's list uses, just
// unpaginated up to MAX_EXPORT_ROWS.
export async function buildCandidateExportCsv(
  supabase: SupabaseClient<Database>,
  filters: BulkExportFilters
): Promise<{ csv: string; rowCount: number }> {
  const needsInnerJoin = Boolean(filters.statuses?.length);
  const select = `id, name, phone, email, source, notes, is_duplicate, created_at, applications${needsInnerJoin ? "!inner" : ""}(status, created_at, job:jobs(title), recruiter:users!applications_assigned_recruiter_id_fkey(name))`;

  let query = supabase.from("candidates").select(select, { count: "exact" });
  if (filters.search?.trim()) {
    const term = escapeFilterValue(filters.search);
    const phonePattern = phoneSearchPattern(filters.search);
    const clauses = [`name.ilike.%${term}%`];
    if (term) clauses.push(`phone.ilike.%${term}%`);
    if (phonePattern) clauses.push(`phone.ilike.${phonePattern}`);
    query = query.or(clauses.join(","));
  }
  if (filters.statuses?.length) query = query.in("applications.status", filters.statuses);
  if (filters.createdFrom) query = query.gte("created_at", filters.createdFrom);
  if (filters.createdTo) query = query.lte("created_at", filters.createdTo);

  type Row = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    source: string | null;
    notes: string | null;
    is_duplicate: boolean;
    created_at: string;
    applications: { status: ApplicationStatus; created_at: string; job: { title: string } | null; recruiter: { name: string } | null }[] | null;
  };

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(MAX_EXPORT_ROWS)
    .returns<Row[]>();
  if (error) throw error;

  const rows = data ?? [];
  const header = ["Name", "Phone", "Email", "Source", "Status", "Applied For", "Assigned Recruiter", "Duplicate", "Created On"];
  const lines = [header.join(",")];
  for (const c of rows) {
    const apps = [...(c.applications ?? [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const app = apps[0] ?? null;
    lines.push(
      [
        c.name,
        c.phone ?? "",
        c.email ?? "",
        c.source ?? "",
        app?.status ?? "",
        app?.job?.title ?? "",
        app?.recruiter?.name ?? "",
        c.is_duplicate ? "Yes" : "No",
        formatDisplayDate(c.created_at),
      ]
        .map((v) => csvEscape(String(v)))
        .join(",")
    );
  }

  return { csv: lines.join("\n"), rowCount: rows.length };
}

// POST /api/data/bulk-delete — soft-delete only (claude.md: never hard-delete
// candidates). Writes `deleted_at` (migration 0029, applied 2026-09-04). Candidate
// list/detail reads (lib/candidates.ts) filter `deleted_at is null`, so a soft-
// deleted row disappears from those screens immediately while staying in the DB.
export async function softDeleteCandidates(
  supabase: SupabaseClient<Database>,
  candidateIds: string[]
): Promise<{ deleted: number }> {
  if (candidateIds.length === 0) return { deleted: 0 };
  const { error, count } = await supabase
    .from("candidates")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .in("id", candidateIds)
    .is("deleted_at", null);
  if (error) {
    const err = new Error(error.message) as Error & { code?: string };
    err.code = error.code;
    throw err;
  }
  return { deleted: count ?? 0 };
}

// POST /api/data/transfer — moves every candidate a user currently owns (their
// active assignments) to another user, in one call. Each application goes through
// the same reassign() path Assignment uses (flip old row to 'reassigned', insert a
// fresh active one), so per-application history still survives.
export async function transferOwnership(
  supabase: SupabaseClient<Database>,
  params: { fromUserId: string; toUserId: string; performedBy: string }
): Promise<{ transferred: number; skipped: number }> {
  const { data: activeAssignments, error } = await supabase
    .from("assignments")
    .select("application_id")
    .eq("recruiter_id", params.fromUserId)
    .eq("status", "active")
    .returns<{ application_id: string }[]>();
  if (error) throw error;

  let transferred = 0;
  let skipped = 0;
  for (const a of activeAssignments ?? []) {
    const result = await reassign(supabase, {
      applicationId: a.application_id,
      recruiterId: params.toUserId,
      assignedBy: params.performedBy,
    });
    if (result.ok) transferred += 1;
    else skipped += 1;
  }

  await supabase.from("activity_logs").insert({
    actor_id: params.performedBy,
    action: "data_transfer",
    entity_type: "user",
    entity_id: params.fromUserId,
    metadata: { toUserId: params.toUserId, transferred, skipped },
  });

  return { transferred, skipped };
}
