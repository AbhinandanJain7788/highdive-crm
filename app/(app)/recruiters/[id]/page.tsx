import Link from "next/link";
import { notFound } from "next/navigation";
import {
  callLogsSeed,
  candidatesSeed,
  dispositionStyles,
  fmtDuration,
  liveStatusColors,
  liveStatusLabels,
  recruiters,
  statusStyles,
} from "@/lib/mock";

export default async function RecruiterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recruiter = recruiters.find((r) => r.id === id);
  if (!recruiter) notFound();

  const assignedCandidates = candidatesSeed.filter((c) => c.recruiterId === recruiter.id);
  const converted = assignedCandidates.filter((c) => c.status === "selected" || c.status === "joined");
  const conversion = assignedCandidates.length ? Math.round((converted.length / assignedCandidates.length) * 100) : 0;

  const recruiterCalls = callLogsSeed.filter((l) => l.byUserId === recruiter.id);
  const connectedCalls = recruiterCalls.filter((l) => l.disposition === "Connected");
  const avgTalkSeconds = connectedCalls.length
    ? Math.round(connectedCalls.reduce((a, l) => a + l.durationSeconds, 0) / connectedCalls.length)
    : 0;
  const recentCalls = recruiterCalls.slice(0, 6);

  const dotColor = liveStatusColors[recruiter.liveStatus ?? "offline"];
  const liveStatusLabel = liveStatusLabels[recruiter.liveStatus ?? "offline"];

  return (
    <div>
      <Link
        href="/recruiters"
        style={{ fontSize: 13, color: "#6B7280", cursor: "pointer", marginBottom: 14, display: "block", textDecoration: "none" }}
      >
        ← Back to Recruiters
      </Link>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", marginBottom: 4 }}>{recruiter.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4B5565", marginBottom: 14 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
              {liveStatusLabel}
            </div>
            <div style={{ fontSize: 13, color: "#1D2433", lineHeight: 1.8 }}>
              <div>
                <span style={{ color: "#9AA1AC" }}>Email:</span> {recruiter.email}
              </div>
              <div>
                <span style={{ color: "#9AA1AC" }}>Phone:</span> {recruiter.phone}
              </div>
              <div>
                <span style={{ color: "#9AA1AC" }}>Joined:</span> {recruiter.joinedOn}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1D2433" }}>{recruiterCalls.length}</div>
              <div style={{ fontSize: 11.5, color: "#6B7280" }}>Calls Today</div>
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1D2433" }}>{fmtDuration(avgTalkSeconds)}</div>
              <div style={{ fontSize: 11.5, color: "#6B7280" }}>Avg Talk Time</div>
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1D2433" }}>{assignedCandidates.length}</div>
              <div style={{ fontSize: 11.5, color: "#6B7280" }}>Assigned Candidates</div>
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1E7F43" }}>{conversion}%</div>
              <div style={{ fontSize: 11.5, color: "#6B7280" }}>Conversion Rate</div>
            </div>
          </div>
        </div>
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 12 }}>Assigned Candidates</div>
            {assignedCandidates.map((c) => {
              const badge = statusStyles[c.status];
              return (
                <Link
                  key={c.id}
                  href={`/candidates/${c.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.2fr",
                    gap: 10,
                    alignItems: "center",
                    padding: "9px 0",
                    borderBottom: "1px solid #F4F5F8",
                    cursor: "pointer",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{c.name}</div>
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
                </Link>
              );
            })}
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 12 }}>Recent Call Activity</div>
            {recentCalls.map((call) => {
              const disp = dispositionStyles[call.disposition];
              return (
                <div
                  key={call.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr",
                    gap: 10,
                    alignItems: "center",
                    padding: "9px 0",
                    borderBottom: "1px solid #F4F5F8",
                  }}
                >
                  <div style={{ fontSize: 12.5, color: "#4B5565" }}>{call.calledAt}</div>
                  <div style={{ fontSize: 12.5, color: "#1D2433" }}>{fmtDuration(call.durationSeconds)}</div>
                  <div style={{ fontSize: 12, color: "#4B5565" }}>{call.name}</div>
                  <div>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: 20,
                        background: disp.bg,
                        color: disp.color,
                      }}
                    >
                      {call.disposition}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
