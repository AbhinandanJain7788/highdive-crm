import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type UploadType = Database["public"]["Enums"]["upload_type"];
type ImportDecision = Database["public"]["Enums"]["import_decision"];
type ImportStatus = Database["public"]["Enums"]["import_status"];

export const MAX_UPLOAD_ROWS = 20_000;

export type ImportBatchSummary = {
  id: string;
  filename: string;
  uploadType: UploadType;
  status: ImportStatus;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  createdAt: string;
};

// A parsed CSV row, still shaped like the sheet — fields are looked up by header
// name (case-insensitive) rather than position, so column order doesn't matter.
export type ImportRawRow = Record<string, string>;

export type DuplicateReviewRow = {
  rowId: string;
  raw: ImportRawRow;
  newName: string;
  newPhone: string;
  newJob: string;
  existingCandidateId: string;
  existingName: string;
  existingPhone: string;
  existingStatus: string;
};

function toSummary(b: {
  id: string;
  filename: string;
  upload_type: UploadType;
  status: ImportStatus;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  created_at: string;
}): ImportBatchSummary {
  return {
    id: b.id,
    filename: b.filename,
    uploadType: b.upload_type,
    status: b.status,
    totalRows: b.total_rows,
    importedRows: b.imported_rows,
    skippedRows: b.skipped_rows,
    createdAt: b.created_at,
  };
}

function field(row: ImportRawRow, ...names: string[]): string {
  const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]));
  for (const n of names) {
    const v = lower[n.toLowerCase()];
    if (v?.trim()) return v.trim();
  }
  return "";
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// POST /api/import/upload — creates the batch and inserts every parsed row.
// A single bulk insert (not one row at a time) is what keeps a 500+ row CSV inside
// a normal request instead of timing out.
export async function createImportBatch(
  supabase: SupabaseClient<Database>,
  params: { filename: string; uploadType: UploadType; processId: string | null; uploadedBy: string; rows: ImportRawRow[] }
): Promise<ImportBatchSummary> {
  if (params.rows.length > MAX_UPLOAD_ROWS) {
    throw Object.assign(new Error(`Upload exceeds the ${MAX_UPLOAD_ROWS.toLocaleString()}-row cap.`), { code: "row_cap" });
  }

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      filename: params.filename,
      upload_type: params.uploadType,
      process_id: params.processId,
      uploaded_by: params.uploadedBy,
      total_rows: params.rows.length,
      status: "review",
    })
    .select("id, filename, upload_type, status, total_rows, imported_rows, skipped_rows, created_at")
    .single();
  if (batchError || !batch) throw batchError ?? new Error("Failed to create import batch.");

  if (params.rows.length > 0) {
    const { error: rowsError } = await supabase.from("import_rows").insert(
      params.rows.map((raw) => ({ import_batch_id: batch.id, raw, decision: "pending" as ImportDecision }))
    );
    if (rowsError) throw rowsError;
  }

  return toSummary(batch);
}

