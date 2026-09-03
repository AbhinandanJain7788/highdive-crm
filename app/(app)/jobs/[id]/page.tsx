import Link from "next/link";
import { notFound } from "next/navigation";
import {
  candidatesSeed,
  clientsSeed,
  computeStageCounts,
  jobsSeed,
  jobStatusLabels,
  statusStyles,
  usersSeed,
} from "@/lib/mock";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = jobsSeed.find((j) => j.id === id);
  if (!job) notFound();

  const client = clientsSeed.find((k) => k.id === job.clientId);
  const jobCandidates = candidatesSeed.filter((c) => c.jobId === job.id);
  const stageCounts = computeStageCounts(jobCandidates);
  const userNameById = new Map(usersSeed.map((u) => [u.id, u.name]));

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
          <div style={{ fontSize: 13, color: "#9AA1AC", marginBottom: 16 }}>{client?.company ?? ""}</div>
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
              {jobCandidates.length}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Created On</div>
              {job.createdOn}
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 10 }}>Pipeline Breakdown</div>
          {stageCounts.map((stage) => (
            <div key={stage.stage} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 120, fontSize: 12, color: "#4B5565", flexShrink: 0 }}>{stage.stage}</div>
              <div style={{ flex: 1, height: 7, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#FF5C35", borderRadius: 4, width: stage.pct }} />
              </div>
              <div style={{ width: 22, textAlign: "right", fontSize: 12, fontWeight: 600, color: "#1D2433" }}>
                {stage.count}
              </div>
            </div>
          ))}
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
          {jobCandidates.map((c) => {
            const badge = statusStyles[c.status];
            const recruiterLabel = c.recruiterId ? (userNameById.get(c.recruiterId) ?? "Unassigned") : "Unassigned";
            return (
              <Link
                key={c.id}
                href={`/candidates/${c.id}`}
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
                <div style={{ fontSize: 12.5, color: "#4B5565" }}>{recruiterLabel}</div>
                <div style={{ fontSize: 12, color: "#FF5C35", textAlign: "right" }}>View →</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
