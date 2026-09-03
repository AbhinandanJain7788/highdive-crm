import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { createImportBatch, MAX_UPLOAD_ROWS, type ImportRawRow } from "@/lib/import";
import type { Database } from "@/types/supabase";

type UploadType = Database["public"]["Enums"]["upload_type"];
const UPLOAD_TYPES: UploadType[] = ["allocations", "customers"];

// POST /api/import/upload — body: { filename, uploadType, processId?, rows: object[] }.
// CSV parsing happens client-side (it's just column-mapped rows by the time it gets
// here); this only enforces the row cap and persists the batch.
export async function POST(request: Request) {
  const guard = await requirePermission("bulk_import");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const filename = typeof body?.filename === "string" && body.filename.trim() ? body.filename.trim() : "upload.csv";
  const uploadType: UploadType = UPLOAD_TYPES.includes(body?.uploadType) ? body.uploadType : "customers";
  const processId = typeof body?.processId === "string" && body.processId ? body.processId : null;
  const rows: ImportRawRow[] = Array.isArray(body?.rows)
    ? body.rows.filter((r: unknown) => typeof r === "object" && r !== null)
    : [];

  if (rows.length === 0) {
    return NextResponse.json({ error: { code: "bad_request", message: "No rows to import." } }, { status: 400 });
  }
  if (rows.length > MAX_UPLOAD_ROWS) {
    return NextResponse.json(
      { error: { code: "row_cap", message: `Upload exceeds the ${MAX_UPLOAD_ROWS.toLocaleString()}-row cap for this type.` } },
      { status: 413 }
    );
  }

  const supabase = await createClient();
  try {
    const batch = await createImportBatch(supabase, { filename, uploadType, processId, uploadedBy: guard.id, rows });
    return NextResponse.json({ data: batch }, { status: 201 });
  } catch (err) {
    console.error("POST /api/import/upload failed", err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to create import batch." } }, { status: 500 });
  }
}
