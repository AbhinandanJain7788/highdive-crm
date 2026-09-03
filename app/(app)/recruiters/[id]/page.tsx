import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getRecruiterDetail } from "@/lib/recruiters";
import { liveStatusColors, liveStatusLabels, statusStyles } from "@/lib/mock";

export default async function RecruiterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentUserProfile();

  // A recruiter can read their own page; anyone else's needs view_all_records,
  // matching GET /api/recruiters/:id.
  if (!profile || (profile.id !== id && !profile.permissions.includes("view_all_records"))) {
    notFound();
  }

  const supabase = await createClient();
  const recruiter = await getRecruiterDetail(supabase, id);
  if (!recruiter) notFound();

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
                <span style={{ color: "#9AA1AC" }}>Phone:</span> {recruiter.phone ?? "--"}
              </div>
              <div>
                <span style={{ color: "#9AA1AC" }}>Joined:</span> {recruiter.joinedOn}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* TODO(phase-5): Calls Today and Avg Talk Time both read the `calls`
                table, which Phase 5 wires. Rendered as "--" until then — a real
                absence, not a zero that looks like a measured value. */}
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#9AA1AC" }}>{recruiter.callsToday ?? "--"}</div>
              <div style={{ fontSize: 11.5, color: "#6B7280" }}>Calls Today</div>
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#9AA1AC" }}>{recruiter.avgTalkSeconds ?? "--"}</div>
              <div style={{ fontSize: 11.5, color: "#6B7280" }}>Avg Talk Time</div>
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1D2433" }}>{recruiter.assignedCount}</div>
              <div style={{ fontSize: 11.5, color: "#6B7280" }}>Assigned Candidates</div>
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1E7F43" }}>{recruiter.conversion}%</div>
              <div style={{ fontSize: 11.5, color: "#6B7280" }}>Conversion Rate</div>
            </div>
          </div>
        </div>
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 12 }}>Assigned Candidates</div>
            {recruiter.assignedCandidates.map((c) => {
              const badge = statusStyles[c.status];
              return (
                <Link
                  key={c.applicationId}
                  href={`/candidates/${c.candidateId}`}
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
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: "#9AA1AC" }}>{c.jobTitle ?? "--"}</div>
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
                </Link>
              );
            })}
            {recruiter.assignedCandidates.length === 0 && (
              <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "24px 0" }}>
                No candidates currently assigned.
              </div>
            )}
          </div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 12 }}>Recent Call Activity</div>
            {/* TODO(phase-5): reads the `calls` table (populated by the Android app).
                Left as an explicit empty state rather than mock rows that would look
                like this recruiter's real call history. */}
            <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 12.5, padding: "24px 0" }}>
              Call activity is wired in Phase 5.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
