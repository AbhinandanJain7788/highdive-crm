// Types shared by the server query module and client components — free of
// `server-only`/Supabase imports, same reason as lib/allocations.shared.ts.
import type { Database } from "@/types/supabase";

export type ApplicationStatus = Database["public"]["Enums"]["application_status"];

// Same 3 statuses lib/mock's rechurn page actually computes against (RECHURN_ELIGIBLE_STATUSES),
// despite its "Select Status" dropdown listing all 9 — rechurn is candidates who fell
// through, not an arbitrary status filter. Kept identical in the real implementation
// (claude.md Phase 6 As-Built Notes documents this as matching the mock's actual, not
// apparent, behavior).
export const RECHURN_ELIGIBLE_STATUSES: ApplicationStatus[] = ["no_response", "not_interested", "rejected"];

export type RechurnDateBasis = "created_date" | "last_interaction";

export type RechurnFilters = {
  status?: ApplicationStatus;
  dateBasis: RechurnDateBasis;
  dateFrom?: string;
  dateTo?: string;
};

export type RechurnMatch = {
  applicationId: string;
  candidateId: string;
  name: string;
  phone: string;
  currentRecruiterId: string | null;
};
