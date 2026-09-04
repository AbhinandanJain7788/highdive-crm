import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getJobRows } from "@/lib/jobs";
import { DEFAULT_PAGE_SIZE } from "@/lib/format";
import { jobStatusLabels, jobStatusStyle } from "@/lib/mock";

const gridTemplateColumns = "2fr 1.4fr 1fr 0.9fr 1fr 1fr";

// Server component reading live jobs through the RLS-respecting client, same
// pattern as Team and Roles & Permissions. `jobStatusLabels`/`jobStatusStyle` stay
// imported from lib/mock — they're presentation maps keyed by the real `job_status`
// enum, not seed data.
export default async function JobsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const { page, search } = await searchParams;
  const pageNumber = Math.max(1, Number(page) || 1);
  const from = (pageNumber - 1) * DEFAULT_PAGE_SIZE;

  const supabase = await createClient();
  const { rows, total } = await getJobRows(supabase, {
    search,
    pagination: { page: pageNumber, pageSize: DEFAULT_PAGE_SIZE, from, to: from + DEFAULT_PAGE_SIZE - 1 },
  });

  const lastPage = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>{total} Jobs</div>
        <form method="get" style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid #D9DCE3", borderRadius: 7, padding: "8px 12px", maxWidth: 260 }}>
          <input
            type="text"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search job title"
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
          <div>Job Title</div>
          <div>Client</div>
          <div>Status</div>
          <div>Openings</div>
          <div>Applications</div>
          <div>Created On</div>
        </div>
        {rows.map((j) => {
          const { bg: statusBg, color: statusColor } = jobStatusStyle(j.status);
          return (
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
              <div style={{ fontSize: 13, color: "#4B5565" }}>{j.clientName ?? "--"}</div>
              <div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: statusBg,
                    color: statusColor,
                  }}
                >
                  {jobStatusLabels[j.status]}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#1D2433" }}>{j.openings}</div>
              <div style={{ fontSize: 13, color: "#1D2433" }}>{j.applicationCount}</div>
              <div style={{ fontSize: 12.5, color: "#9AA1AC" }}>{j.createdOn}</div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
            {search ? "No jobs match your search." : "No jobs yet."}
          </div>
        )}
      </div>

      {lastPage > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
          <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>
            Page {pageNumber} of {lastPage}
          </span>
          {pageNumber > 1 && (
            <Link href={`/jobs?page=${pageNumber - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`} style={pagerStyle}>
              ← Prev
            </Link>
          )}
          {pageNumber < lastPage && (
            <Link href={`/jobs?page=${pageNumber + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`} style={pagerStyle}>
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

const pagerStyle = {
  background: "#FFFFFF",
  border: "1px solid #D9DCE3",
  color: "#1D2433",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12.5,
  fontWeight: 600,
  textDecoration: "none",
} as const;
