import Link from "next/link";
import { clientsSeed, jobsSeed, usersSeed } from "@/lib/mock";

const gridTemplateColumns = "2fr 1.4fr 1.4fr 1fr 1.2fr";

export default function ClientsListPage() {
  const userNameById = new Map(usersSeed.map((u) => [u.id, u.name]));

  const rows = clientsSeed.map((k) => ({
    ...k,
    activeJobs: jobsSeed.filter((j) => j.clientId === k.id && j.status === "open").length,
    accountManager: userNameById.get(k.accountManagerId) ?? "",
  }));

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>
        {clientsSeed.length} Clients
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
            <div style={{ fontSize: 13, color: "#4B5565" }}>{k.contactName}</div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{k.industry}</div>
            <div style={{ fontSize: 13, color: "#1D2433" }}>{k.activeJobs}</div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{k.accountManager}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
