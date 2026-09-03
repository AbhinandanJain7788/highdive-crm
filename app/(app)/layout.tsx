import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { getCurrentUserProfile } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware already gates this route group, but a server-rendered layout
  // guards independently too, matching the RLS-and-app-guard "both required" rule.
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/login");

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#F4F5F8" }}>
      <Sidebar permissions={profile.permissions} roleName={profile.roleName ?? "—"} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar userName={profile.name} roleName={profile.roleName ?? "—"} />
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}
