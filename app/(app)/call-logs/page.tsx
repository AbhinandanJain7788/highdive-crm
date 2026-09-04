import { createClient } from "@/lib/supabase/server";
import { getCallRows, getUnattributedCalls } from "@/lib/calls";
import { DEFAULT_PAGE_SIZE } from "@/lib/calls.shared";
import CallLogsClient from "./CallLogsClient";

// Server-renders the "All" tab's first page plus the unattributed queue (used for
// the tab's own count and its first render); the client component refetches
// through /api/calls and /api/calls/unattributed as filters/tabs change. Recruiter
// scoping is RLS's job, same convention as every other list screen since Phase 3.
export default async function CallLogsPage() {
  const supabase = await createClient();
  const pagination = { page: 1, pageSize: DEFAULT_PAGE_SIZE, from: 0, to: DEFAULT_PAGE_SIZE - 1 };
  const unattributedPagination = { page: 1, pageSize: DEFAULT_PAGE_SIZE, from: 0, to: DEFAULT_PAGE_SIZE - 1 };

  const [{ rows, total }, unattributed] = await Promise.all([
    getCallRows(supabase, { sort: "called-new", pagination }),
    getUnattributedCalls(supabase, { pagination: unattributedPagination }),
  ]);

  return (
    <CallLogsClient
      initialRows={rows}
      initialTotal={total}
      initialUnattributedRows={unattributed.rows}
      initialUnattributedTotal={unattributed.total}
    />
  );
}
