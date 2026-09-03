import Link from "next/link";
import { callLogsSeed, candidatesSeed, liveStatusColors, liveStatusLabels, recruiters } from "@/lib/mock";

const gridTemplateColumns = "2fr 1.2fr 1fr 1fr 1fr";

export default function RecruitersListPage() {
  const rows = recruiters.map((r) => {
    const assigned = candidatesSeed.filter((c) => c.recruiterId === r.id);
    const converted = assigned.filter((c) => c.status === "selected" || c.status === "joined");
    const conversion = assigned.length ? Math.round((converted.length / assigned.length) * 100) : 0;
    const callsToday = callLogsSeed.filter((l) => l.byUserId === r.id).length;
    const dotColor = liveStatusColors[r.liveStatus ?? "offline"];
    const liveStatusLabel = liveStatusLabels[r.liveStatus ?? "offline"];
    return { ...r, assignedCount: assigned.length, callsToday, conversion, dotColor, liveStatusLabel };
  });

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>
        {recruiters.length} Recruiters
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
          <div>Recruiter</div>
          <div>Live Status</div>
          <div>Assigned</div>
          <div>Calls Today</div>
          <div>Conversion</div>
        </div>
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/recruiters/${r.id}`}
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
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{r.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#4B5565" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.dotColor, display: "inline-block" }} />
              {r.liveStatusLabel}
            </div>
            <div style={{ fontSize: 13, color: "#1D2433" }}>{r.assignedCount}</div>
            <div style={{ fontSize: 13, color: "#1D2433" }}>{r.callsToday}</div>
            <div style={{ fontSize: 13, color: "#1D2433" }}>{r.conversion}%</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
