"use client";

import { useState } from "react";
import { waTemplatesSeed } from "@/lib/mock";

// Mock stores visibility as a lowercase enum ('all' | 'process' | 'private') to match the
// Phase 0 schema; the source UI shows it Title Cased ("All"). Purely a display mapping.
const visibilityLabels: Record<string, string> = {
  all: "All",
  process: "Process",
  private: "Private",
};

export default function WhatsappTemplatesPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const visible = q ? waTemplatesSeed.filter((wt) => wt.name.toLowerCase().includes(q)) : waTemplatesSeed;

  const activeId = selectedId ?? "w1";
  const selected = waTemplatesSeed.find((wt) => wt.id === activeId) ?? null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>Whatsapp Templates</span>
        <div
          style={{
            width: 15,
            height: 15,
            borderRadius: "50%",
            border: "1px solid #C9CED6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9.5,
            color: "#9AA1AC",
          }}
        >
          ?
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <select
          style={{
            padding: "9px 14px",
            border: "1px solid #D9DCE3",
            borderRadius: 7,
            fontSize: 13,
            color: "#4B5565",
            background: "#FFFFFF",
            minWidth: 150,
          }}
        >
          <option>Process: All</option>
        </select>
        <select
          style={{
            padding: "9px 14px",
            border: "1px solid #D9DCE3",
            borderRadius: 7,
            fontSize: 13,
            color: "#4B5565",
            background: "#FFFFFF",
            minWidth: 180,
          }}
        >
          <option>Visibility: All Templates</option>
        </select>
        <div
          style={{
            flex: 1,
            maxWidth: 260,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#FFFFFF",
            border: "1px solid #D9DCE3",
            borderRadius: 7,
            padding: "9px 14px",
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a template"
            style={{
              border: "none",
              outline: "none",
              fontSize: 13,
              color: "#1D2433",
              flex: 1,
              background: "transparent",
            }}
          />
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="#9AA1AC" strokeWidth="1.4" />
          </svg>
        </div>
        <button
          style={{
            background: "linear-gradient(180deg,#FF7A50,#FF5C35)",
            border: "none",
            color: "#FFFFFF",
            borderRadius: 7,
            padding: "10px 20px",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Create New
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 18, alignItems: "start" }}>
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E7E9EE",
            borderRadius: 10,
            maxHeight: 560,
            overflowY: "auto",
          }}
        >
          {visible.map((wt) => {
            const isActive = wt.id === activeId;
            return (
              <div
                key={wt.id}
                onClick={() => setSelectedId(wt.id)}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "16px 18px",
                  borderBottom: "1px solid #F4F5F8",
                  borderLeft: `3px solid ${isActive ? "#FF5C35" : "#16A34A"}`,
                  cursor: "pointer",
                  background: isActive ? "#FFF5F2" : "transparent",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 2 }}>
                  <circle cx="8" cy="8" r="6.4" fill="none" stroke="#16A34A" strokeWidth="1.3" />
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1D2433", textTransform: "uppercase" }}>
                      {wt.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#4B5565",
                        border: "1px solid #D9DCE3",
                        borderRadius: 5,
                        padding: "1px 7px",
                      }}
                    >
                      {visibilityLabels[wt.visibility]}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#4B5565",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginBottom: 6,
                    }}
                  >
                    {wt.preview}
                  </div>
                  <div style={{ fontSize: 12, color: "#9AA1AC" }}>
                    Created By: <b style={{ color: "#4B5565" }}>{wt.createdBy}</b>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0, marginTop: 6 }}>
                  <path d="M5 3l4 4-4 4" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
                </svg>
              </div>
            );
          })}
        </div>

        {selected && (
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", textTransform: "uppercase" }}>
                {selected.name}
              </span>
              <svg
                onClick={() => setSelectedId(null)}
                width="16"
                height="16"
                viewBox="0 0 16 16"
                style={{ cursor: "pointer" }}
              >
                <path d="M3 3l10 10M13 3L3 13" stroke="#6B7280" strokeWidth="1.5" />
              </svg>
            </div>
            <div style={{ display: "flex", gap: 28, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#4B5565", cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path d="M9.5 1.5l-6 6v3h3l6-6z" fill="none" stroke="#4B5565" strokeWidth="1.2" />
                </svg>
                Edit
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#4B5565", cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <rect x="2" y="4" width="8" height="9" rx="1" fill="none" stroke="#4B5565" strokeWidth="1.2" />
                  <rect x="5" y="1.5" width="8" height="9" rx="1" fill="#FFFFFF" stroke="#4B5565" strokeWidth="1.2" />
                </svg>
                Duplicate
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#4B5565", cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <path
                    d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5M4.5 4.5l.6 9a1 1 0 001 1h3.8a1 1 0 001-1l.6-9"
                    fill="none"
                    stroke="#4B5565"
                    strokeWidth="1.2"
                  />
                </svg>
                Delete
              </div>
            </div>
            <div style={{ borderTop: "1px solid #EEF0F4", paddingTop: 16, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#1D2433" }}>
                <svg width="15" height="15" viewBox="0 0 16 16">
                  <path
                    d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z"
                    fill="none"
                    stroke="#4B5565"
                    strokeWidth="1.2"
                  />
                  <ellipse cx="8" cy="8" rx="2.6" ry="6.5" fill="none" stroke="#4B5565" strokeWidth="1.1" />
                </svg>
                Visibility <b>{visibilityLabels[selected.visibility]}</b>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #EEF0F4", paddingTop: 18 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1D2433", marginBottom: 12 }}>
                Template Preview
              </div>
              <div
                style={{
                  background: "#FAFBFC",
                  border: "1px solid #EEF0F4",
                  borderRadius: 8,
                  padding: "16px 18px",
                  fontSize: 13.5,
                  color: "#1D2433",
                  lineHeight: 1.6,
                  whiteSpace: "pre-line",
                }}
              >
                {selected.fullText}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
