import { createClient } from "@/lib/supabase/server";
import { getInteractionRows } from "@/lib/interactions";
import { DEFAULT_PAGE_SIZE } from "@/lib/interactions.shared";
import InteractionsClient from "./InteractionsClient";

// Server-renders the first page off v_interactions directly (claude.md: query the
// view, don't reimplement its bucket logic); the client component refetches
// through /api/interactions as filters/sort/paging change. RLS scopes the view
// itself, same convention as every list screen since Phase 3.
export default async function InteractionsPage() {
  const supabase = await createClient();
  const pagination = { page: 1, pageSize: DEFAULT_PAGE_SIZE, from: 0, to: DEFAULT_PAGE_SIZE - 1 };
  const { rows, total } = await getInteractionRows(supabase, { sort: "interacted-new", pagination });
  return <InteractionsClient initialRows={rows} initialTotal={total} />;
}
