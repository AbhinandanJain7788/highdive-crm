type TopbarProps = {
  userName: string;
  roleName: string;
};

export default function Topbar({ userName, roleName }: TopbarProps) {
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
      <svg width="18" height="18" viewBox="0 0 18 18">
        <rect x="1" y="3" width="16" height="1.6" fill="#6B7280" />
        <rect x="1" y="8.2" width="16" height="1.6" fill="#6B7280" />
        <rect x="1" y="13.4" width="16" height="1.6" fill="#6B7280" />
      </svg>
      <div
        style={{
          flex: 1,
          maxWidth: 360,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#F4F5F8",
          border: "1px solid #E7E9EE",
          borderRadius: 7,
          padding: "8px 12px",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14">
          <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
          <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#9AA1AC" strokeWidth="1.4" />
        </svg>
        <span style={{ fontSize: 13, color: "#9AA1AC" }}>Search by Name/Phone</span>
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid #E7E9EE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <line x1="8" y1="2" x2="8" y2="14" stroke="#4B5565" strokeWidth="1.6" />
          <line x1="2" y1="8" x2="14" y2="8" stroke="#4B5565" strokeWidth="1.6" />
        </svg>
      </div>
      <div
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
      </div>
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
