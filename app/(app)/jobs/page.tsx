import Link from "next/link";
import { candidatesSeed, clientsSeed, jobsSeed, jobStatusLabels, jobStatusStyle } from "@/lib/mock";

const gridTemplateColumns = "2fr 1.4fr 1fr 0.9fr 1fr 1fr";

export default function JobsListPage() {
  const clientNameById = new Map(clientsSeed.map((k) => [k.id, k.company]));

  const rows = jobsSeed.map((j) => {
    const applications = candidatesSeed.filter((c) => c.jobId === j.id).length;
    const { bg: statusBg, color: statusColor } = jobStatusStyle(j.status);
    return {
      ...j,
      client: clientNameById.get(j.clientId) ?? "",
      applications,
      statusBg,
      statusColor,
    };
  });

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>
        {jobsSeed.length} Jobs
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns,
            gap: 10,
            padding: "10px 16px",
            fontSize: 11.5,
            fontWeight: 600,
            color: "#9AA1AC",
            textTransform: "uppercase",
            borderBottom: "1px solid #EEF0F4",
            background: "#FAFBFC",
          }}
        >
          <div>Job Title</div>
          <div>Client</div>
          <div>Status</div>
          <div>Openings</div>
          <div>Applications</div>
          <div>Created On</div>
        </div>
        {rows.map((j) => (
          <Link
            key={j.id}
            href={`/jobs/${j.id}`}
            style={{
              display: "grid",
              gridTemplateColumns,
              gap: 10,
              alignItems: "center",
              padding: "11px 16px",
              borderBottom: "1px solid #F4F5F8",
              cursor: "pointer",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{j.title}</div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{j.client}</div>
            <div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: j.statusBg,
                  color: j.statusColor,
                }}
              >
                {jobStatusLabels[j.status]}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#1D2433" }}>{j.openings}</div>
            <div style={{ fontSize: 13, color: "#1D2433" }}>{j.applications}</div>
            <div style={{ fontSize: 12.5, color: "#9AA1AC" }}>{j.createdOn}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
