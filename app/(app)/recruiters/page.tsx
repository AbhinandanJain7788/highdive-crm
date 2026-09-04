import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getRecruiterRows } from "@/lib/recruiters";
import { liveStatusColors, liveStatusLabels } from "@/lib/mock";

const gridTemplateColumns = "2fr 1.2fr 1fr 1fr 1fr";

export default async function RecruitersListPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const profile = await getCurrentUserProfile();

  // RLS scopes `assignments` reads to the assignment's own recruiter, so without
  // view_all_records this board would render every colleague at 0 assigned / 0%.
  // Say so rather than showing numbers that are quietly wrong.
  if (!profile?.permissions.includes("view_all_records")) {
    return (
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E7E9EE",
          borderRadius: 10,
          padding: 40,
          textAlign: "center",
          color: "#6B7280",
          fontSize: 13.5,
        }}
      >
        The recruiter directory is only available to users who can view all records.
      </div>
    );
  }

  const supabase = await createClient();
  const rows = await getRecruiterRows(supabase, { search });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>{rows.length} Recruiters</div>
        <form method="get" style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid #D9DCE3", borderRadius: 7, padding: "8px 12px", maxWidth: 260 }}>
          <input
            type="text"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search name or email"
            style={{ border: "none", outline: "none", fontSize: 13, color: "#1D2433", flex: 1, background: "transparent" }}
          />
          <button type="submit" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }} aria-label="Search">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
              <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#9AA1AC" strokeWidth="1.4" />
            </svg>
          </button>
        </form>
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
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: liveStatusColors[r.liveStatus ?? "offline"],
                  display: "inline-block",
                }}
              />
              {liveStatusLabels[r.liveStatus ?? "offline"]}
            </div>
            <div style={{ fontSize: 13, color: "#1D2433" }}>{r.assignedCount}</div>
            {/* TODO(phase-5): call metrics come from the `calls` table. Until that's
                wired, this renders "--" rather than a fabricated 0. */}
            <div style={{ fontSize: 13, color: "#9AA1AC" }} title="Wired in Phase 5">
              {r.callsToday ?? "--"}
            </div>
            <div style={{ fontSize: 13, color: "#1D2433" }}>{r.conversion}%</div>
          </Link>
        ))}
        {rows.length === 0 && (
          <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
            No recruiters found.
          </div>
        )}
      </div>
    </div>
  );
}
