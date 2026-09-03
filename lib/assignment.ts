import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { recruiterRoleFilter } from "@/lib/recruiters";

type AssignMethod = Database["public"]["Enums"]["assign_method"];

export type UnassignedApplication = {
  applicationId: string;
  candidateId: string;
  name: string;
  phone: string;
  jobId: string | null;
  jobTitle: string | null;
};

export type WorkloadRow = { recruiterId: string; name: string; assignedCount: number; pct: string };

export type DistributeResult = {
  assigned: { applicationId: string; recruiterId: string; recruiterName: string }[];
  // An application already claimed by a concurrent request (or by someone else
  // between page load and click) is reported, never silently overwritten — the
  // partial unique index on assignments(application_id) WHERE status='active' is
  // what actually prevents the double-assign; this just surfaces the conflict.
  skipped: { applicationId: string; reason: string }[];
};

const UNASSIGNED_SELECT = `
  id, candidate_id, job_id,
  candidate:candidates(id, name, phone),
  job:jobs(id, title)
`;

type RawUnassigned = {
  id: string;
  candidate_id: string;
  job_id: string;
  candidate: { id: string; name: string; phone: string | null } | null;
  job: { id: string; title: string } | null;
};

// The pool auto-distribution and the Assignment screen's list both draw from:
// applications with no current recruiter. Mirrors v_allocations' "new" bucket
// definition without re-deriving it — this just needs application ids, not the
// view's created-by/sourced-by resolution.
export async function getUnassignedApplications(
  supabase: SupabaseClient<Database>,
  applicationIds?: string[]
): Promise<UnassignedApplication[]> {
  let query = supabase.from("applications").select(UNASSIGNED_SELECT).is("assigned_recruiter_id", null);
  if (applicationIds?.length) query = query.in("id", applicationIds);

  const { data, error } = await query.order("created_at", { ascending: true }).returns<RawUnassigned[]>();
  if (error) throw error;

  return (data ?? [])
    .filter((a) => a.candidate)
    .map((a) => ({
      applicationId: a.id,
      candidateId: a.candidate!.id,
      name: a.candidate!.name,
      phone: a.candidate!.phone ?? "",
      jobId: a.job?.id ?? null,
      jobTitle: a.job?.title ?? null,
    }));
}

// Active recruiters only — an inactive/invited user never receives an auto-distributed
// application (Phase 4 checkpoint). Ordered by name so round robin is deterministic.
async function getActiveRecruiterPool(
  supabase: SupabaseClient<Database>
): Promise<{ id: string; name: string }[]> {
  const adminRoleIds = await recruiterRoleFilter(supabase);

  let query = supabase.from("users").select("id, name, role_id").eq("status", "active");
  if (adminRoleIds.length) query = query.or(`role_id.is.null,role_id.not.in.(${adminRoleIds.join(",")})`);

  const { data, error } = await query.order("name", { ascending: true }).returns<{ id: string; name: string }[]>();
  if (error) throw error;
  return data ?? [];
}

