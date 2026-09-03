"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { parseCsv } from "@/lib/csvParse";
import type { DuplicateReviewRow, ImportBatchSummary } from "@/lib/import.shared";

type RowDecision = "skip" | "import_anyway";

export default function CandidateImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batch, setBatch] = useState<ImportBatchSummary | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateReviewRow[]>([]);
  const [decisions, setDecisions] = useState<Record<string, RowDecision>>({});
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

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
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/import/${batch.id}/confirm`, { method: "POST" });
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
  const importedLabel = result
    ? `${result.imported} candidates imported successfully, ${result.skipped} skipped as duplicates.`
    : "";

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
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
              Upload a candidate list exported from a job board or sourcing platform. Columns: Name, Phone, Email, Source, Job.
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
            <button
              onClick={confirmImport}
              disabled={busy}
              style={{
                background: "#FF5C35",
                border: "none",
                color: "#FFFFFF",
                borderRadius: 6,
                padding: "10px 20px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: busy ? "default" : "pointer",
                marginTop: 8,
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "Confirming…" : "Confirm Import"}
            </button>
          </>
        )}

        {importStep === 3 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", marginBottom: 8 }}>Import Complete</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>{importedLabel}</div>
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