// GET /api/import/:id/duplicates — rows whose phone or email matches an existing
// candidate. Matching is done in-memory against one bulk candidate fetch rather than
// one query per row: exact, not fuzzy (never auto-merge on a name match — claude.md).
export async function getImportDuplicates(
  supabase: SupabaseClient<Database>,
  batchId: string
): Promise<DuplicateReviewRow[]> {
  const { data: batch } = await supabase.from("import_batches").select("upload_type").eq("id", batchId).maybeSingle();
  // "Allocations" rows target an existing candidate by definition — there is no new
  // candidate being created, so there is nothing to flag as a duplicate.
  if (!batch || batch.upload_type !== "customers") return [];

  const { data: rows, error: rowsErr } = await supabase
    .from("import_rows")
    .select("id, raw")
    .eq("import_batch_id", batchId)
    .returns<{ id: string; raw: ImportRawRow }[]>();
  if (rowsErr) throw rowsErr;
  if (!rows?.length) return [];

  type DupCandidate = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    applications: { status: string; created_at: string }[] | null;
  };
  const { data: candidates, error: candErr } = await supabase
    .from("candidates")
    .select("id, name, phone, email, applications(status, created_at)")
    .returns<DupCandidate[]>();
  if (candErr) throw candErr;

  const byPhone = new Map<string, DupCandidate>();
  const byEmail = new Map<string, DupCandidate>();
  for (const c of candidates ?? []) {
    if (c.phone) byPhone.set(normalizePhone(c.phone), c);
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
  }

  const matched: { rowId: string; raw: ImportRawRow; candidate: DupCandidate }[] = [];
  for (const row of rows) {
    const phone = field(row.raw, "phone", "mobile", "contact");
    const email = field(row.raw, "email");
    const candidate =
      (phone && byPhone.get(normalizePhone(phone))) || (email && byEmail.get(email.toLowerCase())) || null;
    if (candidate) matched.push({ rowId: row.id, raw: row.raw, candidate });
  }

  if (matched.length === 0) return [];

  // Persist the match so confirm() doesn't have to re-derive it, and so a decision
  // recorded against a row stays tied to the same candidate it was reviewed against.
  await Promise.all(
    matched.map((m) => supabase.from("import_rows").update({ matched_candidate_id: m.candidate.id }).eq("id", m.rowId))
  );

  return matched.map((m) => {
    const apps = [...(m.candidate.applications ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return {
      rowId: m.rowId,
      raw: m.raw,
      newName: field(m.raw, "name", "full name"),
      newPhone: field(m.raw, "phone", "mobile", "contact"),
      newJob: field(m.raw, "job", "job title", "applied for"),
      existingCandidateId: m.candidate.id,
      existingName: m.candidate.name,
      existingPhone: m.candidate.phone ?? "",
      existingStatus: apps[0]?.status ?? "new",
    };
  });
}

// POST /api/import/:id/decide — records Skip Duplicate / Import Anyway for one row.
export async function decideImportRow(
  supabase: SupabaseClient<Database>,
  params: { rowId: string; decision: ImportDecision }
): Promise<void> {
  const { error } = await supabase.from("import_rows").update({ decision: params.decision }).eq("id", params.rowId);
  if (error) throw error;
}

async function firstStageIdForJob(supabase: SupabaseClient<Database>, jobId: string): Promise<string | null> {
  const { data: job } = await supabase.from("jobs").select("pipeline_template_id").eq("id", jobId).maybeSingle();
  if (!job) return null;
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline_template_id", job.pipeline_template_id)
    .order("sequence_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  return stage?.id ?? null;
}

// POST /api/import/:id/confirm — commits the batch. Duplicates are flagged for
// review, never auto-merged: a matched row only becomes a new candidate when its
// decision is explicitly 'import_anyway' (and then with is_duplicate=true, exactly
// the flag that drives the DUP badge on the candidates list). Any row still
// 'pending' after review defaults to skip, same as the UI's own default.
export async function confirmImport(
  supabase: SupabaseClient<Database>,
  batchId: string,
  confirmedBy: string
): Promise<{ imported: number; skipped: number }> {
  const { data: batch, error: batchErr } = await supabase
    .from("import_batches")
    .select("id, upload_type, process_id")
    .eq("id", batchId)
    .maybeSingle();
  if (batchErr) throw batchErr;
  if (!batch) throw new Error("Import batch not found.");

  const { data: rows, error: rowsErr } = await supabase
    .from("import_rows")
    .select("id, raw, matched_candidate_id, decision")
    .eq("import_batch_id", batchId)
    .returns<{ id: string; raw: ImportRawRow; matched_candidate_id: string | null; decision: ImportDecision }[]>();
  if (rowsErr) throw rowsErr;

  let imported = 0;
  let skipped = 0;

  if (batch.upload_type === "customers") {
    // Bulk-inserted in chunks rather than one row at a time — a 500-row import at
    // one round-trip per candidate took over 90s in testing (risking a real
    // deployment's request timeout); chunked bulk inserts turn that into a handful
    // of round-trips total. CHUNK stays comfortably under PostgREST's request-size
    // limits even at the 20k-row cap.
    const CHUNK = 500;
    type PreparedRow = { row: (typeof rows)[number]; name: string; phone: string; email: string; source: string; jobTitle: string; isDuplicate: boolean };
    const toImport: PreparedRow[] = [];

    for (const row of rows ?? []) {
      const isDuplicate = Boolean(row.matched_candidate_id);
      if (isDuplicate && row.decision !== "import_anyway") {
        skipped += 1;
        continue;
      }
      const name = field(row.raw, "name", "full name");
      if (!name) {
        skipped += 1;
        continue;
      }
      toImport.push({
        row,
        name,
        phone: field(row.raw, "phone", "mobile", "contact"),
        email: field(row.raw, "email"),
        source: field(row.raw, "source") || "CSV Import",
        jobTitle: field(row.raw, "job", "job title", "applied for"),
        isDuplicate,
      });
    }

    // Candidate id -> job title, for the applications pass below. A single INSERT
    // ... RETURNING preserves row order in Postgres, which is what lets this map
    // each returned id back to the prepared row at the same index without a second
    // round-trip per row.
    const createdWithJob: { candidateId: string; jobTitle: string }[] = [];

    for (let i = 0; i < toImport.length; i += CHUNK) {
      const chunk = toImport.slice(i, i + CHUNK);
      const { data: inserted, error: insertErr } = await supabase
        .from("candidates")
        .insert(
          chunk.map((c) => ({
            name: c.name,
            phone: c.phone || null,
            email: c.email || null,
            source: c.source,
            is_duplicate: c.isDuplicate,
            duplicate_of: c.isDuplicate ? c.row.matched_candidate_id : null,
            created_by: confirmedBy,
          }))
        )
        .select("id");
      if (insertErr || !inserted) {
        console.error(`confirmImport: candidate chunk insert failed (batch ${batchId}, rows ${i}-${i + chunk.length})`, insertErr);
        skipped += chunk.length;
        continue;
      }
      imported += inserted.length;
      inserted.forEach((c, idx) => {
        if (chunk[idx].jobTitle) createdWithJob.push({ candidateId: c.id, jobTitle: chunk[idx].jobTitle });
      });
    }

    // Resolve each distinct job title once, then bulk-insert applications —
    // matches the same "cache the lookup, batch the write" shape as the candidate
    // pass above.
    const uniqueTitles = [...new Set(createdWithJob.map((c) => c.jobTitle))];
    const jobByTitle = new Map<string, { id: string; stageId: string | null }>();
    for (const title of uniqueTitles) {
      const { data: job } = await supabase.from("jobs").select("id").ilike("title", title).limit(1).maybeSingle();
      if (job) jobByTitle.set(title, { id: job.id, stageId: await firstStageIdForJob(supabase, job.id) });
    }

    const applicationRows = createdWithJob
      .map((c) => {
        const job = jobByTitle.get(c.jobTitle);
        if (!job) return null;
        return { candidate_id: c.candidateId, job_id: job.id, pipeline_stage_id: job.stageId, status: "new" as const };
      })
      .filter((r): r is { candidate_id: string; job_id: string; pipeline_stage_id: string | null; status: "new" } => r !== null);
    for (let i = 0; i < applicationRows.length; i += CHUNK) {
      const { error: appErr } = await supabase.from("applications").insert(applicationRows.slice(i, i + CHUNK));
      if (appErr) console.error(`confirmImport: application chunk insert failed (batch ${batchId})`, appErr);
    }
  } else {
    // "allocations" — every row targets an existing candidate by phone; a match
    // gets bulk-assigned to the named recruiter (by email) if they're unassigned.
    // Nothing is created here, matching the upload card's own description
    // ("creates or overwrites allocations").
    type AllocationCandidate = { id: string; phone: string | null; applications: { id: string; assigned_recruiter_id: string | null }[] | null };
    const { data: candidates } = await supabase
      .from("candidates")
      .select("id, phone, applications(id, assigned_recruiter_id)")
      .returns<AllocationCandidate[]>();
    const byPhone = new Map<string, AllocationCandidate>();
    for (const c of candidates ?? []) if (c.phone) byPhone.set(normalizePhone(c.phone), c);

    for (const row of rows ?? []) {
      const phone = field(row.raw, "phone", "mobile", "contact");
      const recruiterEmail = field(row.raw, "recruiter", "recruiter email", "assign to");
      const candidate = phone ? byPhone.get(normalizePhone(phone)) : undefined;
      const application = candidate?.applications?.[0];
      if (!candidate || !application || !recruiterEmail) {
        skipped += 1;
        continue;
      }

      const { data: recruiter } = await supabase.from("users").select("id").eq("email", recruiterEmail.toLowerCase()).maybeSingle();
      if (!recruiter) {
        skipped += 1;
        continue;
      }

      const { error: assignErr } = await supabase
        .from("assignments")
        .insert({ application_id: application.id, recruiter_id: recruiter.id, assigned_by: confirmedBy, method: "manual", status: "active" });
      if (assignErr) {
        skipped += 1;
        continue;
      }
      await supabase.from("applications").update({ assigned_recruiter_id: recruiter.id }).eq("id", application.id);
      imported += 1;
    }
  }

  await supabase
    .from("import_batches")
    .update({ status: "completed", imported_rows: imported, skipped_rows: skipped })
    .eq("id", batchId);

  return { imported, skipped };
}
