import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { escapeFilterValue, formatDisplayDateTime, phoneSearchPattern, type Pagination } from "@/lib/format";
import type { InteractionRow } from "@/lib/interactions.shared";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export type { InteractionRow } from "@/lib/interactions.shared";
export { PAGE_SIZES, DEFAULT_PAGE_SIZE } from "@/lib/interactions.shared";

// v_interactions already encodes the "candidates with >=1 call" filter and the
// max(call_time) "interacted on" computation (claude.md: query the view, don't
// reimplement its bucket logic in TypeScript — reaffirmed by Phase 5's own brief).
// Only uuid columns come back from the view; names are resolved via a second
// batched lookup, same as lib/allocations.ts.
const INTERACTIONS_COLUMNS = `
  candidate_id, application_id, name, phone, application_status,
  interacted_on, sourced_by, assigned_by, assign_to
`;

type RawInteraction = {
  candidate_id: string;
  application_id: string;
  name: string | null;
  phone: string | null;
  application_status: ApplicationStatus | null;
  interacted_on: string | null;
  sourced_by: string | null;
  assigned_by: string | null;
  assign_to: string | null;
};

export type InteractionListOptions = {
  search?: string;
  statuses?: ApplicationStatus[];
  interactedFrom?: string;
  interactedTo?: string;
  sort?: "name-asc" | "name-desc" | "interacted-new" | "interacted-old";
  pagination: Pagination;
};

function buildQuery(supabase: SupabaseClient<Database>, options: InteractionListOptions, countExact: boolean) {
  let query = supabase.from("v_interactions").select(INTERACTIONS_COLUMNS, countExact ? { count: "exact" } : undefined);

  if (options.search?.trim()) {
    const term = escapeFilterValue(options.search);
    const phonePattern = phoneSearchPattern(options.search);
    const clauses = [`name.ilike.%${term}%`];
    if (term) clauses.push(`phone.ilike.%${term}%`);
    if (phonePattern) clauses.push(`phone.ilike.${phonePattern}`);
    query = query.or(clauses.join(","));
  }
  if (options.statuses?.length) query = query.in("application_status", options.statuses);
  if (options.interactedFrom) query = query.gte("interacted_on", options.interactedFrom);
  if (options.interactedTo) query = query.lte("interacted_on", options.interactedTo);

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

function toInteractionRow(r: RawInteraction, names: Map<string, string>): InteractionRow {
  return {
    candidateId: r.candidate_id,
    applicationId: r.application_id,
    name: r.name ?? "",
    phone: r.phone ?? "",
    status: r.application_status,
    interactedOn: formatDisplayDateTime(r.interacted_on),
    interactedOnRaw: r.interacted_on,
    sourcedById: r.sourced_by,
    sourcedByName: r.sourced_by ? names.get(r.sourced_by) ?? null : null,
    assignedById: r.assigned_by,
    assignedByName: r.assigned_by ? names.get(r.assigned_by) ?? null : null,
    assignToId: r.assign_to,
    assignToName: r.assign_to ? names.get(r.assign_to) ?? null : null,
  };
}

export async function getInteractionRows(
  supabase: SupabaseClient<Database>,
  options: InteractionListOptions
): Promise<{ rows: InteractionRow[]; total: number }> {
  let query = buildQuery(supabase, options, true);

  const sort = options.sort ?? "interacted-new";
  if (sort === "name-asc") query = query.order("name", { ascending: true });
  else if (sort === "name-desc") query = query.order("name", { ascending: false });
  else query = query.order("interacted_on", { ascending: sort === "interacted-old", nullsFirst: false });

  const { data, error, count } = await query
    .range(options.pagination.from, options.pagination.to)
    .returns<RawInteraction[]>();
  if (error) throw error;

  const rows = data ?? [];
  const names = await resolveUserNames(supabase, [
    ...rows.map((r) => r.sourced_by),
    ...rows.map((r) => r.assigned_by),
    ...rows.map((r) => r.assign_to),
  ]);

  return { rows: rows.map((r) => toInteractionRow(r, names)), total: count ?? 0 };
}
