import { createClient } from "@/lib/supabase/server";
import { getCandidateRows } from "@/lib/candidates";
import { DEFAULT_PAGE_SIZE } from "@/lib/format";
import CandidatesClient from "./CandidatesClient";

// Server-renders the first page so the table has real rows on load; the client
// component refetches through /api/candidates as filters change. Recruiter scoping
// is RLS's job in both paths — never a filter applied here.
export default async function CandidatesListPage() {
  const supabase = await createClient();
  const { rows, total } = await getCandidateRows(supabase, {
    sort: "created-new",
    pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE, from: 0, to: DEFAULT_PAGE_SIZE - 1 },
  });

  return <CandidatesClient initialRows={rows} initialTotal={total} />;
}
