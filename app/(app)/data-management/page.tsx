"use client";

import { useEffect, useRef, useState } from "react";
import { parseCsv } from "@/lib/csvParse";
import type { DuplicateReviewRow, ImportBatchSummary, ImportResult } from "@/lib/import.shared";

type DmTab = "bulkImport" | "bulkExport" | "bulkDelete" | "dataCleanup" | "dataTransfer";
type UploadType = "allocations" | "customers";
type RowDecision = "skip" | "import_anyway";

const dmTabLabels: Record<Exclude<DmTab, "bulkImport">, string> = {
  bulkExport: "Bulk Export",
  bulkDelete: "Bulk Delete",
  dataCleanup: "Data Clean-up",
  dataTransfer: "Data Transfer",
};

const tabStyle = (active: boolean): React.CSSProperties =>
  active ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" } : { color: "#4B5565", borderBottom: "2px solid transparent" };

const panelStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E7E9EE",
  borderTop: "none",
  borderRadius: "0 0 10px 10px",
  padding: "30px 36px",
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(180deg,#FF7A50,#FF5C35)",
  border: "none",
  color: "#FFFFFF",
  borderRadius: 8,
  padding: "10px 22px",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 340,
  padding: "10px 14px",
  border: "1px solid #D9DCE3",
  borderRadius: 7,
  fontSize: 13,
  color: "#4B5565",
  background: "#FFFFFF",
};

export default function DataManagementPage() {
  const [dmTab, setDmTab] = useState<DmTab>("bulkImport");

  return (
    <div>
      <div style={{ display: "flex", gap: 32, marginBottom: 2, borderBottom: "1px solid #E7E9EE" }}>
        {(
          [
            { key: "bulkImport", label: "Bulk Import" },
            { key: "bulkExport", label: "Bulk Export" },
            { key: "bulkDelete", label: "Bulk Delete" },
            { key: "dataCleanup", label: "Data Clean-up" },
            { key: "dataTransfer", label: "Data Transfer" },
          ] as { key: DmTab; label: string }[]
        ).map((t) => (
          <div key={t.key} onClick={() => setDmTab(t.key)} style={{ paddingBottom: 12, fontSize: 14.5, fontWeight: 700, cursor: "pointer", ...tabStyle(dmTab === t.key) }}>
            {t.label}
          </div>
        ))}
      </div>

      {dmTab === "bulkImport" && <BulkImportPanel />}
      {dmTab === "bulkExport" && <BulkExportPanel />}
      {dmTab === "bulkDelete" && <BulkDeletePanel />}
      {dmTab === "dataTransfer" && <DataTransferPanel />}
      {dmTab === "dataCleanup" && (
        <div style={{ ...panelStyle, padding: 60, textAlign: "center", fontSize: 13, color: "#9AA1AC" }}>
          {dmTabLabels.dataCleanup} coming soon.
        </div>
      )}
    </div>
  );
}

// ---------- Bulk Import: Configure Upload -> Upload Data ----------

