// Types shared by the server query module and the client component — kept free of
// `server-only` and Supabase imports for the same reason as candidates.shared.ts.
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export type AllocationBucket = "new" | "attempted";

export type AllocationRow = {
  applicationId: string;
  candidateId: string;
  name: string;
  phone: string;
  status: ApplicationStatus | null;
  jobId: string | null;
  jobTitle: string | null;
  createdOn: string;
  createdAt: string;
  createdById: string | null;
  createdByName: string | null;
  assignToId: string | null;
  assignToName: string | null;
  sourcedById: string | null;
  sourcedByName: string | null;
};
