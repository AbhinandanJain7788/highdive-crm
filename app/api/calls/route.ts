import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getCallRows, type CallListOptions } from "@/lib/calls";
import { readPagination } from "@/lib/format";
import type { Database } from "@/types/supabase";

type CallDirection = Database["public"]["Enums"]["call_direction"];
type CallDisposition = Database["public"]["Enums"]["call_disposition"];
const DIRECTIONS: CallDirection[] = ["outbound", "inbound"];
const DISPOSITIONS: CallDisposition[] = ["interested", "callback_later", "not_reachable"];
type SortKey = NonNullable<CallListOptions["sort"]>;
const SORT_KEYS: SortKey[] = ["called-new", "called-old", "name-asc", "name-desc"];

// GET /api/calls — call logs, filterable (claude.md API structure). Any signed-in
// user may call it; RLS (calls_select) is what actually scopes a recruiter to their
// own calls — never re-filtered here, same rule Phase 3 established for candidates.
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const directionParam = searchParams.get("direction");
  const dispositionParam = searchParams.get("disposition");
  const sortParam = searchParams.get("sort");
  const connectedParam = searchParams.get("connected");
  const userIds = searchParams
    .getAll("byUser")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);

  const supabase = await createClient();
  try {
    const { rows, total } = await getCallRows(supabase, {
      search: searchParams.get("search") ?? undefined,
      direction: DIRECTIONS.includes(directionParam as CallDirection) ? (directionParam as CallDirection) : undefined,
      disposition: DISPOSITIONS.includes(dispositionParam as CallDisposition)
        ? (dispositionParam as CallDisposition)
        : undefined,
      connected: connectedParam === "true" ? true : connectedParam === "false" ? false : undefined,
      userIds: userIds.length ? userIds : undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      sort: SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : undefined,
      pagination: readPagination(searchParams),
    });
    return NextResponse.json({ data: rows, total });
  } catch (err) {
    console.error("GET /api/calls failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load call logs." } }, { status: 500 });
  }
}