function BulkImportPanel() {
  const [step, setStep] = useState<1 | 2>(1);
  const [process, setProcess] = useState("");
  const [uploadType, setUploadType] = useState<UploadType>("allocations");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<ImportBatchSummary | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateReviewRow[]>([]);
  const [decisions, setDecisions] = useState<Record<string, RowDecision>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      const text = await file.text();
      const { rows } = parseCsv(text);
      if (rows.length === 0) throw new Error("The file has no data rows.");

      const uploadRes = await fetch("/api/import/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, uploadType, rows }),
      });
      const uploadBody = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok) throw new Error(uploadBody?.error?.message ?? "Could not upload the file.");
      const createdBatch: ImportBatchSummary = uploadBody.data;
      setBatch(createdBatch);

      if (uploadType === "customers") {
        const dupRes = await fetch(`/api/import/${createdBatch.id}/duplicates`);
        const dupBody = await dupRes.json().catch(() => null);
        if (!dupRes.ok) throw new Error(dupBody?.error?.message ?? "Could not check for duplicates.");
        setDuplicates(dupBody.data ?? []);
      } else {
        // Allocations rows target an existing candidate by definition — nothing to
        // dedupe, so this type goes straight to confirm.
        await confirm(createdBatch.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process the file.");
    } finally {
      setBusy(false);
    }
  }

  async function setDecision(rowId: string, decision: RowDecision) {
    setDecisions((s) => ({ ...s, [rowId]: decision }));
    if (!batch) return;
    try {
      await fetch(`/api/import/${batch.id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rowId, decision }),
      });
    } catch {
      // Confirm re-derives the outcome from stored state; a dropped decide call just
      // falls back to "skip" there.
    }
  }

  async function confirm(batchId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/import/${batchId}/confirm`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not confirm the import.");
      setResult(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the import.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...panelStyle, position: "relative", minHeight: 520 }}>
      <div style={{ fontSize: 19, fontWeight: 700, color: "#1D2433", marginBottom: 6 }}>Bulk Import</div>
      <div style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 28 }}>
        Easily upload leads in two steps — configure your upload, then validate your data.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <StepBadge n={1} active={step === 1} label="Configure Upload" sub="Process selection & Type of upload" />
        <div style={{ width: 90, height: 1, background: "#E7E9EE" }} />
        <StepBadge n={2} active={step === 2} label="Upload Data" sub="Upload & Validate data" />
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {step === 1 && (
        <>
          <div style={{ fontSize: 13.5, color: "#1D2433", marginBottom: 8 }}>
            Process <span style={{ color: "#C0392B" }}>*</span>
          </div>
          <select value={process} onChange={(e) => setProcess(e.target.value)} style={{ ...inputStyle, marginBottom: 28 }}>
            <option value="">Select process</option>
            <option value="Default process">Default process</option>
          </select>

          <div style={{ fontSize: 13.5, color: "#1D2433", marginBottom: 14 }}>
            Select Upload Type <span style={{ color: "#C0392B" }}>*</span>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 28 }}>
            <UploadTypeCard
              active={uploadType === "allocations"}
              onClick={() => setUploadType("allocations")}
              title="Allocations - Max: 20k"
              body="Creates or overwrites (if already exists) allocations, matched by phone number."
            />
            <UploadTypeCard
              active={uploadType === "customers"}
              onClick={() => setUploadType("customers")}
              title="Customers - Max: 20k"
              body="Updates and creates customer base. Creates an interaction (with status) and will make it part of customer history."
            />
          </div>

          <button onClick={() => setStep(2)} disabled={!process || !uploadType} style={{ ...primaryBtn, opacity: !process ? 0.5 : 1 }}>
            Next
          </button>
        </>
      )}

      {step === 2 && !batch && (
        <>
          <div style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 20 }}>
            Uploading as <strong>{uploadType === "allocations" ? "Allocations" : "Customers"}</strong> under{" "}
            <strong>{process}</strong>.
          </div>
          <div style={{ border: "2px dashed #D9DCE3", borderRadius: 10, padding: 44, textAlign: "center", marginBottom: 20, maxWidth: 480 }}>
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
            <button onClick={() => fileInputRef.current?.click()} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
              {busy ? "Uploading…" : "Choose File"}
            </button>
          </div>
          <div onClick={() => setStep(1)} style={{ fontSize: 12.5, color: "#6B7280", cursor: "pointer" }}>
            ← Back to Configure Upload
          </div>
        </>
      )}

      {step === 2 && batch && uploadType === "customers" && !result && (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1D2433", marginBottom: 6 }}>Review Possible Duplicates</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
            {batch.filename} — {batch.totalRows} rows parsed, {duplicates.length} possible duplicates found.
          </div>
          {duplicates.map((row) => {
            const decision = decisions[row.rowId] || "skip";
            return (
              <div key={row.rowId} style={{ border: "1px solid #EEF0F4", borderRadius: 8, padding: 14, marginBottom: 12, maxWidth: 560 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#B15C00" }}>NEW</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{row.newName}</div>
                    <div style={{ fontSize: 12, color: "#9AA1AC" }}>{row.newPhone}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#5B6472" }}>EXISTING</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{row.existingName}</div>
                    <div style={{ fontSize: 12, color: "#9AA1AC" }}>
                      {row.existingPhone} · {row.existingStatus}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setDecision(row.rowId, "skip")}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", ...(decision === "skip" ? { background: "#1D2433", color: "#fff" } : { background: "#fff", color: "#4B5565", border: "1px solid #D9DCE3" }) }}
                  >
                    Skip Duplicate
                  </button>
                  <button
                    onClick={() => setDecision(row.rowId, "import_anyway")}
                    style={{ flex: 1, padding: "7px 0", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", ...(decision === "import_anyway" ? { background: "#1D2433", color: "#fff" } : { background: "#fff", color: "#4B5565", border: "1px solid #D9DCE3" }) }}
                  >
                    Import Anyway
                  </button>
                </div>
              </div>
            );
          })}
          <button onClick={() => confirm(batch.id)} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1, marginTop: 8 }}>
            {busy ? "Confirming…" : "Confirm Import"}
          </button>
        </>
      )}

      {result && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", marginBottom: 8 }}>Import Complete</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: result.skipReasons?.length ? 14 : 20 }}>
            {result.imported} rows imported, {result.skipped} skipped.
          </div>
          {/* A bare "0 imported, 17 skipped" reads as a broken feature. The most
              common cause is a candidate sheet uploaded under the Allocations type,
              which skips every row by design — naming the reason is what tells the
              two apart without going to the server logs. */}
          {result.skipReasons?.length > 0 && (
            <div
              style={{
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 20,
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
              {result.imported === 0 && uploadType === "allocations" && (
                <div style={{ fontSize: 12, color: "#92400E", marginTop: 10, paddingTop: 10, borderTop: "1px solid #FDE68A" }}>
                  Uploading a list of new candidates? Start again and choose <strong>Customers</strong> — Allocations only
                  assigns candidates that already exist.
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => {
              setStep(1);
              setBatch(null);
              setDuplicates([]);
              setDecisions({});
              setResult(null);
            }}
            style={primaryBtn}
          >
            Start Another Upload
          </button>
        </div>
      )}
    </div>
  );
}

function StepBadge({ n, active, label, sub }: { n: number; active: boolean; label: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 700,
          ...(active ? { background: "#E0A415", color: "#FFFFFF" } : { border: "1.6px solid #D9DCE3", color: "#9AA1AC" }),
        }}
      >
        {n}
      </div>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: active ? "#1D2433" : "#9AA1AC" }}>{label}</div>
        <div style={{ fontSize: 12, color: "#9AA1AC" }}>{sub}</div>
      </div>
    </div>
  );
}

