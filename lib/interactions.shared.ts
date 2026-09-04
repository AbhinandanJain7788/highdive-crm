// Types shared by the server query module and client components — free of
// `server-only`/Supabase imports, same reason as lib/allocations.shared.ts.
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

export const PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 25;

// Mirrors v_interactions' own columns (candidates with >=1 call, one row per
// application — claude.md: "Allocations, Interactions, and Rechurn are derived
// views, not tables. ... Implement as SQL views or query filters. Do not create
// tables for them" and "do not reimplement the filter in application code").
export type InteractionRow = {
  candidateId: string;
  applicationId: string;
  name: string;
  phone: string;
  status: ApplicationStatus | null;
  interactedOn: string;
  interactedOnRaw: string | null;
  sourcedById: string | null;
  sourcedByName: string | null;
  assignedById: string | null;
  assignedByName: string | null;
  assignToId: string | null;
  assignToName: string | null;
};
