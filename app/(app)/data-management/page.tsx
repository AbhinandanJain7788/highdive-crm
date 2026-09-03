"use client";

import { useState } from "react";

type DmTab = "bulkImport" | "bulkExport" | "bulkDelete" | "dataCleanup" | "dataTransfer";
type UploadType = "allocations" | "customers";

const dmTabLabels: Record<Exclude<DmTab, "bulkImport">, string> = {
  bulkExport: "Bulk Export",
  bulkDelete: "Bulk Delete",
  dataCleanup: "Data Clean-up",
  dataTransfer: "Data Transfer",
};

const tabStyle = (active: boolean): React.CSSProperties =>
  active
    ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" }
    : { color: "#4B5565", borderBottom: "2px solid transparent" };

export default function DataManagementPage() {
  const [dmTab, setDmTab] = useState<DmTab>("bulkImport");
  const [dmUploadProcess, setDmUploadProcess] = useState("");
  const [dmUploadType, setDmUploadType] = useState<UploadType>("allocations");

  const tabs: { key: DmTab; label: string }[] = [
    { key: "bulkImport", label: "Bulk Import" },
    { key: "bulkExport", label: "Bulk Export" },
    { key: "bulkDelete", label: "Bulk Delete" },
    { key: "dataCleanup", label: "Data Clean-up" },
    { key: "dataTransfer", label: "Data Transfer" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 32, marginBottom: 2, borderBottom: "1px solid #E7E9EE" }}>
        {tabs.map((t) => (
          <div
            key={t.key}
            onClick={() => setDmTab(t.key)}
            style={{
              paddingBottom: 12,
              fontSize: 14.5,
              fontWeight: 700,
              cursor: "pointer",
              ...tabStyle(dmTab === t.key),
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {dmTab === "bulkImport" ? (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E7E9EE",
            borderTop: "none",
            borderRadius: "0 0 10px 10px",
            padding: "30px 36px 90px",
            position: "relative",
            minHeight: 520,
          }}
        >
          <div style={{ fontSize: 19, fontWeight: 700, color: "#1D2433", marginBottom: 6 }}>
            Bulk Import
          </div>
          <div style={{ fontSize: 13.5, color: "#6B7280", marginBottom: 28 }}>
            Easily upload leads in two steps — configure your upload, then validate your data.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "#E0A415",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1D2433" }}>
                  Configure Upload
                </div>
                <div style={{ fontSize: 12, color: "#9AA1AC" }}>Process selection & Type of upload</div>
              </div>
            </div>
            <div style={{ width: 90, height: 1, background: "#E7E9EE" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: "1.6px solid #D9DCE3",
                  color: "#9AA1AC",
                  fontSize: 14,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#9AA1AC" }}>Upload Data</div>
                <div style={{ fontSize: 12, color: "#9AA1AC" }}>Upload & Validate data</div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13.5, color: "#1D2433", marginBottom: 8 }}>
            Process <span style={{ color: "#C0392B" }}>*</span>
          </div>
          <select
            value={dmUploadProcess}
            onChange={(e) => setDmUploadProcess(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 340,
              padding: "10px 14px",
              border: "1px solid #D9DCE3",
              borderRadius: 7,
              fontSize: 13,
              color: "#4B5565",
              background: "#FFFFFF",
              marginBottom: 28,
            }}
          >
            <option value="">Select process</option>
            <option value="Default process">Default process</option>
          </select>

          <div style={{ fontSize: 13.5, color: "#1D2433", marginBottom: 14 }}>
            Select Upload Type <span style={{ color: "#C0392B" }}>*</span>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div
              onClick={() => setDmUploadType("allocations")}
              style={{
                position: "relative",
                width: 300,
                borderRadius: 10,
                padding: 20,
                cursor: "pointer",
                ...(dmUploadType === "allocations"
                  ? { background: "#FDECEC", border: "1px solid #F4C6C0" }
                  : { background: "#FFFFFF", border: "1px solid #E7E9EE" }),
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
                  border: `1.6px solid ${dmUploadType === "allocations" ? "#FF5C35" : "#D9DCE3"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {dmUploadType === "allocations" && (
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF5C35" }} />
                )}
              </div>
              <div style={{ display: "flex", gap: 2, marginBottom: 14 }}>
                <svg width="18" height="18" viewBox="0 0 16 16">
                  <path d="M6 1.5l4 7H2z" fill="none" stroke="#FF5C35" strokeWidth="1.3" />
                </svg>
                <svg width="18" height="18" viewBox="0 0 16 16">
                  <rect x="1.5" y="8.5" width="6" height="6" fill="none" stroke="#FF5C35" strokeWidth="1.3" />
                  <circle cx="12" cy="11.5" r="3" fill="none" stroke="#FF5C35" strokeWidth="1.3" />
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1D2433", marginBottom: 8 }}>
                Allocations - Max: 20k
              </div>
              <div style={{ fontSize: 12.5, color: "#4B5565", lineHeight: 1.5 }}>
                1. Creates or overwrites (if already exists) allocations.
              </div>
            </div>

            <div
              onClick={() => setDmUploadType("customers")}
              style={{
                position: "relative",
                width: 300,
                borderRadius: 10,
                padding: 20,
                cursor: "pointer",
                ...(dmUploadType === "customers"
                  ? { background: "#FDECEC", border: "1px solid #F4C6C0" }
                  : { background: "#FFFFFF", border: "1px solid #E7E9EE" }),
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
                  border: `1.6px solid ${dmUploadType === "customers" ? "#FF5C35" : "#D9DCE3"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {dmUploadType === "customers" && (
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF5C35" }} />
                )}
              </div>
              <svg width="26" height="20" viewBox="0 0 26 20" style={{ marginBottom: 14 }}>
                <circle cx="9" cy="6" r="3.4" fill="none" stroke="#1A56DB" strokeWidth="1.3" />
                <path
                  d="M2.5 18c0-4 3-6.5 6.5-6.5S15.5 14 15.5 18"
                  fill="none"
                  stroke="#1A56DB"
                  strokeWidth="1.3"
                />
                <circle cx="19" cy="8" r="2.4" fill="none" stroke="#1A56DB" strokeWidth="1.2" />
              </svg>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1D2433", marginBottom: 8 }}>
                Customers - Max: 20k
              </div>
              <div style={{ fontSize: 12.5, color: "#4B5565", lineHeight: 1.5 }}>
                1. Updates and creates customer base.
                <br />
                2. Creates an interaction (with status) and will make it part of customer history
              </div>
            </div>
          </div>

          <button
            style={{
              position: "absolute",
              bottom: 26,
              right: 30,
              background: "linear-gradient(180deg,#FF7A50,#FF5C35)",
              border: "none",
              color: "#FFFFFF",
              borderRadius: 8,
              padding: "12px 34px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Next
          </button>
        </div>
      ) : (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E7E9EE",
            borderTop: "none",
            borderRadius: "0 0 10px 10px",
            padding: 60,
            textAlign: "center",
            fontSize: 13,
            color: "#9AA1AC",
          }}
        >
          {dmTabLabels[dmTab as Exclude<DmTab, "bulkImport">]} coming soon.
        </div>
      )}
    </div>
  );
}
