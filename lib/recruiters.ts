import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { formatDisplayDate } from "@/lib/format";

type LiveStatus = Database["public"]["Enums"]["live_status"];
type ApplicationStatus = Database["public"]["Enums"]["application_status"];

// "Converted" = the application reached a terminal *positive* outcome. `rejected`,
// `not_interested` and `no_response` are terminal too, but negative — they belong in
// the denominator, never the numerator.
const CONVERTED_STATUSES: ApplicationStatus[] = ["selected", "joined"];

export type RecruiterRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarColor: string | null;
  joinedOn: string;
  liveStatus: LiveStatus | null;
  liveStatusSince: string | null;
  roleName: string | null;
  assignedCount: number;
  convertedCount: number;
  conversion: number;
  // TODO(phase-5): call metrics come from the `calls` table, which Phase 5 wires.
  // Null here means "not yet available", and the UI renders it as "--" rather than
  // showing a fabricated zero.
  callsToday: null;
  avgTalkSeconds: null;
};

export type RecruiterAssignedCandidate = {
  applicationId: string;
  assignmentId: string;
  candidateId: string;
  name: string;
  phone: string;
  status: ApplicationStatus;
  jobId: string | null;
  jobTitle: string | null;
  assignedOn: string;
};

export type RecruiterDetail = RecruiterRow & { assignedCandidates: RecruiterAssignedCandidate[] };

type RawAssignment = {
  id: string;
  recruiter_id: string;
  assigned_at: string;
  application: {
    id: string;
    status: ApplicationStatus;
    candidate: { id: string; name: string; phone: string | null } | null;
    job: { id: string; title: string } | null;
  } | null;
};

const ASSIGNMENT_SELECT = `
  id, recruiter_id, assigned_at,
  application:applications(
    id, status,
    candidate:candidates(id, name, phone),
    job:jobs(id, title)
  )
`;

const RECRUITER_COLUMNS = `id, name, email, phone, avatar_color, joined_on, live_status, live_status_since, role_id, role:roles!users_role_id_fkey(id, name)`;

type RawRecruiter = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_color: string | null;
  joined_on: string | null;
  live_status: LiveStatus | null;
  live_status_since: string | null;
  role_id: string | null;
  role: { id: string; name: string } | null;
};

// Who counts as a recruiter is derived from permissions, not from a role name —
// claude.md forbids hardcoding role names, and roles are editable data. A recruiter
// is precisely a user whose visibility is scoped to their own assignments, i.e. one
// who does *not* hold `view_all_records`. In the current seed that resolves to the
// six `User`-role people, but it keeps working if roles are renamed or added.
async function recruiterRoleFilter(supabase: SupabaseClient<Database>): Promise<string[]> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("role_id, permissions!inner(key)")
    .eq("permissions.key", "view_all_records")
    .returns<{ role_id: string }[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.role_id);
}

function conversionPct(assigned: number, converted: number): number {
  // A recruiter with nothing assigned converts 0%, never NaN or a divide-by-zero.
  if (assigned === 0) return 0;
  return Math.round((converted / assigned) * 100);
}

async function listRecruiterUsers(
  supabase: SupabaseClient<Database>,
  id?: string
): Promise<RawRecruiter[]> {
  let query = supabase.from("users").select(RECRUITER_COLUMNS).eq("status", "active");

  if (id) {
    query = query.eq("id", id);
  } else {
    const adminRoleIds = await recruiterRoleFilter(supabase);
    if (adminRoleIds.length) {
      query = query.or(`role_id.is.null,role_id.not.in.(${adminRoleIds.join(",")})`);
    }
  }

  const { data, error } = await query.order("name", { ascending: true }).returns<RawRecruiter[]>();
  if (error) throw error;
  return data ?? [];
}

// Metrics are computed over *active* assignments only, so the two numbers on a row
// stay consistent with each other: "Assigned 5 / Conversion 40%" means 2 of those 5.
// A candidate unassigned after joining therefore stops counting for that recruiter.
async function assignmentsByRecruiter(
  supabase: SupabaseClient<Database>,
  recruiterIds: string[]
): Promise<Map<string, RawAssignment[]>> {
  const byRecruiter = new Map<string, RawAssignment[]>();
  if (recruiterIds.length === 0) return byRecruiter;

  const { data, error } = await supabase
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("status", "active")
    .in("recruiter_id", recruiterIds)
    .returns<RawAssignment[]>();
  if (error) throw error;

  for (const assignment of data ?? []) {
    const list = byRecruiter.get(assignment.recruiter_id);
    if (list) list.push(assignment);
    else byRecruiter.set(assignment.recruiter_id, [assignment]);
  }
  return byRecruiter;
}

function toRecruiterRow(u: RawRecruiter, assignments: RawAssignment[]): RecruiterRow {
  const assignedCount = assignments.length;
  const convertedCount = assignments.filter(
    (a) => a.application && CONVERTED_STATUSES.includes(a.application.status)
  ).length;

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    avatarColor: u.avatar_color,
    joinedOn: formatDisplayDate(u.joined_on),
    liveStatus: u.live_status,
    liveStatusSince: u.live_status_since,
    roleName: u.role?.name ?? null,
    assignedCount,
    convertedCount,
    conversion: conversionPct(assignedCount, convertedCount),
    callsToday: null,
    avgTalkSeconds: null,
  };
}

export async function getRecruiterRows(supabase: SupabaseClient<Database>): Promise<RecruiterRow[]> {
  const users = await listRecruiterUsers(supabase);
  const byRecruiter = await assignmentsByRecruiter(
    supabase,
    users.map((u) => u.id)
  );
  return users.map((u) => toRecruiterRow(u, byRecruiter.get(u.id) ?? []));
}

export async function getRecruiterDetail(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<RecruiterDetail | null> {
  const [user] = await listRecruiterUsers(supabase, id);
  if (!user) return null;

  const assignments = (await assignmentsByRecruiter(supabase, [id])).get(id) ?? [];
  const assignedCandidates: RecruiterAssignedCandidate[] = assignments
    .filter((a) => a.application?.candidate)
    .map((a) => ({
      applicationId: a.application!.id,
      assignmentId: a.id,
      candidateId: a.application!.candidate!.id,
      name: a.application!.candidate!.name,
      phone: a.application!.candidate!.phone ?? "",
      status: a.application!.status,
      jobId: a.application!.job?.id ?? null,
      jobTitle: a.application!.job?.title ?? null,
      assignedOn: formatDisplayDate(a.assigned_at),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { ...toRecruiterRow(user, assignments), assignedCandidates };
}
