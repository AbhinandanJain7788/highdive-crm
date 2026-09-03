import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { ROLE_SELECT, shapeRole } from "@/lib/roles";
import RolesPermissionsClient from "./RolesPermissionsClient";

// Server component: fetches roles (+ permission chips + user counts) and the
// full permissions catalog directly via the RLS-respecting Supabase client,
// same pattern the (app) layout already uses for the sidebar/profile.
export default async function RolesPermissionsPage() {
  const supabase = await createClient();

  const [profile, rolesResult, permissionsResult] = await Promise.all([
    getCurrentUserProfile(),
    supabase.from("roles").select(ROLE_SELECT).order("created_at", { ascending: true }),
    supabase.from("permissions").select("id, key, label, category").order("category", { ascending: true }).order("label", { ascending: true }),
  ]);

  const roles = (rolesResult.data ?? []).map(shapeRole);
  const permissions = permissionsResult.data ?? [];
  const canManage = profile?.permissions.includes("manage_roles_permissions") ?? false;

  return <RolesPermissionsClient initialRoles={roles} permissions={permissions} canManage={canManage} />;
}
