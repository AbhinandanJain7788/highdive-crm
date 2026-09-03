"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: (color: string) => React.ReactNode;
  // Permission key required to see this item. Omitted = visible to any signed-in user.
  permission?: string;
};

const navMain: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="1" y="1" width="6" height="6" rx="1" fill={c} />
        <rect x="9" y="1" width="6" height="6" rx="1" fill={c} />
        <rect x="1" y="9" width="6" height="6" rx="1" fill={c} />
        <rect x="9" y="9" width="6" height="6" rx="1" fill={c} />
      </svg>
    ),
  },
  {
    href: "/allocations",
    label: "Allocations",
    permission: "manage_allocations",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="4" cy="4" r="2.4" fill="none" stroke={c} strokeWidth="1.3" />
        <circle cx="12" cy="4" r="2.4" fill="none" stroke={c} strokeWidth="1.3" />
        <circle cx="8" cy="11" r="2.4" fill="none" stroke={c} strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    href: "/candidates",
    label: "Customers",
    permission: "manage_candidates",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="6" cy="6" r="3" fill="none" stroke={c} strokeWidth="1.4" />
        <circle cx="12" cy="7" r="2.2" fill="none" stroke={c} strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    href: "/interactions",
    label: "Interactions",
    permission: "manage_candidates",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="1.5" y="2" width="11" height="10" rx="1.5" fill="none" stroke={c} strokeWidth="1.4" />
        <line x1="4" y1="5.5" x2="10" y2="5.5" stroke={c} strokeWidth="1.3" />
        <line x1="4" y1="8.5" x2="8" y2="8.5" stroke={c} strokeWidth="1.3" />
        <circle cx="13" cy="12.5" r="2.4" fill="none" stroke={c} strokeWidth="1.3" />
        <line x1="13" y1="11.2" x2="13" y2="13.8" stroke={c} strokeWidth="1.2" />
        <line x1="11.7" y1="12.5" x2="14.3" y2="12.5" stroke={c} strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/follow-ups",
    label: "Follow-Ups",
    permission: "manage_follow_ups",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="1.5" y="3" width="13" height="11" rx="1.5" fill="none" stroke={c} strokeWidth="1.4" />
        <line x1="1.5" y1="6.4" x2="14.5" y2="6.4" stroke={c} strokeWidth="1.4" />
        <path d="M6 10l1.6 1.6L11 8.4" fill="none" stroke={c} strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    href: "/calendar",
    label: "Calendar",
    permission: "manage_follow_ups",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="1.5" y="3" width="13" height="11.5" rx="1.6" fill="none" stroke={c} strokeWidth="1.4" />
        <line x1="1.5" y1="6.6" x2="14.5" y2="6.6" stroke={c} strokeWidth="1.4" />
        <line x1="5" y1="1.5" x2="5" y2="4" stroke={c} strokeWidth="1.4" />
        <line x1="11" y1="1.5" x2="11" y2="4" stroke={c} strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    href: "/call-logs",
    label: "Call Logs",
    permission: "attribute_calls",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="4.5" y="1.5" width="7" height="13" rx="1.6" fill="none" stroke={c} strokeWidth="1.4" />
        <circle cx="8" cy="12" r="0.6" fill={c} />
      </svg>
    ),
  },
  {
    href: "/recurring-follow-ups",
    label: "Recurring Follow-Ups",
    permission: "manage_follow_ups",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="1.5" y="3" width="13" height="11" rx="1.5" fill="none" stroke={c} strokeWidth="1.4" />
        <line x1="1.5" y1="6.4" x2="14.5" y2="6.4" stroke={c} strokeWidth="1.4" />
        <path
          d="M6.2 9.6a1.8 1.8 0 113.1 1.3l-.9.9M9.8 10.6a1.8 1.8 0 11-3.1-1.3l.9-.9"
          fill="none"
          stroke={c}
          strokeWidth="1.1"
        />
      </svg>
    ),
  },
  {
    href: "/request-reports",
    label: "Request Reports",
    permission: "request_reports",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2.5" y="1.5" width="11" height="13" rx="1.4" fill="none" stroke={c} strokeWidth="1.4" />
        <line x1="5" y1="5" x2="11" y2="5" stroke={c} strokeWidth="1.2" />
        <line x1="5" y1="8" x2="11" y2="8" stroke={c} strokeWidth="1.2" />
        <line x1="5" y1="11" x2="9" y2="11" stroke={c} strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/rechurn",
    label: "Rechurn Customers",
    permission: "manage_rechurn",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path d="M2 8a6 6 0 019.6-4.8M14 8a6 6 0 01-9.6 4.8" fill="none" stroke={c} strokeWidth="1.4" />
        <path d="M11 1.8v2.6h-2.6M5 14.2v-2.6h2.6" fill="none" stroke={c} strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    href: "/team-live-status",
    label: "Team Live Status",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="6" cy="5.5" r="2.6" fill="none" stroke={c} strokeWidth="1.4" />
        <path d="M1.5 14c0-2.6 2-4.4 4.5-4.4S10.5 11.4 10.5 14" fill="none" stroke={c} strokeWidth="1.4" />
        <circle cx="12.5" cy="12" r="2" fill={c} />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    permission: "view_analytics",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2" y="9" width="3" height="5" fill={c} />
        <rect x="6.5" y="5" width="3" height="9" fill={c} />
        <rect x="11" y="2" width="3" height="12" fill={c} />
      </svg>
    ),
  },
];

