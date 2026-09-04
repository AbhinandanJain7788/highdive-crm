import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { crmStageForStatus, crmStages } from "@/lib/mock/pipeline";
import { statusStyles } from "@/lib/mock/styles";
import { APPLICATION_STATUSES } from "@/lib/candidates.shared";
import { pct } from "@/lib/dateRanges";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export type BucketCount = { key: string; label: string; count: number; pct: number };

export type StageSnapshotOptions = {
  // Inclusive bounds on candidates.created_at.
  from?: string;
  to?: string;
  // When set, scopes to candidates whose most-recent application is assigned to this
  // recruiter — "own numbers" for Dashboard/Analytics (claude.md Phase 6: "Recruiters
  // see only their own numbers"). Omitted entirely for an org-wide (manager) view.
  recruiterId?: string;
};

// A candidate is not an application (claude.md) — status lives on `applications`, and
// the display rule already established for the Candidates list (Phase 3 Open Question
// 5) is "one row per candidate, carrying the most recent application." Reused here so
// Dashboard/Analytics counts describe the same candidate set the Candidates screen
// would for the same filters, rather than inventing a second counting rule.
// When `recruiterId` is set, the applications embed is inner-joined and filtered to
// that recruiter's own assignment — a candidate with two applications where only one
// is assigned to this recruiter is counted by that one application's status, not
// whichever is newest overall, so a recruiter's "own numbers" reflect their own
// caseload rather than a colleague's.
async function getNewestStatusPerCandidate(
  supabase: SupabaseClient<Database>,
  options: StageSnapshotOptions
): Promise<ApplicationStatus[]> {
  const needsInner = Boolean(options.recruiterId);
  const select = `id, created_at, applications${needsInner ? "!inner" : ""}(status, created_at, assigned_recruiter_id)`;
  let query = supabase.from("candidates").select(select).is("deleted_at", null);
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lte("created_at", options.to);
  if (options.recruiterId) query = query.eq("applications.assigned_recruiter_id", options.recruiterId);

  const { data, error } = await query.returns<
    { id: string; created_at: string; applications: { status: ApplicationStatus; created_at: string }[] | null }[]
  >();
  if (error) throw error;

  return (data ?? [])
    .map((c) => {
      const apps = c.applications ?? [];
      if (!apps.length) return null;
      return apps.reduce((newest, a) => (new Date(a.created_at) > new Date(newest.created_at) ? a : newest)).status;
    })
    .filter((s): s is ApplicationStatus => Boolean(s));
}

export type StageSnapshot = {
  total: number;
  crmStages: BucketCount[];
  statusBreakdown: BucketCount[];
};

// Powers both Dashboard's "Candidates" panel (stage bars + status list) and
// Analytics' "Customer Stages" widget — one computation, reused, so the two screens
// can never disagree about the same range/scope. crmStageForStatus/crmStages and
// statusStyles are the same pure label maps AllocationsClient already uses; reusing
// them (rather than re-deriving a second mapping) keeps the coarse-stage vocabulary
// identical everywhere it appears.
export async function getCandidateStageSnapshot(
  supabase: SupabaseClient<Database>,
  options: StageSnapshotOptions
): Promise<StageSnapshot> {
  const statuses = await getNewestStatusPerCandidate(supabase, options);
  const total = statuses.length;

  const crmCounts = new Map<string, number>();
  for (const s of statuses) {
    const label = crmStageForStatus(s);
    crmCounts.set(label, (crmCounts.get(label) ?? 0) + 1);
  }
  const crmStagesOut: BucketCount[] = crmStages.map((label) => {
    const count = crmCounts.get(label) ?? 0;
    return { key: label, label, count, pct: pct(count, total) };
  });

  const statusCounts = new Map<string, number>();
  for (const s of statuses) statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
  const statusOut: BucketCount[] = APPLICATION_STATUSES.map((s) => {
    const count = statusCounts.get(s) ?? 0;
    return { key: s, label: statusStyles[s]?.label ?? s, count, pct: pct(count, total) };
  });

  return { total, crmStages: crmStagesOut, statusBreakdown: statusOut };
}

export type FunnelStage = { id: string; name: string; sequenceOrder: number; count: number };

// Conversion Funnel (Analytics) and Pipeline Funnel (Reports) both read real
// `pipeline_stages` rows off the org's default `pipeline_templates` row (claude.md:
// "ship with one default process; do not hardcode it" — same reasoning applied here to
// the default pipeline) — never a hardcoded stage-name list. Two pipeline templates
// exist (Phase 3's As-Built Notes: "Default Pipeline" 8 stages, "Bulk Hiring Pipeline"
// 5 stages with a different vocabulary); this funnel only covers applications on jobs
// using the default template, same documented, pre-existing limitation as ui-gaps.md
// item 15 ("Offered" can never have candidates) — not a new gap introduced here.
export async function getDefaultPipelineFunnel(
  supabase: SupabaseClient<Database>,
  options: { from?: string; to?: string; recruiterId?: string } = {}
): Promise<FunnelStage[]> {
  const { data: template, error: templateErr } = await supabase
    .from("pipeline_templates")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();
  if (templateErr) throw templateErr;
  if (!template) return [];

  const { data: stages, error: stagesErr } = await supabase
    .from("pipeline_stages")
    .select("id, name, sequence_order")
    .eq("pipeline_template_id", template.id)
    .order("sequence_order", { ascending: true });
  if (stagesErr) throw stagesErr;
  const stageList = stages ?? [];
  if (!stageList.length) return [];

  let query = supabase
    .from("applications")
    .select("pipeline_stage_id, created_at, assigned_recruiter_id")
    .in(
      "pipeline_stage_id",
      stageList.map((s) => s.id)
    );
  if (options.from) query = query.gte("created_at", options.from);
  if (options.to) query = query.lte("created_at", options.to);
  if (options.recruiterId) query = query.eq("assigned_recruiter_id", options.recruiterId);

  const { data: apps, error: appsErr } = await query.returns<{ pipeline_stage_id: string | null }[]>();
  if (appsErr) throw appsErr;

  const counts = new Map<string, number>();
  for (const a of apps ?? []) {
    if (!a.pipeline_stage_id) continue;
    counts.set(a.pipeline_stage_id, (counts.get(a.pipeline_stage_id) ?? 0) + 1);
  }

  return stageList.map((s) => ({
    id: s.id,
    name: s.name,
    sequenceOrder: s.sequence_order,
    count: counts.get(s.id) ?? 0,
  }));
}
