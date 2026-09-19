import Link from "next/link";
import AddCustomerButton from "@/components/AddCustomerButton";

type TopbarProps = {
  userName: string;
  roleName: string;
  permissions: string[];
};

export default function Topbar({ userName, roleName, permissions }: TopbarProps) {
  const initial = userName.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      style={{
        height: 60,
        flexShrink: 0,
        background: "#FFFFFF",
        borderBottom: "1px solid #E7E9EE",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 24px",
      }}
    >
      <div style={{ flex: 1 }} />
      {permissions.includes("manage_candidates") && <AddCustomerButton />}
      <Link
        href="/notifications"
        title="Notifications"
        aria-label="Notifications"
        style={{
          position: "relative",
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid #E7E9EE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          textDecoration: "none",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            d="M8 2a3 3 0 0 0-3 3v2.2c0 .6-.2 1.2-.6 1.7L3 11h10l-1.4-2.1c-.4-.5-.6-1.1-.6-1.7V5a3 3 0 0 0-3-3z"
            fill="none"
            stroke="#4B5565"
            strokeWidth="1.3"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#FF5C35",
            border: "1.5px solid #FFFFFF",
          }}
        />
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", paddingLeft: 6 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "#FF5C35",
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {initial}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433", lineHeight: 1.2 }}>
            {userName}
          </div>
          <div style={{ fontSize: 11.5, color: "#9AA1AC", lineHeight: 1.2 }}>{roleName}</div>
        </div>
      </div>
    </div>
  );
}
