import { createClient } from "@/lib/supabase/server";
import { getUnassignedApplications, getWorkload } from "@/lib/assignment";
import AssignmentClient from "./AssignmentClient";

export default async function AssignmentPage() {
  const supabase = await createClient();
  const [applications, workload] = await Promise.all([
    getUnassignedApplications(supabase),
    getWorkload(supabase),
  ]);

  return <AssignmentClient initialApplications={applications} initialWorkload={workload} />;
}
