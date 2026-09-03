import { createClient } from "@/lib/supabase/server";
import { getAllocationRows, getAllocationBucketCounts } from "@/lib/allocations";
import { DEFAULT_PAGE_SIZE } from "@/lib/format";
import AllocationsClient from "./AllocationsClient";

// Server-renders the "New" tab's first page plus both bucket counts; the client
// component refetches through /api/allocations as filters/tabs change. Recruiter
// scoping is RLS's job, same convention as Candidates/Jobs/Clients.
export default async function AllocationsPage() {
  const supabase = await createClient();
  const pagination = { page: 1, pageSize: DEFAULT_PAGE_SIZE, from: 0, to: DEFAULT_PAGE_SIZE - 1 };
  const [{ rows, total }, counts] = await Promise.all([
    getAllocationRows(supabase, { bucket: "new", sort: "created-new", pagination }),
    getAllocationBucketCounts(supabase, {}),
  ]);

  return <AllocationsClient initialRows={rows} initialTotal={total} initialCounts={counts} />;
}