function UploadTypeCard({ active, onClick, title, body }: { active: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: 300,
        borderRadius: 10,
        padding: 20,
        cursor: "pointer",
        ...(active ? { background: "#FDECEC", border: "1px solid #F4C6C0" } : { background: "#FFFFFF", border: "1px solid #E7E9EE" }),
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: `1.6px solid ${active ? "#FF5C35" : "#D9DCE3"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {active && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF5C35" }} />}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#1D2433", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "#4B5565", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

// ---------- Bulk Export ----------

function BulkExportPanel() {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);

  async function runExport() {
    setBusy(true);
    setError(null);
    setLastCount(null);
    try {
      const res = await fetch("/api/data/bulk-export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ search: search.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not export.");
      }
      const rowCount = Number(res.headers.get("x-row-count") ?? "0");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "candidates_export.csv";
      a.click();
      URL.revokeObjectURL(url);
      setLastCount(rowCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 19, fontWeight: 700, color: "#1D2433", marginBottom: 6 }}>Bulk Export</div>
      <div style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 24 }}>Export candidates matching a search as CSV.</div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone (optional)" style={{ ...inputStyle, marginBottom: 16 }} />
      <div>
        <button onClick={runExport} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      {error && <div style={{ color: "#B42318", fontSize: 13, marginTop: 14 }}>{error}</div>}
      {lastCount !== null && !error && <div style={{ color: "#166534", fontSize: 13, marginTop: 14 }}>Exported {lastCount} rows.</div>}
    </div>
  );
}

// ---------- Bulk Delete ----------

function BulkDeletePanel() {
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!search.trim()) {
      setCandidates([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/candidates?search=${encodeURIComponent(search.trim())}&pageSize=25`, { signal: controller.signal });
        if (!res.ok) return;
        const body = await res.json();
        setCandidates((body.data ?? []).map((c: { id: string; name: string; phone: string }) => ({ id: c.id, name: c.name, phone: c.phone })));
      } catch {
        // Ignore aborted/in-flight lookups — a later search supersedes this one.
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runDelete() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/data/bulk-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateIds: [...selected] }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not delete.");
      setNotice(`Soft-deleted ${body.data.deleted} candidate(s).`);
      setSelected(new Set());
      setCandidates((prev) => prev.filter((c) => !selected.has(c.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 19, fontWeight: 700, color: "#1D2433", marginBottom: 6 }}>Bulk Delete</div>
      <div style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 24 }}>
        Soft-deletes selected candidates — they leave list screens but stay in the database.
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or phone" style={{ ...inputStyle, marginBottom: 16 }} />
      {candidates.length > 0 && (
        <div style={{ border: "1px solid #E7E9EE", borderRadius: 8, marginBottom: 16, maxWidth: 480 }}>
          {candidates.map((c) => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #F4F5F8", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <span style={{ fontWeight: 600, color: "#1D2433" }}>{c.name}</span>
              <span style={{ color: "#9AA1AC" }}>{c.phone}</span>
            </label>
          ))}
        </div>
      )}
      <button onClick={runDelete} disabled={busy || selected.size === 0} style={{ ...primaryBtn, opacity: busy || selected.size === 0 ? 0.5 : 1 }}>
        {busy ? "Deleting…" : `Delete Selected (${selected.size})`}
      </button>
      {error && <div style={{ color: "#B42318", fontSize: 13, marginTop: 14, maxWidth: 480 }}>{error}</div>}
      {notice && <div style={{ color: "#166534", fontSize: 13, marginTop: 14 }}>{notice}</div>}
    </div>
  );
}

