import "server-only";

// Shared shaping for the `roles` (+ role_permissions + permissions + users
// count) query used by GET /api/roles and GET /api/roles/:id. Kept in one
// place so both routes render the exact same shape the Roles & Permissions
// screen expects.

export const ROLE_SELECT =
  "id, name, dot_color, badge_bg, is_system, created_at, role_permissions(permissions(key, label)), users(count)";

export type RolePermission = { key: string; label: string };

export type RoleWithPermissions = {
  id: string;
  name: string;
  dotColor: string | null;
  badgeBg: string | null;
  isSystem: boolean;
  createdAt: string;
  permissions: RolePermission[];
  permissionKeys: string[];
  userCount: number;
};

type RawRole = {
  id: string;
  name: string;
  dot_color: string | null;
  badge_bg: string | null;
  is_system: boolean;
  created_at: string;
  role_permissions: { permissions: { key: string; label: string } | null }[] | null;
  users: { count: number }[] | null;
};

export function shapeRole(row: RawRole): RoleWithPermissions {
  const permissions = (row.role_permissions ?? [])
    .map((rp) => rp.permissions)
    .filter((p): p is { key: string; label: string } => Boolean(p));

  return {
    id: row.id,
    name: row.name,
    dotColor: row.dot_color,
    badgeBg: row.badge_bg,
    isSystem: row.is_system,
    createdAt: row.created_at,
    permissions,
    permissionKeys: permissions.map((p) => p.key),
    userCount: row.users?.[0]?.count ?? 0,
  };
}
