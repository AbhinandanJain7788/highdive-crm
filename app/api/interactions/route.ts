import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { APPLICATION_STATUSES } from "@/lib/candidates";
import { getInteractionRows, type InteractionListOptions } from "@/lib/interactions";
import { readPagination } from "@/lib/format";
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];
type SortKey = NonNullable<InteractionListOptions["sort"]>;
const SORT_KEYS: SortKey[] = ["name-asc", "name-desc", "interacted-new", "interacted-old"];

// GET /api/interactions — v_interactions, scoped by RLS same as calls/candidates
// (claude.md API structure: "any (scoped)"). The view itself already filters to
// candidates with >=1 call and excludes soft-deleted candidates (Phase 4).
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statuses = searchParams
    .getAll("status")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v): v is ApplicationStatus => APPLICATION_STATUSES.includes(v as ApplicationStatus));
  const sortParam = searchParams.get("sort");

  const supabase = await createClient();
  try {
    const { rows, total } = await getInteractionRows(supabase, {
      search: searchParams.get("search") ?? undefined,
      statuses,
      interactedFrom: searchParams.get("interactedFrom") ?? undefined,
      interactedTo: searchParams.get("interactedTo") ?? undefined,
      sort: SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : undefined,
      pagination: readPagination(searchParams),
    });
    return NextResponse.json({ data: rows, total });
  } catch (err) {
    console.error("GET /api/interactions failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load interactions." } }, { status: 500 });
  }
}
