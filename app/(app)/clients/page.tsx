import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClientRows } from "@/lib/clients";
import { DEFAULT_PAGE_SIZE } from "@/lib/format";

const gridTemplateColumns = "2fr 1.4fr 1.4fr 1fr 1.2fr";

// "Active Jobs" counts only `status='open'` — on_hold and closed are excluded, and
// that rule lives in lib/clients.ts so the list and the API can't drift apart.
export default async function ClientsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const pageNumber = Math.max(1, Number(page) || 1);
  const from = (pageNumber - 1) * DEFAULT_PAGE_SIZE;

  const supabase = await createClient();
  const { rows, total } = await getClientRows(supabase, {
    pagination: { page: pageNumber, pageSize: DEFAULT_PAGE_SIZE, from, to: from + DEFAULT_PAGE_SIZE - 1 },
  });

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>{total} Clients</div>
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
          <div>Company</div>
          <div>Contact</div>
          <div>Industry</div>
          <div>Active Jobs</div>
          <div>Account Manager</div>
        </div>
        {rows.map((k) => (
          <Link
            key={k.id}
            href={`/clients/${k.id}`}
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
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{k.company}</div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{k.contactName ?? "--"}</div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{k.industry ?? "--"}</div>
            <div style={{ fontSize: 13, color: "#1D2433" }}>{k.activeJobs}</div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{k.accountManager ?? "--"}</div>
          </Link>
        ))}
        {rows.length === 0 && (
          <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>No clients yet.</div>
        )}
      </div>
    </div>
  );
}
