"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parseCsv } from "@/lib/csvParse";
import type { DuplicateReviewRow, ImportAssignOption, ImportBatchSummary, ImportResult } from "@/lib/import.shared";

type RowDecision = "skip" | "import_anyway";
type AssignMode = "none" | "manual" | "auto";
type AutoMethod = "round_robin" | "load_balanced";

export default function CandidateImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batch, setBatch] = useState<ImportBatchSummary | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateReviewRow[]>([]);
  const [decisions, setDecisions] = useState<Record<string, RowDecision>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  // Assigned To — the CSV import previously created candidates with no way to say
  // who should own them, unlike the Assignment screen's own Auto/Manual choice.
  // Mirrors that screen's two modes, applied once to every candidate this batch creates.
  const [assignMode, setAssignMode] = useState<AssignMode>("none");
  const [autoMethod, setAutoMethod] = useState<AutoMethod>("load_balanced");
  const [teamOptions, setTeamOptions] = useState<{ id: string; name: string }[]>([]);
  const [manualRecruiterId, setManualRecruiterId] = useState("");

  // Add to Job — required. `applications.job_id` is NOT NULL, so a customer with
  // no application ends up with a permanently disabled status/assign/follow-up
  // (the exact bug this field exists to close). A row whose own Job column
  // matches an existing job's title still wins over this — this is only the
  // fallback for rows that don't name one.
  const [jobOptions, setJobOptions] = useState<{ id: string; title: string }[]>([]);
  const [jobId, setJobId] = useState("");

  useEffect(() => {
    fetch("/api/team?status=active")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => setTeamOptions(body.data ?? []))
      .catch(() => {});
    fetch("/api/jobs/open")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => setJobOptions(body.data ?? []))
      .catch(() => {});
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const text = await file.text();
      const { rows } = parseCsv(text);
      if (rows.length === 0) throw new Error("The file has no data rows.");

      const uploadRes = await fetch("/api/import/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, uploadType: "customers", rows }),
      });
      const uploadBody = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok) throw new Error(uploadBody?.error?.message ?? "Could not upload the file.");
      const createdBatch: ImportBatchSummary = uploadBody.data;
      setBatch(createdBatch);

      const dupRes = await fetch(`/api/import/${createdBatch.id}/duplicates`);
      const dupBody = await dupRes.json().catch(() => null);
      if (!dupRes.ok) throw new Error(dupBody?.error?.message ?? "Could not check for duplicates.");
      setDuplicates(dupBody.data ?? []);
      setImportStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process the file.");
    } finally {
      setBusy(false);
    }
  }

  async function setDecision(rowId: string, decision: RowDecision) {
    setDecisions((s) => ({ ...s, [rowId]: decision }));
    try {
      await fetch(`/api/import/${batch!.id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rowId, decision }),
      });
    } catch {
      // The confirm step re-derives the final outcome from what's actually stored,
      // so a dropped decide call just means the row falls back to "skip" there.
    }
  }

  async function confirmImport() {
    if (!batch) return;
    if (!jobId) {
      setError("Pick a job to add these customers to.");
      return;
    }
    if (assignMode === "manual" && !manualRecruiterId) {
      setError("Pick a recruiter to assign this batch to, or choose a different Assigned To option.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const assign: ImportAssignOption =
        assignMode === "manual"
          ? { mode: "manual", recruiterId: manualRecruiterId }
          : assignMode === "auto"
            ? { mode: "auto", method: autoMethod }
            : { mode: "none" };
      const res = await fetch(`/api/import/${batch.id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assign, jobId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not confirm the import.");
      setResult(body.data);
      setImportStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the import.");
    } finally {
      setBusy(false);
    }
  }

  const importStepColor1 = importStep >= 1 ? "#FF5C35" : "#EEF0F5";
  const importStepColor2 = importStep >= 2 ? "#FF5C35" : "#EEF0F5";
  const importStepColor3 = importStep >= 3 ? "#FF5C35" : "#EEF0F5";
  // Was "skipped as duplicates", which only ever guessed at the reason — a row with
  // no Name is skipped here too. The real breakdown is rendered below instead.
  const importedLabel = result
    ? `${result.imported} candidates imported successfully, ${result.skipped} skipped.` +
      (result.assigned > 0 ? ` ${result.assigned} assigned.` : "")
    : "";
  // Should stay at 0 through this wizard (Add to Job is required above) — surfaced
  // only in case a row's own Job column also failed to match, which the required
  // field can't cover.
  const noJobWarning =
    result && result.noJobCount > 0
      ? `${result.noJobCount} of those were imported without an application (no matching job) — their status can't be changed yet.`
      : null;

  return (
    <div>
      <Link href="/candidates" style={{ fontSize: 13, color: "#6B7280", cursor: "pointer", marginBottom: 14, display: "block", textDecoration: "none" }}>
        ← Cancel Import
      </Link>
      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 32, maxWidth: 720 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: importStepColor1 }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: importStepColor2 }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: importStepColor3 }} />
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}

        {importStep === 1 && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", marginBottom: 6 }}>Upload CSV</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 8 }}>
              Upload a candidate list exported from a job board or sourcing platform. Recognized columns: Name (or
              First Name / Last Name), Phone (or Mobile / Mobile Number / Contact), Email, Source, Job (or Position /
              Applied For / Designation).
            </div>
            <div style={{ fontSize: 12, color: "#9AA1AC", marginBottom: 20 }}>
              Works with exports from LinkedIn Recruiter, Naukri and Upwork, or a hand-built sheet — column order
              doesn&apos;t matter, and a Job column only needs to match an existing job title. No Job column? You&apos;ll
              pick one job for the whole file on the next step.
            </div>
            <div style={{ border: "2px dashed #D9DCE3", borderRadius: 10, padding: 44, textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Drag and drop a .csv file here, or</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                style={{
                  background: "#FF5C35",
                  border: "none",
                  color: "#FFFFFF",
                  borderRadius: 6,
                  padding: "9px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? "Uploading…" : "Choose File"}
              </button>
            </div>
          </>
        )}

        {importStep === 2 && batch && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", marginBottom: 6 }}>Review Possible Duplicates</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
              {batch.filename} — {batch.totalRows} rows parsed, {duplicates.length} possible duplicates found.
            </div>
            {duplicates.map((row) => {
              const decision = decisions[row.rowId] || "skip";
              const skipStyle =
                decision === "skip" ? { background: "#1D2433", color: "#FFFFFF" } : { background: "#FFFFFF", color: "#4B5565", border: "1px solid #D9DCE3" };
              const importStyle =
                decision === "import_anyway" ? { background: "#1D2433", color: "#FFFFFF" } : { background: "#FFFFFF", color: "#4B5565", border: "1px solid #D9DCE3" };
              return (
                <div key={row.rowId} style={{ border: "1px solid #EEF0F4", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#B15C00", textTransform: "uppercase", marginBottom: 4 }}>New Entry</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{row.newName}</div>
                      <div style={{ fontSize: 12, color: "#9AA1AC" }}>
                        {row.newPhone} · {row.newJob || "--"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#5B6472", textTransform: "uppercase", marginBottom: 4 }}>Existing Match</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{row.existingName}</div>
                      <div style={{ fontSize: 12, color: "#9AA1AC" }}>
                        {row.existingPhone} · {row.existingStatus}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setDecision(row.rowId, "skip")} style={{ flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", ...skipStyle }}>
                      Skip Duplicate
                    </button>
                    <button onClick={() => setDecision(row.rowId, "import_anyway")} style={{ flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", ...importStyle }}>
                      Import Anyway
                    </button>
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: duplicates.length ? "1px solid #EEF0F4" : "none", marginTop: duplicates.length ? 8 : 0, paddingTop: duplicates.length ? 18 : 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1D2433", marginBottom: 4 }}>
                Add to Job <span style={{ color: "#C0392B" }}>*</span>
              </div>
              <div style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 12 }}>
                The job every imported customer is applying to, unless their own row already names a job that
                matches one on file — that always wins over this. Without an application, a customer&apos;s status
                can&apos;t be changed.
              </div>
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                style={{ width: "100%", maxWidth: 320, padding: "8px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, marginBottom: 8 }}
              >
                <option value="">Select job</option>
                {jobOptions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ borderTop: "1px solid #EEF0F4", marginTop: 8, paddingTop: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1D2433", marginBottom: 4 }}>Assigned To</div>
              <div style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 12 }}>
                Choose how the candidates in this batch should be assigned to a recruiter.
              </div>
              <div style={{ display: "flex", gap: 4, background: "#F4F5F8", borderRadius: 7, padding: 3, marginBottom: 12, width: "fit-content" }}>
                {(["none", "auto", "manual"] as AssignMode[]).map((mode) => (
                  <div
                    key={mode}
                    onClick={() => setAssignMode(mode)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 5,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: assignMode === mode ? "#FFFFFF" : "transparent",
                      color: assignMode === mode ? "#1D2433" : "#6B7280",
                      boxShadow: assignMode === mode ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {mode === "none" ? "Leave Unassigned" : mode === "auto" ? "Automatic Assign" : "Manual Assign"}
                  </div>
                ))}
              </div>

              {assignMode === "auto" && (
                <select
                  value={autoMethod}
                  onChange={(e) => setAutoMethod(e.target.value as AutoMethod)}
                  style={{ padding: "8px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, marginBottom: 12 }}
                >
                  <option value="load_balanced">Load Balanced</option>
                  <option value="round_robin">Round Robin</option>
                </select>
              )}
              {assignMode === "manual" && (
                <select
                  value={manualRecruiterId}
                  onChange={(e) => setManualRecruiterId(e.target.value)}
                  style={{ width: "100%", maxWidth: 320, padding: "8px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, marginBottom: 12 }}
                >
                  <option value="">Select recruiter</option>
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={confirmImport}
              disabled={busy || !jobId}
              title={!jobId ? "Pick a job above first." : undefined}
              style={{
                background: "#FF5C35",
                border: "none",
                color: "#FFFFFF",
                borderRadius: 6,
                padding: "10px 20px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: busy || !jobId ? "default" : "pointer",
                marginTop: 8,
                opacity: busy || !jobId ? 0.7 : 1,
              }}
            >
              {busy ? "Confirming…" : "Confirm Import"}
            </button>
          </>
        )}

        {importStep === 3 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", marginBottom: 8 }}>Import Complete</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: noJobWarning || result?.skipReasons?.length ? 8 : 24 }}>{importedLabel}</div>
            {noJobWarning && (
              <div style={{ fontSize: 12.5, color: "#B15C00", marginBottom: result?.skipReasons?.length ? 14 : 24, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                {noJobWarning}
              </div>
            )}
            {result && result.skipReasons?.length > 0 && (
              <div
                style={{
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 24,
                  textAlign: "left",
                  display: "inline-block",
                  maxWidth: 460,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 8 }}>Why rows were skipped</div>
                {result.skipReasons.map((r) => (
                  <div key={r.reason} style={{ display: "flex", gap: 10, fontSize: 12.5, color: "#78350F", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, minWidth: 26 }}>{r.count}</span>
                    <span>{r.label}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => router.push("/candidates")}
              style={{ background: "#FF5C35", border: "none", color: "#FFFFFF", borderRadius: 6, padding: "10px 24px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
