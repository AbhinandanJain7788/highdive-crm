import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { rangeOverflow, escapeFilterValue, formatDisplayDate, type Pagination } from "@/lib/format";

export type JobStatus = Database["public"]["Enums"]["job_status"];
type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export const JOB_STATUSES: JobStatus[] = ["open", "on_hold", "closed"];

// Mirrors lib/mock/jobs.ts's MockJob plus the counts the list actually displays.
export type JobRow = {
  id: string;
  title: string;
  status: JobStatus;
  openings: number;
  clientId: string;
  clientName: string | null;
  applicationCount: number;
  createdOn: string;
  createdAt: string;
};

// Same shape as lib/mock/pipeline.ts's StageCount so Job Detail's existing bar markup
// renders it unchanged — but every stage here comes from the job's own template.
export type StageCount = { stageId: string; stage: string; count: number; pct: string };

export type JobApplicant = {
  applicationId: string;
  candidateId: string;
  name: string;
  phone: string;
  status: ApplicationStatus;
  recruiterId: string | null;
  recruiterName: string | null;
  stageId: string | null;
  stageName: string | null;
};

export type JobDetail = JobRow & {
  pipelineTemplate: { id: string; name: string } | null;
  stageCounts: StageCount[];
  // Applications whose `pipeline_stage_id` is null sit outside the template's stages
  // and so appear in no bar; surfaced rather than silently dropped from the total.
  unstagedCount: number;
  applicants: JobApplicant[];
};

const JOB_LIST_SELECT = `
  id, title, status, openings, created_at, client_id,
  client:clients(id, company),
  applications(count)
`;

type RawJobRow = {
  id: string;
  title: string;
  status: JobStatus;
  openings: number;
  created_at: string;
  client_id: string;
  client: { id: string; company: string } | null;
  applications: { count: number }[] | null;
};

function toJobRow(j: RawJobRow): JobRow {
  return {
    id: j.id,
    title: j.title,
    status: j.status,
    openings: j.openings,
    clientId: j.client_id,
    clientName: j.client?.company ?? null,
    applicationCount: j.applications?.[0]?.count ?? 0,
    createdOn: formatDisplayDate(j.created_at),
    createdAt: j.created_at,
  };
}

export async function getJobRows(
  supabase: SupabaseClient<Database>,
  options: { search?: string; statuses?: JobStatus[]; clientId?: string; pagination: Pagination }
): Promise<{ rows: JobRow[]; total: number }> {
  let query = supabase.from("jobs").select(JOB_LIST_SELECT, { count: "exact" });

  if (options.search?.trim()) {
    const term = escapeFilterValue(options.search);
    if (term) query = query.ilike("title", `%${term}%`);
  }
  if (options.statuses?.length) query = query.in("status", options.statuses);
  if (options.clientId) query = query.eq("client_id", options.clientId);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(options.pagination.from, options.pagination.to)
    .returns<RawJobRow[]>();
  const overflow = rangeOverflow(error);
  if (overflow) return { rows: [], total: overflow.total };
  if (error) throw error;

  return { rows: (data ?? []).map(toJobRow), total: count ?? 0 };
}

type RawJobDetail = RawJobRow & {
  pipeline_template_id: string;
  template: { id: string; name: string; stages: { id: string; name: string; sequence_order: number }[] } | null;
  applicants:
    | {
        id: string;
        status: ApplicationStatus;
        pipeline_stage_id: string | null;
        candidate: { id: string; name: string; phone: string | null } | null;
        recruiter: { id: string; name: string } | null;
        stage: { id: string; name: string } | null;
      }[]
    | null;
};

export async function getJobDetail(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<JobDetail | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      `id, title, status, openings, created_at, client_id, pipeline_template_id,
       client:clients(id, company),
       applications(count),
       template:pipeline_templates(id, name, stages:pipeline_stages(id, name, sequence_order)),
       applicants:applications(
         id, status, pipeline_stage_id,
         candidate:candidates!inner(id, name, phone),
         recruiter:users!applications_assigned_recruiter_id_fkey(id, name),
         stage:pipeline_stages(id, name)
       )`
    )
    .eq("id", id)
    .is("applicants.candidate.deleted_at", null)
    .maybeSingle<RawJobDetail>();
  if (error) throw error;
  if (!data) return null;

  const applications = data.applicants ?? [];

  // The breakdown is driven entirely by the job's assigned template, in
  // `sequence_order` — two jobs on different templates therefore show different
  // stage lists, and no stage name exists anywhere in this codebase.
  const stages = [...(data.template?.stages ?? [])].sort((a, b) => a.sequence_order - b.sequence_order);
  const countByStage = new Map<string, number>();
  let unstagedCount = 0;
  for (const app of applications) {
    if (!app.pipeline_stage_id) {
      unstagedCount += 1;
      continue;
    }
    countByStage.set(app.pipeline_stage_id, (countByStage.get(app.pipeline_stage_id) ?? 0) + 1);
  }

  // Bar width formula lifted verbatim from the HTML (and lib/mock/pipeline.ts) so the
  // real breakdown renders identically to the signed-off design.
  const maxCount = Math.max(1, ...stages.map((s) => countByStage.get(s.id) ?? 0));
  const stageCounts: StageCount[] = stages.map((s) => {
    const count = countByStage.get(s.id) ?? 0;
    return {
      stageId: s.id,
      stage: s.name,
      count,
      pct: `${Math.max(4, Math.round((count / maxCount) * 100))}%`,
    };
  });

  const applicants: JobApplicant[] = applications
    .filter((a) => a.candidate)
    .map((a) => ({
      applicationId: a.id,
      candidateId: a.candidate!.id,
      name: a.candidate!.name,
      phone: a.candidate!.phone ?? "",
      status: a.status,
      recruiterId: a.recruiter?.id ?? null,
      recruiterName: a.recruiter?.name ?? null,
      stageId: a.stage?.id ?? null,
      stageName: a.stage?.name ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...toJobRow(data),
    pipelineTemplate: data.template ? { id: data.template.id, name: data.template.name } : null,
    stageCounts,
    unstagedCount,
    applicants,
  };
}
