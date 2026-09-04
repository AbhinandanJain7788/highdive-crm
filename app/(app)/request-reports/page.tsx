import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { listReportRequests } from "@/lib/reportRequests";
import RequestReportsClient from "./RequestReportsClient";

export default async function RequestReportsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile?.permissions.includes("request_reports")) {
    return (
      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 40, textAlign: "center", color: "#6B7280", fontSize: 13.5 }}>
        Requesting reports requires the request_reports permission.
      </div>
    );
  }

  const supabase = await createClient();
  const history = await listReportRequests(supabase);

  return <RequestReportsClient initialHistory={history} />;
}
