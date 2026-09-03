// TODO(phase-6): this whole page — Pipeline Funnel, Call Outcomes, and Calls by
// Recruiter — is still mock data, including computeStageCounts' hardcoded stage
// names. Phase 6 (Dashboard & Analytics) wires it to real applications/calls and
// should read pipeline stage names from pipeline_stages, not lib/mock/pipeline.ts.
import { callLogsSeed, candidatesSeed, computeStageCounts, dispositionStyles, fmtDuration, recruiters } from "@/lib/mock";

const dispositions: Array<keyof typeof dispositionStyles> = ["Connected", "Not Connected", "Busy", "Switched Off"];

export default function ReportsPage() {
  const stageCounts = computeStageCounts(candidatesSeed);

  const callVolumeByDisposition = dispositions.map((d) => {
    const count = callLogsSeed.filter((l) => l.disposition === d).length;
    const pct = `${Math.max(2, Math.round((count / callLogsSeed.length) * 100))}%`;
    return { label: d, count, pct, color: dispositionStyles[d].color };
  });

  const callsByRecruiter = recruiters.map((r) => {
    const rCalls = callLogsSeed.filter((l) => l.byUserId === r.id);
    const connected = rCalls.filter((l) => l.disposition === "Connected").length;
    const avg = rCalls.length ? Math.round(rCalls.reduce((a, l) => a + l.durationSeconds, 0) / rCalls.length) : 0;
    return { name: r.name, total: rCalls.length, connected, avgDurationLabel: fmtDuration(avg) };
  });

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>Reports</div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Pipeline Funnel</div>
          {stageCounts.map((stage) => (
            <div key={stage.stage} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 130, fontSize: 12.5, color: "#4B5565", flexShrink: 0 }}>{stage.stage}</div>
              <div style={{ flex: 1, height: 8, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#FF5C35", borderRadius: 4, width: stage.pct }} />
              </div>
              <div style={{ width: 28, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "#1D2433" }}>
                {stage.count}
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Call Outcomes</div>
          {callVolumeByDisposition.map((d) => (
            <div key={d.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1D2433", marginBottom: 5 }}>
                <span>{d.label}</span>
                <span style={{ fontWeight: 600 }}>{d.count}</span>
              </div>
              <div style={{ height: 7, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: d.color, borderRadius: 4, width: d.pct }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Calls by Recruiter</div>
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
        {callsByRecruiter.map((r) => (
          <div
            key={r.name}
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
            <div style={{ fontSize: 13, color: "#4B5565" }}>{r.avgDurationLabel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
