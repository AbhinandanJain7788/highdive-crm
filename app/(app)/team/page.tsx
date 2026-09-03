import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getTeamRows } from "@/lib/team";
import TeamClient from "./TeamClient";

export default async function TeamPage() {
  const profile = await getCurrentUserProfile();
  const supabase = await createClient();

  const [rows, rolesRes, processesRes] = await Promise.all([
    getTeamRows(supabase),
    supabase.from("roles").select("id, name, dot_color, badge_bg").order("name"),
    supabase.from("processes").select("id, name").order("name"),
  ]);

  return (
    <TeamClient
      initialRows={rows}
      roles={rolesRes.data ?? []}
      processes={processesRes.data ?? []}
      canManageTeam={!!profile?.permissions.includes("manage_team")}
    />
  );
}
