import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { escapeFilterValue, formatDisplayDate, phoneSearchPattern, type Pagination } from "@/lib/format";
import type { CandidateRow, CandidateDetail } from "@/lib/candidates.shared";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "new",
  "contacted",
  "interview_scheduled",
  "interview_done",
  "selected",
  "rejected",
  "not_interested",
  "no_response",
  "joined",
];

// Row/detail shapes live in lib/candidates.shared.ts so client components can import
// them without pulling in this module's `server-only` marker.
export type { CandidateRow, CandidateApplication, CandidateDetail } from "@/lib/candidates.shared";

export type CandidateListOptions = {
  search?: string;
  statuses?: ApplicationStatus[];
  sources?: string[];
  unassignedOnly?: boolean;
  // Inclusive ISO bounds on `created_at`, backing the Overall / Last 30 Days /
  // Select Range tabs. Filtering here rather than in the browser keeps the range
  // honest across pages — a client-side filter would only ever see the current one.
  createdFrom?: string;
  createdTo?: string;
  sort?: "name-asc" | "name-desc" | "created-new" | "created-old";
  pagination: Pagination;
};

const APPLICATION_EMBED = `
  id, status, created_at, job_id, assigned_recruiter_id, pipeline_stage_id,
  job:jobs(id, title, status),
  recruiter:users!applications_assigned_recruiter_id_fkey(id, name),
  stage:pipeline_stages(id, name, sequence_order)
`;

const CANDIDATE_COLUMNS = `id, name, phone, email, source, notes, is_duplicate, resume_url, duplicate_of, created_at`;

type RawApplication = {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  job_id: string;
  assigned_recruiter_id: string | null;
  pipeline_stage_id: string | null;
  job: { id: string; title: string; status: Database["public"]["Enums"]["job_status"] } | null;
  recruiter: { id: string; name: string } | null;
  stage: { id: string; name: string; sequence_order: number } | null;
};

type RawCandidate = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  notes: string | null;
  is_duplicate: boolean;
  resume_url: string | null;
  duplicate_of: string | null;
  created_at: string;
  applications: RawApplication[] | null;
  creator?: { id: string; name: string } | null;
};

// A candidate is not an application (claude.md): status, stage and recruiter all live
// on `applications`, and a candidate can hold several. The list shows one row per
// person, carrying their most recent application — confirmed as the display rule for
// multi-job candidates (claude.md Open Question 5). The full set is on the detail page.
function newestApplication(applications: RawApplication[] | null): RawApplication | null {
  if (!applications?.length) return null;
  return applications.reduce((newest, a) =>
    new Date(a.created_at).getTime() > new Date(newest.created_at).getTime() ? a : newest
  );
}

function toCandidateRow(c: RawCandidate): CandidateRow {
  const app = newestApplication(c.applications);
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    email: c.email,
    status: app?.status ?? null,
    jobId: app?.job?.id ?? null,
    jobTitle: app?.job?.title ?? null,
    recruiterId: app?.recruiter?.id ?? null,
    recruiterName: app?.recruiter?.name ?? null,
    source: c.source ?? "",
    createdOn: formatDisplayDate(c.created_at),
    createdAt: c.created_at,
    isDuplicate: c.is_duplicate,
    hasResume: Boolean(c.resume_url),
    notes: c.notes ?? "",
    applicationId: app?.id ?? null,
    stageId: app?.stage?.id ?? null,
    stageName: app?.stage?.name ?? null,
    applicationCount: c.applications?.length ?? 0,
  };
}

export async function getCandidateRows(
  supabase: SupabaseClient<Database>,
  options: CandidateListOptions
): Promise<{ rows: CandidateRow[]; total: number }> {
  const { search, statuses, sources, unassignedOnly, createdFrom, createdTo, sort = "created-new", pagination } = options;

  // An inner join is what makes a status filter actually exclude candidates; the
  // default embed is a left join and would keep every candidate regardless.
  const needsInnerJoin = Boolean(statuses?.length) || unassignedOnly;
  const select = `${CANDIDATE_COLUMNS}, applications${needsInnerJoin ? "!inner" : ""}(${APPLICATION_EMBED})`;

  let query = supabase.from("candidates").select(select, { count: "exact" });

  if (search?.trim()) {
    const term = escapeFilterValue(search);
    const phonePattern = phoneSearchPattern(search);
    const clauses = [`name.ilike.%${term}%`];
    if (term) clauses.push(`phone.ilike.%${term}%`);
    if (phonePattern) clauses.push(`phone.ilike.${phonePattern}`);
    query = query.or(clauses.join(","));
  }
  if (statuses?.length) query = query.in("applications.status", statuses);
  if (sources?.length) query = query.in("source", sources);
  if (unassignedOnly) query = query.is("applications.assigned_recruiter_id", null);
  if (createdFrom) query = query.gte("created_at", createdFrom);
  if (createdTo) query = query.lte("created_at", createdTo);

  if (sort === "name-asc") query = query.order("name", { ascending: true });
  else if (sort === "name-desc") query = query.order("name", { ascending: false });
  else query = query.order("created_at", { ascending: sort === "created-old" });

  const { data, error, count } = await query
    .range(pagination.from, pagination.to)
    .returns<RawCandidate[]>();
  if (error) throw error;

  return { rows: (data ?? []).map(toCandidateRow), total: count ?? 0 };
}

export async function getCandidateDetail(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<CandidateDetail | null> {
  const { data, error } = await supabase
    .from("candidates")
    .select(
      `${CANDIDATE_COLUMNS},
       creator:users!candidates_created_by_fkey(id, name),
       applications(${APPLICATION_EMBED})`
    )
    .eq("id", id)
    .maybeSingle<RawCandidate>();
  if (error) throw error;
  if (!data) return null;

  const row = toCandidateRow(data);
  const applications = [...(data.applications ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((a) => ({
      id: a.id,
      status: a.status,
      createdOn: formatDisplayDate(a.created_at),
      createdAt: a.created_at,
      job: a.job,
      recruiter: a.recruiter,
      stage: a.stage ? { id: a.stage.id, name: a.stage.name, sequenceOrder: a.stage.sequence_order } : null,
    }));

  return {
    ...row,
    resumeUrl: data.resume_url,
    duplicateOf: data.duplicate_of,
    createdBy: data.creator ?? null,
    applications,
  };
}