const navTemplates: NavItem[] = [
  {
    href: "/whatsapp-templates",
    label: "Whatsapp",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6.4" fill="none" stroke={c} strokeWidth="1.3" />
        <path
          d="M5.5 6a1 1 0 011-1h.3c.3 0 .5.2.6.4l.4 1a.6.6 0 01-.1.6l-.3.3a4 4 0 002 2l.3-.3a.6.6 0 01.6-.1l1 .4c.2.1.4.3.4.6v.3a1 1 0 01-1 1c-2.8 0-5-2.2-5-5z"
          fill="none"
          stroke={c}
          strokeWidth="1"
        />
      </svg>
    ),
  },
];

const navConfiguration: NavItem[] = [
  {
    href: "/notifications",
    label: "Notifications",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path
          d="M8 1.5a3 3 0 0 0-3 3v2.2c0 .6-.2 1.2-.6 1.7L3 11h10l-1.4-2.1c-.4-.5-.6-1.1-.6-1.7V4.5a3 3 0 0 0-3-3z"
          fill="none"
          stroke={c}
          strokeWidth="1.3"
        />
        <path d="M6.4 13.2a1.7 1.7 0 003.2 0" fill="none" stroke={c} strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    href: "/data-management",
    label: "Data Management",
    permission: "bulk_import",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <ellipse cx="8" cy="3.4" rx="5.5" ry="1.8" fill="none" stroke={c} strokeWidth="1.3" />
        <path d="M2.5 3.4v9.2c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8V3.4" fill="none" stroke={c} strokeWidth="1.3" />
        <path d="M2.5 8c0 1 2.5 1.8 5.5 1.8s5.5-.8 5.5-1.8" fill="none" stroke={c} strokeWidth="1.3" />
      </svg>
    ),
  },
];

const navAdministration: NavItem[] = [
  {
    href: "/team",
    label: "Team",
    permission: "manage_team",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="6" cy="5.5" r="2.6" fill="none" stroke={c} strokeWidth="1.4" />
        <path d="M1.5 14c0-2.6 2-4.4 4.5-4.4S10.5 11.4 10.5 14" fill="none" stroke={c} strokeWidth="1.4" />
        <circle cx="12" cy="6.5" r="1.9" fill="none" stroke={c} strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    href: "/roles-permissions",
    label: "Roles & Permissions",
    permission: "manage_roles_permissions",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="6" cy="5.5" r="2.4" fill="none" stroke={c} strokeWidth="1.3" />
        <path d="M2 13.5c0-2.4 1.8-4 4-4s4 1.6 4 4" fill="none" stroke={c} strokeWidth="1.3" />
        <circle cx="12" cy="9" r="1.6" fill="none" stroke={c} strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (c) => (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="5" fill="none" stroke={c} strokeWidth="1.4" />
        <circle cx="8" cy="8" r="1.6" fill={c} />
      </svg>
    ),
  },
];

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const color = active ? "#FF5C35" : "#8A93A3";
  return (
    <Link
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 10px",
        borderRadius: 6,
        cursor: "pointer",
        marginBottom: 2,
        background: active ? "#FFF0EA" : "transparent",
        color: active ? "#FF5C35" : "#4B5565",
        fontWeight: active ? 600 : 500,
        textDecoration: "none",
      }}
    >
      {item.icon(color)}
      <span style={{ fontSize: 13.5 }}>{item.label}</span>
    </Link>
  );
}

type SidebarProps = {
  permissions: string[];
  roleName: string;
};

export default function Sidebar({ permissions, roleName }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");
  const visible = (item: NavItem) => !item.permission || permissions.includes(item.permission);

  return (
    <div
      style={{
        width: 216,
        flexShrink: 0,
        background: "#FFFFFF",
        borderRight: "1px solid #E7E9EE",
        display: "flex",
        flexDirection: "column",
        padding: "18px 12px",
        overflowY: "auto",
        minHeight: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "0 10px 20px" }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#FF5C35", letterSpacing: -0.5 }}>
          High Dive
        </span>
      </div>

      {navMain.filter(visible).map((item) => (
        <NavRow key={item.href} item={item} active={isActive(item.href)} />
      ))}

      <div style={{ fontSize: 11, fontWeight: 700, color: "#FF5C35", letterSpacing: 0.6, padding: "16px 10px 6px" }}>
        TEMPLATES
      </div>
      {navTemplates.filter(visible).map((item) => (
        <NavRow key={item.href} item={item} active={isActive(item.href)} />
      ))}

      <div style={{ fontSize: 11, fontWeight: 700, color: "#FF5C35", letterSpacing: 0.6, padding: "16px 10px 6px" }}>
        CONFIGURATION
      </div>
      {navConfiguration.filter(visible).map((item) => (
        <NavRow key={item.href} item={item} active={isActive(item.href)} />
      ))}

      <div style={{ fontSize: 11, fontWeight: 700, color: "#FF5C35", letterSpacing: 0.6, padding: "16px 10px 6px" }}>
        ADMINISTRATION
      </div>
      {navAdministration.filter(visible).map((item) => (
        <NavRow key={item.href} item={item} active={isActive(item.href)} />
      ))}

      <div
        style={{
          marginTop: "auto",
          padding: "10px 10px 4px",
          fontSize: 11,
          color: "#9AA1AC",
          borderTop: "1px solid #EEF0F4",
          paddingTop: 14,
        }}
      >
        Signed in as
      </div>
      <div style={{ padding: "0 10px", fontSize: 12.5, fontWeight: 600, color: "#4B5565" }}>
        {roleName}
      </div>
    </div>
  );
}