async function getActiveAssignmentCounts(
  supabase: SupabaseClient<Database>,
  recruiterIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (recruiterIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("assignments")
    .select("recruiter_id")
    .eq("status", "active")
    .in("recruiter_id", recruiterIds)
    .returns<{ recruiter_id: string }[]>();
  if (error) throw error;

  for (const row of data ?? []) counts.set(row.recruiter_id, (counts.get(row.recruiter_id) ?? 0) + 1);
  return counts;
}

export async function getWorkload(supabase: SupabaseClient<Database>): Promise<WorkloadRow[]> {
  const pool = await getActiveRecruiterPool(supabase);
  const counts = await getActiveAssignmentCounts(supabase, pool.map((r) => r.id));
  const maxCount = Math.max(1, ...pool.map((r) => counts.get(r.id) ?? 0));

  return pool.map((r) => {
    const assignedCount = counts.get(r.id) ?? 0;
    return {
      recruiterId: r.id,
      name: r.name,
      assignedCount,
      pct: `${Math.max(4, Math.round((assignedCount / maxCount) * 100))}%`,
    };
  });
}

// Inserts one active assignment row. Never pre-checks for an existing active row and
// then inserts — that's a TOCTOU race under concurrent requests. Instead it always
// attempts the insert and lets the partial unique index (assignments.application_id
// WHERE status='active') reject a genuine double-assign with Postgres 23505, which
// the caller reports as "skipped", not a crash.
async function insertAssignment(
  supabase: SupabaseClient<Database>,
  params: { applicationId: string; recruiterId: string; assignedBy: string; method: AssignMethod }
): Promise<{ ok: true } | { ok: false; conflict: boolean; message: string }> {
  const { error } = await supabase.from("assignments").insert({
    application_id: params.applicationId,
    recruiter_id: params.recruiterId,
    assigned_by: params.assignedBy,
    method: params.method,
    status: "active",
  });
  if (!error) {
    // Keep the denormalized column applications.assigned_recruiter_id in sync — it's
    // what the Candidates list reads for "Assigned Recruiter" without a second join.
    await supabase.from("applications").update({ assigned_recruiter_id: params.recruiterId }).eq("id", params.applicationId);
    return { ok: true };
  }
  const conflict = error.code === "23505";
  return { ok: false, conflict, message: conflict ? "Already assigned." : error.message };
}

async function runDistribution(
  supabase: SupabaseClient<Database>,
  applications: UnassignedApplication[],
  pickRecruiter: (index: number) => { id: string; name: string },
  assignedBy: string,
  method: AssignMethod
): Promise<DistributeResult> {
  const assigned: DistributeResult["assigned"] = [];
  const skipped: DistributeResult["skipped"] = [];

  // Sequential, not Promise.all — round robin/load-balanced order must follow the
  // list order, and each insert already carries its own conflict handling.
  for (let i = 0; i < applications.length; i++) {
    const app = applications[i];
    const recruiter = pickRecruiter(i);
    const result = await insertAssignment(supabase, {
      applicationId: app.applicationId,
      recruiterId: recruiter.id,
      assignedBy,
      method,
    });
    if (result.ok) assigned.push({ applicationId: app.applicationId, recruiterId: recruiter.id, recruiterName: recruiter.name });
    else skipped.push({ applicationId: app.applicationId, reason: result.message });
  }

  return { assigned, skipped };
}

export async function autoDistribute(
  supabase: SupabaseClient<Database>,
  params: { applicationIds: string[]; method: "round_robin" | "load_balanced"; assignedBy: string }
): Promise<DistributeResult | { error: string }> {
  const pool = await getActiveRecruiterPool(supabase);
  if (pool.length === 0) return { error: "No active recruiters available to distribute to." };

  const applications = await getUnassignedApplications(supabase, params.applicationIds);
  if (applications.length === 0) return { assigned: [], skipped: [] };

  if (params.method === "round_robin") {
    return runDistribution(supabase, applications, (i) => pool[i % pool.length], params.assignedBy, "round_robin");
  }

  // Load balanced: greedily pick whoever currently has the fewest active
  // assignments, then track that pick locally so the next application in the same
  // batch sees the updated count — "fewest-first," not "fewest as of page load."
  const counts = await getActiveAssignmentCounts(supabase, pool.map((r) => r.id));
  const running = new Map(pool.map((r) => [r.id, counts.get(r.id) ?? 0]));
  const pickLeastLoaded = () => {
    let best = pool[0];
    for (const r of pool) if ((running.get(r.id) ?? 0) < (running.get(best.id) ?? 0)) best = r;
    running.set(best.id, (running.get(best.id) ?? 0) + 1);
    return best;
  };
  return runDistribution(supabase, applications, pickLeastLoaded, params.assignedBy, "load_balanced");
}

export async function manualAssign(
  supabase: SupabaseClient<Database>,
  params: { assignments: { applicationId: string; recruiterId: string }[]; assignedBy: string }
): Promise<DistributeResult> {
  const recruiterIds = [...new Set(params.assignments.map((a) => a.recruiterId))];
  const { data: recruiters, error } = await supabase.from("users").select("id, name").in("id", recruiterIds);
  if (error) throw error;
  const nameById = new Map((recruiters ?? []).map((r) => [r.id, r.name]));

  const assigned: DistributeResult["assigned"] = [];
  const skipped: DistributeResult["skipped"] = [];
  for (const a of params.assignments) {
    const recruiterName = nameById.get(a.recruiterId);
    if (!recruiterName) {
      skipped.push({ applicationId: a.applicationId, reason: "Unknown recruiter." });
      continue;
    }
    const result = await insertAssignment(supabase, {
      applicationId: a.applicationId,
      recruiterId: a.recruiterId,
      assignedBy: params.assignedBy,
      method: "manual",
    });
    if (result.ok) assigned.push({ applicationId: a.applicationId, recruiterId: a.recruiterId, recruiterName });
    else skipped.push({ applicationId: a.applicationId, reason: result.message });
  }
  return { assigned, skipped };
}

// Reassignment never updates a row in place — it flips the current active row (if
// any) to 'reassigned' and inserts a fresh active one, so assignment history
// survives (claude.md). The partial unique index still protects against two
// concurrent reassigns of the same application producing two active rows: only one
// insert can win.
export async function reassign(
  supabase: SupabaseClient<Database>,
  params: { applicationId: string; recruiterId: string; assignedBy: string }
): Promise<{ ok: true } | { ok: false; code: "conflict" | "server_error"; message: string }> {
  const { error: updateError } = await supabase
    .from("assignments")
    .update({ status: "reassigned", unassigned_at: new Date().toISOString() })
    .eq("application_id", params.applicationId)
    .eq("status", "active");
  if (updateError) return { ok: false, code: "server_error", message: updateError.message };

  const result = await insertAssignment(supabase, {
    applicationId: params.applicationId,
    recruiterId: params.recruiterId,
    assignedBy: params.assignedBy,
    method: "manual",
  });
  if (result.ok) return { ok: true };
  return {
    ok: false,
    code: result.conflict ? "conflict" : "server_error",
    message: result.conflict ? "Another reassignment already landed for this application." : result.message,
  };
}
