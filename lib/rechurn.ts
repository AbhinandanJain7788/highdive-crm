import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { closeActiveAssignment, reassign } from "@/lib/assignment";
import { RECHURN_ELIGIBLE_STATUSES, type RechurnFilters, type RechurnMatch } from "@/lib/rechurn.shared";

export type { RechurnFilters, RechurnMatch, RechurnDateBasis, ApplicationStatus } from "@/lib/rechurn.shared";
export { RECHURN_ELIGIBLE_STATUSES } from "@/lib/rechurn.shared";

type RawRechurn = {
  application_id: string | null;
  candidate_id: string | null;
  name: string | null;
  phone: string | null;
  application_status: Database["public"]["Enums"]["application_status"] | null;
  assigned_recruiter_id: string | null;
  created_at: string | null;
  last_interaction_at: string | null;
};

// v_rechurn (claude.md: "query the view, don't reimplement its filter in application
// code") already excludes soft-deleted candidates (Phase 4's As-Built Notes: the view
// was patched with `deleted_at is null` alongside v_allocations/v_interactions) and
// returns every application regardless of status — the eligibility narrowing
// (RECHURN_ELIGIBLE_STATUSES) and the date-basis filter both happen here, matching
// what the source prototype's own getRechurnCount actually computed.
export async function getRechurnMatches(
  supabase: SupabaseClient<Database>,
  filters: RechurnFilters
): Promise<RechurnMatch[]> {
  let query = supabase
    .from("v_rechurn")
    .select("application_id, candidate_id, name, phone, application_status, assigned_recruiter_id, created_at, last_interaction_at")
    .in("application_status", RECHURN_ELIGIBLE_STATUSES);

  if (filters.status) query = query.eq("application_status", filters.status);

  const dateColumn = filters.dateBasis === "last_interaction" ? "last_interaction_at" : "created_at";
  if (filters.dateFrom) query = query.gte(dateColumn, filters.dateFrom);
  if (filters.dateTo) query = query.lte(dateColumn, filters.dateTo);

  const { data, error } = await query.returns<RawRechurn[]>();
  if (error) throw error;

  return (data ?? [])
    .filter((r): r is RawRechurn & { application_id: string; candidate_id: string } => Boolean(r.application_id && r.candidate_id))
    .map((r) => ({
      applicationId: r.application_id,
      candidateId: r.candidate_id,
      name: r.name ?? "",
      phone: r.phone ?? "",
      currentRecruiterId: r.assigned_recruiter_id,
    }));
}

export type InitiateResult = { matched: number; updated: number; skipped: { applicationId: string; reason: string }[] };

// "Assign in Common Pool" closes each matched application's active assignment (if any)
// without opening a new one — reuses lib/assignment.ts's closeActiveAssignment, the
// same closing path reassign() itself uses, per claude.md Phase 6's explicit
// instruction not to hand-roll a second one. The application's assigned_recruiter_id
// ends up null, so it reappears in Allocations' "New" bucket (v_allocations' own
// definition of that bucket).
export async function initiateCommonPool(
  supabase: SupabaseClient<Database>,
  matches: RechurnMatch[]
): Promise<InitiateResult> {
  let updated = 0;
  const skipped: InitiateResult["skipped"] = [];
  for (const m of matches) {
    const result = await closeActiveAssignment(supabase, m.applicationId);
    if (result.ok) updated += 1;
    else skipped.push({ applicationId: m.applicationId, reason: result.message });
  }
  return { matched: matches.length, updated, skipped };
}

// "Change owner to Specific Users" goes through lib/assignment.ts's existing
// reassign() — the same helper Assignment's own reassign flow uses — rather than a
// second reassignment code path, per claude.md Phase 6's explicit instruction.
export async function initiateSpecificOwner(
  supabase: SupabaseClient<Database>,
  matches: RechurnMatch[],
  recruiterId: string,
  assignedBy: string
): Promise<InitiateResult> {
  let updated = 0;
  const skipped: InitiateResult["skipped"] = [];
  for (const m of matches) {
    const result = await reassign(supabase, { applicationId: m.applicationId, recruiterId, assignedBy });
    if (result.ok) updated += 1;
    else skipped.push({ applicationId: m.applicationId, reason: result.message });
  }
  return { matched: matches.length, updated, skipped };
}
