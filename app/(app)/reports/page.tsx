import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getReportsData } from "@/lib/reports";
import { fmtDuration } from "@/lib/mock";

// Server component, no client-side interactivity needed — matches the signed-off
// HTML, which has no filters/tabs on this screen at all. Gated on `view_all_records`
// (claude.md's API table marks GET /api/reports "manager+"; same reasoning as
// /recruiters — Phase 3 As-Built Notes) rather than a dedicated permission key, since
// none exists for Reports specifically.
export default async function ReportsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile?.permissions.includes("view_all_records")) {
    return (
      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 40, textAlign: "center", color: "#6B7280", fontSize: 13.5 }}>
        Reports are only available to users who can view all records.
      </div>
    );
  }

  const supabase = await createClient();
  const data = await getReportsData(supabase);
  const funnelMax = Math.max(1, ...data.pipelineFunnel.map((s) => s.count));
  const outcomesMax = Math.max(1, ...data.callOutcomes.map((d) => d.count));

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>Reports</div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Pipeline Funnel</div>
          {data.pipelineFunnel.length === 0 && <div style={{ fontSize: 12.5, color: "#9AA1AC" }}>No pipeline data.</div>}
          {data.pipelineFunnel.map((stage) => (
            <div key={stage.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 130, fontSize: 12.5, color: "#4B5565", flexShrink: 0 }}>{stage.name}</div>
              <div style={{ flex: 1, height: 8, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#FF5C35", borderRadius: 4, width: `${Math.max(stage.count > 0 ? 4 : 0, Math.round((stage.count / funnelMax) * 100))}%` }} />
              </div>
              <div style={{ width: 28, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "#1D2433" }}>{stage.count}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Call Outcomes</div>
          {data.callOutcomes.length === 0 && <div style={{ fontSize: 12.5, color: "#9AA1AC" }}>No calls yet.</div>}
          {data.callOutcomes.map((d) => (
            <div key={d.key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1D2433", marginBottom: 5 }}>
                <span>{d.label}</span>
                <span style={{ fontWeight: 600 }}>{d.count}</span>
              </div>
              <div style={{ height: 7, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#3D9DA8", borderRadius: 4, width: `${Math.max(d.count > 0 ? 2 : 0, Math.round((d.count / outcomesMax) * 100))}%` }} />
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#9AA1AC", marginTop: 10 }}>
            {data.unattributedCallCount} call{data.unattributedCallCount === 1 ? "" : "s"} not yet linked to a job (see Call Logs
            &rsquo;s Unattributed tab) — included above, since disposition doesn&rsquo;t depend on job attribution.
          </div>
        </div>
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Calls by Recruiter</div>
        <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 10 }}>
          Avg Duration is computed over connected calls only (duration &gt; 0) — a not-connected call has no talk time to average in.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 10,
            padding: "8px 10px",
            fontSize: 11.5,
            fontWeight: 600,
            color: "#9AA1AC",
            textTransform: "uppercase",
            borderBottom: "1px solid #EEF0F4",
          }}
        >
          <div>Recruiter</div>
          <div>Total Calls</div>
          <div>Connected</div>
          <div>Avg Duration</div>
        </div>
        {data.callsByRecruiter.map((r) => (
          <div
            key={r.recruiterId}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr",
              gap: 10,
              alignItems: "center",
              padding: "10px 10px",
              borderBottom: "1px solid #F4F5F8",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{r.name}</div>
            <div style={{ fontSize: 13, color: "#1D2433" }}>{r.total}</div>
            <div style={{ fontSize: 13, color: "#1E7F43" }}>{r.connected}</div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{fmtDuration(r.avgDurationSeconds)}</div>
          </div>
        ))}
        {data.callsByRecruiter.length === 0 && <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "24px 0" }}>No recruiters found.</div>}
      </div>
    </div>
  );
}
