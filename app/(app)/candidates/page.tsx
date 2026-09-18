import { createClient } from "@/lib/supabase/server";
import { getCandidateRows } from "@/lib/candidates";
import { DEFAULT_PAGE_SIZE } from "@/lib/format";
import CandidatesClient from "./CandidatesClient";

// Server-renders the first page so the table has real rows on load; the client
// component refetches through /api/candidates as filters change. Recruiter scoping
// is RLS's job in both paths — never a filter applied here.
//
// assignedOnly: true must match GET /api/candidates's own hardcoded default (see
// that route's comment) — this is the *first* paint, before any client-side filter
// change fires the effect that would otherwise apply it. Without this, a page load
// or plain refresh briefly (until a filter changes) showed every unassigned
// candidate too, which is exactly what made a working "assign" action look like it
// had done nothing.
export default async function CandidatesListPage() {
  const supabase = await createClient();
  const { rows, total } = await getCandidateRows(supabase, {
    assignedOnly: true,
    sort: "created-new",
    pagination: { page: 1, pageSize: DEFAULT_PAGE_SIZE, from: 0, to: DEFAULT_PAGE_SIZE - 1 },
  });

  return <CandidatesClient initialRows={rows} initialTotal={total} />;
}
