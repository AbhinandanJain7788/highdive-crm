import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getRecruiterRows } from "@/lib/recruiters";
import RechurnClient from "./RechurnClient";

export default async function RechurnPage() {
  const profile = await getCurrentUserProfile();
  if (!profile?.permissions.includes("manage_rechurn")) {
    return (
      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 40, textAlign: "center", color: "#6B7280", fontSize: 13.5 }}>
        Rechurn requires the manage_rechurn permission.
      </div>
    );
  }

  const supabase = await createClient();
  const recruiters = await getRecruiterRows(supabase);

  return <RechurnClient recruiters={recruiters.map((r) => ({ id: r.id, name: r.name }))} canCommonPool={profile.permissions.includes("bulk_import")} />;
}
