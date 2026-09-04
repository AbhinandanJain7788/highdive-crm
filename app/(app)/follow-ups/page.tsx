import { createClient } from "@/lib/supabase/server";
import { getFollowUpRows, getFollowUpBucketCounts } from "@/lib/followups";
import { PAGE_SIZES } from "@/lib/followups.shared";
import FollowUpsClient from "./FollowUpsClient";

// Server-renders the Pending tab's first page plus both bucket counts; the client
// component refetches through /api/follow-ups as the tab/filters change. The
// signed-off HTML has no rows-per-page control on this screen, so the list always
// requests the largest page size (50) rather than adding new pager UI.
export default async function FollowUpsPage() {
  const supabase = await createClient();
  const pageSize = PAGE_SIZES[PAGE_SIZES.length - 1];
  const pagination = { page: 1, pageSize, from: 0, to: pageSize - 1 };
  const [{ rows }, counts] = await Promise.all([
    getFollowUpRows(supabase, { bucket: "pending", sort: "due-asc", pagination }),
    getFollowUpBucketCounts(supabase, {}),
  ]);

  return <FollowUpsClient initialRows={rows} initialCounts={counts} />;
}
