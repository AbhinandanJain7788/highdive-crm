import { createClient } from "@/lib/supabase/server";
import { getFollowUpRows, getFollowUpBucketCounts } from "@/lib/followups";
import { PAGE_SIZES } from "@/lib/followups.shared";
import RecurringFollowUpsClient from "./RecurringFollowUpsClient";

// Server-renders every is_recurring=true follow_ups row plus Pending/Upcoming
// counts, mirroring GET /api/follow-ups/recurring exactly (claude.md API
// structure). The signed-off HTML defines no rows-per-page control here either
// (same as /follow-ups), so this requests the largest page size instead of
// adding new pager UI.
export default async function RecurringFollowUpsPage() {
  const supabase = await createClient();
  const pageSize = PAGE_SIZES[PAGE_SIZES.length - 1];
  const pagination = { page: 1, pageSize, from: 0, to: pageSize - 1 };
  const options = { isRecurring: true as const };
  const [{ rows }, counts] = await Promise.all([
    getFollowUpRows(supabase, { ...options, sort: "due-asc", pagination }),
    getFollowUpBucketCounts(supabase, options),
  ]);

  return <RecurringFollowUpsClient initialRows={rows} initialCounts={counts} />;
}
