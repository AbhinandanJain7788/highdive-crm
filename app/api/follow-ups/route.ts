import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, requirePermission } from "@/lib/permissions";
import { APPLICATION_STATUSES } from "@/lib/candidates";
import { getFollowUpRows, getFollowUpBucketCounts, createFollowUp, type FollowUpListOptions } from "@/lib/followups";
import { readPagination } from "@/lib/format";
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];
type SortKey = NonNullable<FollowUpListOptions["sort"]>;
const SORT_KEYS: SortKey[] = ["due-asc", "due-desc", "name-asc", "name-desc"];
const BUCKETS = ["pending", "upcoming"] as const;

// GET /api/follow-ups — list (pending|upcoming) (claude.md API structure).
// RLS (follow_ups_select) scopes this to view_all_records holders, the row's own
// assign_to, or anyone holding the assignment on its application.
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const bucketParam = searchParams.get("bucket");
  const bucket = (BUCKETS as readonly string[]).includes(bucketParam ?? "")
    ? (bucketParam as "pending" | "upcoming")
    : undefined;
  const statuses = searchParams
    .getAll("status")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v): v is ApplicationStatus => APPLICATION_STATUSES.includes(v as ApplicationStatus));
  const sortParam = searchParams.get("sort");

  const options = {
    search: searchParams.get("search") ?? undefined,
    statuses,
    dueFrom: searchParams.get("dueFrom") ?? undefined,
    dueTo: searchParams.get("dueTo") ?? undefined,
    isRecurring: searchParams.get("isRecurring") === "true" ? true : undefined,
    sort: SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : undefined,
  };

  const supabase = await createClient();
  try {
    const [{ rows, total }, counts] = await Promise.all([
      getFollowUpRows(supabase, { ...options, bucket, pagination: readPagination(searchParams) }),
      getFollowUpBucketCounts(supabase, options),
    ]);
    return NextResponse.json({ data: rows, total, counts });
  } catch (err) {
    console.error("GET /api/follow-ups failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load follow-ups." } }, { status: 500 });
  }
}

// POST /api/follow-ups — schedule a follow-up (claude.md API structure). Used by
// the candidate detail "Schedule Follow-up" action; also accepts an optional
// recurring flag directly rather than forcing every recurring follow-up through
// the separate /recurring endpoint.
export async function POST(request: Request) {
  const guard = await requirePermission("manage_follow_ups");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  const dueAt = typeof body?.dueAt === "string" ? body.dueAt : "";
  const assignTo = typeof body?.assignTo === "string" && body.assignTo ? body.assignTo : guard.id;

  if (!applicationId || !dueAt || Number.isNaN(new Date(dueAt).getTime())) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "applicationId and a valid dueAt are required." } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  try {
    const result = await createFollowUp(supabase, {
      applicationId,
      dueAt: new Date(dueAt).toISOString(),
      assignTo,
      assignedBy: guard.id,
      note: typeof body?.note === "string" ? body.note : undefined,
      isRecurring: body?.isRecurring === true,
      recurrenceRule: typeof body?.recurrenceRule === "string" ? body.recurrenceRule : undefined,
    });
    if ("error" in result) {
      return NextResponse.json(
        { error: { code: result.error, message: "That application does not exist." } },
        { status: 400 }
      );
    }
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    console.error("POST /api/follow-ups failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to schedule follow-up." } }, { status: 500 });
  }
}
