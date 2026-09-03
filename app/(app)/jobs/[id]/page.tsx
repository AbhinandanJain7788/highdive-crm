import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJobDetail } from "@/lib/jobs";
import { jobStatusLabels, statusStyles } from "@/lib/mock";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const job = await getJobDetail(supabase, id);
  if (!job) notFound();

  return (
    <div>
      <Link
        href="/jobs"
        style={{ fontSize: 13, color: "#6B7280", cursor: "pointer", marginBottom: 14, display: "block", textDecoration: "none" }}
      >
        ← Back to Jobs
      </Link>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1D2433", marginBottom: 4 }}>{job.title}</div>
          <div style={{ fontSize: 13, color: "#9AA1AC", marginBottom: 16 }}>{job.clientName ?? ""}</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              fontSize: 13,
              color: "#1D2433",
              marginBottom: 18,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Status</div>
              {jobStatusLabels[job.status]}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Openings</div>
              {job.openings}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Applications</div>
              {job.applicationCount}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Created On</div>
              {job.createdOn}
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 4 }}>Pipeline Breakdown</div>
          {/* Every stage below comes from this job's own pipeline_template_id, in
              sequence_order — a job on a different template renders a different list. */}
          <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 10 }}>
            {job.pipelineTemplate?.name ?? "No pipeline template"}
          </div>
          {job.stageCounts.map((stage) => (
            <div key={stage.stageId} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 120, fontSize: 12, color: "#4B5565", flexShrink: 0 }}>{stage.stage}</div>
              <div style={{ flex: 1, height: 7, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#FF5C35", borderRadius: 4, width: stage.pct }} />
              </div>
              <div style={{ width: 22, textAlign: "right", fontSize: 12, fontWeight: 600, color: "#1D2433" }}>
                {stage.count}
              </div>
            </div>
          ))}
          {job.unstagedCount > 0 && (
            <div style={{ fontSize: 11.5, color: "#B15C00", marginTop: 8 }}>
              {job.unstagedCount} application{job.unstagedCount === 1 ? "" : "s"} not yet on a pipeline stage
            </div>
          )}
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Candidates in this Job</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.3fr 1.2fr 1fr",
              gap: 10,
              padding: "8px 10px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "#9AA1AC",
              textTransform: "uppercase",
              borderBottom: "1px solid #EEF0F4",
            }}
          >
            <div>Candidate</div>
            <div>Status</div>
            <div>Recruiter</div>
            <div></div>
          </div>
          {job.applicants.map((c) => {
            const badge = statusStyles[c.status];
            return (
              <Link
                key={c.applicationId}
                href={`/candidates/${c.candidateId}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.3fr 1.2fr 1fr",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 10px",
                  borderBottom: "1px solid #F4F5F8",
                  cursor: "pointer",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "#9AA1AC" }}>{c.phone}</div>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 20,
                      background: badge.bg,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "#4B5565" }}>{c.recruiterName ?? "Unassigned"}</div>
                <div style={{ fontSize: 12, color: "#FF5C35", textAlign: "right" }}>View →</div>
              </Link>
            );
          })}
          {job.applicants.length === 0 && (
            <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "30px 0" }}>
              No candidates in this job yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
