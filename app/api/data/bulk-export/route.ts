import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { buildCandidateExportCsv } from "@/lib/data-management";
import { APPLICATION_STATUSES } from "@/lib/candidates";
import type { Database } from "@/types/supabase";

type ApplicationStatus = Database["public"]["Enums"]["application_status"];

// POST /api/data/bulk-export — body: { search?, status?: string[], createdFrom?,
// createdTo? }. Returns CSV text; row count matches the filters applied.
export async function POST(request: Request) {
  const guard = await requirePermission("bulk_export");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => ({}));
  const statuses: ApplicationStatus[] = Array.isArray(body?.status)
    ? body.status.filter((s: unknown): s is ApplicationStatus => APPLICATION_STATUSES.includes(s as ApplicationStatus))
    : [];

  const supabase = await createClient();
  try {
    const { csv, rowCount } = await buildCandidateExportCsv(supabase, {
      search: typeof body?.search === "string" ? body.search : undefined,
      statuses,
      createdFrom: typeof body?.createdFrom === "string" ? body.createdFrom : undefined,
      createdTo: typeof body?.createdTo === "string" ? body.createdTo : undefined,
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="candidates_export.csv"`,
        "x-row-count": String(rowCount),
      },
    });
  } catch (err) {
    console.error("POST /api/data/bulk-export failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to export." } }, { status: 500 });
  }
}