// ---------- Data Transfer ----------

function DataTransferPanel() {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/team")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.data) setUsers(body.data.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
      })
      .catch(() => {});
  }, []);

  async function runTransfer() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/data/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromUserId, toUserId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not transfer.");
      setNotice(`Transferred ${body.data.transferred} candidate(s)${body.data.skipped ? `, ${body.data.skipped} skipped` : ""}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not transfer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 19, fontWeight: 700, color: "#1D2433", marginBottom: 6 }}>Data Transfer</div>
      <div style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 24 }}>
        Moves every candidate one user is currently assigned to over to another user.
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12.5, color: "#4B5565", marginBottom: 6 }}>From</div>
          <select value={fromUserId} onChange={(e) => setFromUserId(e.target.value)} style={inputStyle}>
            <option value="">Select user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12.5, color: "#4B5565", marginBottom: 6 }}>To</div>
          <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} style={inputStyle}>
            <option value="">Select user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button onClick={runTransfer} disabled={busy || !fromUserId || !toUserId || fromUserId === toUserId} style={{ ...primaryBtn, opacity: busy || !fromUserId || !toUserId ? 0.5 : 1 }}>
        {busy ? "Transferring…" : "Transfer"}
      </button>
      {error && <div style={{ color: "#B42318", fontSize: 13, marginTop: 14 }}>{error}</div>}
      {notice && <div style={{ color: "#166534", fontSize: 13, marginTop: 14 }}>{notice}</div>}
    </div>
  );
}
