import type { ApplicationStatus, MockCandidate } from "./candidates";

// Verbatim from defaultPipelineStages. Only one pipeline template exists — see
// claude.md's Phase 0 As-Built Notes for why.
export const defaultPipelineStages = [
  "New",
  "Contacted",
  "Screening",
  "Interview Scheduled",
  "Interview Done",
  "Selected",
  "Offered",
  "Joined",
];

// Maps the schema's application_status enum to the nearest pipeline stage name, per
// Phase 0's As-Built Notes ("pipeline_stage_id is inferred from application_status where
// the two vocabularies don't line up 1:1 — rejected -> Screening, not_interested /
// no_response -> Contacted"). Kept consistent with how this same data was seeded into
// the real Phase 0 database.
export function stageForStatus(status: ApplicationStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "contacted":
      return "Contacted";
    case "interview_scheduled":
      return "Interview Scheduled";
    case "interview_done":
      return "Interview Done";
    case "selected":
      return "Selected";
    case "joined":
      return "Joined";
    case "rejected":
      return "Screening";
    case "not_interested":
    case "no_response":
      return "Contacted";
  }
}

export type StageCount = { stage: string; count: number; pct: string };

// Mirrors the HTML's stageCounts computation used by both Job Detail's Pipeline
// Breakdown and Reports' Pipeline Funnel: Math.max(4, Math.round(count/maxCount*100))+'%'.
export function computeStageCounts(
  candidates: MockCandidate[],
  stages: readonly string[] = defaultPipelineStages,
): StageCount[] {
  const rawCounts = stages.map((st) => candidates.filter((c) => stageForStatus(c.status) === st).length);
  const maxCount = Math.max(1, ...rawCounts);
  return stages.map((st, i) => ({
    stage: st,
    count: rawCounts[i],
    pct: `${Math.max(4, Math.round((rawCounts[i] / maxCount) * 100))}%`,
  }));
}
