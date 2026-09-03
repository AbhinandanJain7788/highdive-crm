import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { APPLICATION_STATUSES } from "@/lib/candidates";
import { getAllocationRows, getAllocationBucketCounts, type AllocationBucket } from "@/lib/allocations";
import { readPagination } from "@/lib/format";
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

const BUCKETS: AllocationBucket[] = ["new", "attempted"];
const SORT_KEYS = ["name-asc", "name-desc", "created-new", "created-old"] as const;

// GET /api/allocations — v_allocations, bucket=new|attempted (claude.md API structure).
// The view is the only definition of the bucket split; nothing here re-derives it.
export async function GET(request: Request) {
  const guard = await requirePermission("manage_allocations");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const bucketParam = searchParams.get("bucket");
  const bucket: AllocationBucket = BUCKETS.includes(bucketParam as AllocationBucket)
    ? (bucketParam as AllocationBucket)
    : "new";

  const statuses = searchParams
    .getAll("status")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v): v is ApplicationStatus => APPLICATION_STATUSES.includes(v as ApplicationStatus));
  const sortParam = searchParams.get("sort");

  const options = {
    search: searchParams.get("search") ?? undefined,
    statuses,
    createdFrom: searchParams.get("createdFrom") ?? undefined,
    createdTo: searchParams.get("createdTo") ?? undefined,
    pool: searchParams.get("pool") === "true",
    sort: (SORT_KEYS as readonly string[]).includes(sortParam ?? "")
      ? (sortParam as (typeof SORT_KEYS)[number])
      : undefined,
  };

  const supabase = await createClient();
  try {
    const [{ rows, total }, counts] = await Promise.all([
      getAllocationRows(supabase, { ...options, bucket, pagination: readPagination(searchParams) }),
      getAllocationBucketCounts(supabase, options),
    ]);
    return NextResponse.json({ data: rows, total, counts });
  } catch (err) {
    console.error("GET /api/allocations failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load allocations." } }, { status: 500 });
  }
}
