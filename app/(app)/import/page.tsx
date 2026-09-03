"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { importDedupSeed } from "@/lib/mock";

const TOTAL_ROWS_PARSED = 14;

type Decision = "skip" | "import";

export default function CandidateImportPage() {
  const router = useRouter();
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  const dedupCount = importDedupSeed.length;
  const importedCount = TOTAL_ROWS_PARSED - dedupCount + Object.values(decisions).filter((d) => d === "import").length;
  const skippedCount = dedupCount - Object.values(decisions).filter((d) => d === "import").length;
  const importedLabel = `${importedCount} candidates imported successfully, ${skippedCount} skipped as duplicates.`;

  const importStepColor1 = importStep >= 1 ? "#FF5C35" : "#EEF0F5";
  const importStepColor2 = importStep >= 2 ? "#FF5C35" : "#EEF0F5";
  const importStepColor3 = importStep >= 3 ? "#FF5C35" : "#EEF0F5";

  return (
    <div>
      <Link
        href="/candidates"
        style={{ fontSize: 13, color: "#6B7280", cursor: "pointer", marginBottom: 14, display: "block", textDecoration: "none" }}
      >
        ← Cancel Import
      </Link>
      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 32, maxWidth: 720 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: importStepColor1 }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: importStepColor2 }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: importStepColor3 }} />
        </div>

        {importStep === 1 && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", marginBottom: 6 }}>Upload CSV</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
              Upload a candidate list exported from a job board or sourcing platform.
            </div>
            <div style={{ border: "2px dashed #D9DCE3", borderRadius: 10, padding: 44, textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>Drag and drop a .csv file here, or</div>
              <button
                onClick={() => setImportStep(2)}
                style={{
                  background: "#FF5C35",
                  border: "none",
                  color: "#FFFFFF",
                  borderRadius: 6,
                  padding: "9px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Choose File
              </button>
            </div>
          </>
        )}

        {importStep === 2 && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", marginBottom: 6 }}>Review Possible Duplicates</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
              candidates_batch_sep1.csv — {TOTAL_ROWS_PARSED} rows parsed, {dedupCount} possible duplicates found.
            </div>
            {importDedupSeed.map((row) => {
              const decision = decisions[row.id] || "skip";
              const skipStyle =
                decision === "skip"
                  ? { background: "#1D2433", color: "#FFFFFF" }
                  : { background: "#FFFFFF", color: "#4B5565", border: "1px solid #D9DCE3" };
              const importStyle =
                decision === "import"
                  ? { background: "#1D2433", color: "#FFFFFF" }
                  : { background: "#FFFFFF", color: "#4B5565", border: "1px solid #D9DCE3" };
              return (
                <div key={row.id} style={{ border: "1px solid #EEF0F4", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#B15C00", textTransform: "uppercase", marginBottom: 4 }}>
                        New Entry
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{row.newName}</div>
                      <div style={{ fontSize: 12, color: "#9AA1AC" }}>
                        {row.newPhone} · {row.newJob}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#5B6472", textTransform: "uppercase", marginBottom: 4 }}>
                        Existing Match
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{row.existingName}</div>
                      <div style={{ fontSize: 12, color: "#9AA1AC" }}>
                        {row.existingPhone} · {row.existingStatus}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setDecisions((s) => ({ ...s, [row.id]: "skip" }))}
                      style={{
                        flex: 1,
                        padding: "7px 0",
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        ...skipStyle,
                      }}
                    >
                      Skip Duplicate
                    </button>
                    <button
                      onClick={() => setDecisions((s) => ({ ...s, [row.id]: "import" }))}
                      style={{
                        flex: 1,
                        padding: "7px 0",
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        ...importStyle,
                      }}
                    >
                      Import Anyway
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setImportStep(3)}
              style={{
                background: "#FF5C35",
                border: "none",
                color: "#FFFFFF",
                borderRadius: 6,
                padding: "10px 20px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              Confirm Import
            </button>
          </>
        )}

        {importStep === 3 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", marginBottom: 8 }}>Import Complete</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>{importedLabel}</div>
            <button
              onClick={() => router.push("/candidates")}
              style={{
                background: "#FF5C35",
                border: "none",
                color: "#FFFFFF",
                borderRadius: 6,
                padding: "10px 24px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
