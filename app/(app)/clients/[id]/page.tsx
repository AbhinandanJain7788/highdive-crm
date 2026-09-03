import Link from "next/link";
import { notFound } from "next/navigation";
import { candidatesSeed, clientsSeed, jobsSeed, jobStatusLabels, jobStatusStyle, usersSeed } from "@/lib/mock";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = clientsSeed.find((k) => k.id === id);
  if (!client) notFound();

  const accountManager = usersSeed.find((u) => u.id === client.accountManagerId);
  const clientJobs = jobsSeed
    .filter((j) => j.clientId === client.id)
    .map((j) => {
      const applications = candidatesSeed.filter((c) => c.jobId === j.id).length;
      const { bg: statusBg, color: statusColor } = jobStatusStyle(j.status);
      return { ...j, applications, statusBg, statusColor };
    });

  return (
    <div>
      <Link
        href="/clients"
        style={{ fontSize: 13, color: "#6B7280", cursor: "pointer", marginBottom: 14, display: "block", textDecoration: "none" }}
      >
        ← Back to Clients
      </Link>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>{client.company}</div>
          <div style={{ fontSize: 13, color: "#1D2433", lineHeight: 1.8 }}>
            <div>
              <span style={{ color: "#9AA1AC" }}>Contact:</span> {client.contactName}
            </div>
            <div>
              <span style={{ color: "#9AA1AC" }}>Email:</span> {client.email}
            </div>
            <div>
              <span style={{ color: "#9AA1AC" }}>Phone:</span> {client.phone}
            </div>
            <div>
              <span style={{ color: "#9AA1AC" }}>Industry:</span> {client.industry}
            </div>
            <div>
              <span style={{ color: "#9AA1AC" }}>Account Manager:</span> {accountManager?.name ?? ""}
            </div>
          </div>
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Jobs with this Client</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 0.9fr 1fr",
              gap: 10,
              padding: "8px 10px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "#9AA1AC",
              textTransform: "uppercase",
              borderBottom: "1px solid #EEF0F4",
            }}
          >
            <div>Job Title</div>
            <div>Status</div>
            <div>Openings</div>
            <div>Applications</div>
          </div>
          {clientJobs.map((j) => (
            <Link
              key={j.id}
              href={`/jobs/${j.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 0.9fr 1fr",
                gap: 10,
                alignItems: "center",
                padding: "10px 10px",
                borderBottom: "1px solid #F4F5F8",
                cursor: "pointer",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{j.title}</div>
              <div>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "3px 8px",
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
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
