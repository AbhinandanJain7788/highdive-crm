"use client";

import { useState } from "react";
import type { TemplateVisibility, WaTemplateRow } from "@/lib/whatsappTemplates.shared";

const visibilityLabels: Record<TemplateVisibility, string> = {
  all: "All",
  process: "Process",
  private: "Private",
};

type Process = { id: string; name: string };

type FormState = {
  id: string | null;
  name: string;
  visibility: TemplateVisibility;
  processId: string;
  fullText: string;
};

const EMPTY_FORM: FormState = { id: null, name: "", visibility: "all", processId: "", fullText: "" };

export default function WhatsappTemplatesClient({
  initialTemplates,
  processes,
}: {
  initialTemplates: WaTemplateRow[];
  processes: Process[];
}) {
  const [templates, setTemplates] = useState<WaTemplateRow[]>(initialTemplates);
  const [search, setSearch] = useState("");
  const [processFilter, setProcessFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<TemplateVisibility | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refetch(nextSearch = search, nextProcess = processFilter, nextVisibility = visibilityFilter) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      if (nextProcess) params.set("processId", nextProcess);
      if (nextVisibility) params.set("visibility", nextVisibility);
      const res = await fetch(`/api/whatsapp-templates?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setTemplates(json.data ?? []);
        if (json.data?.length && !json.data.some((t: WaTemplateRow) => t.id === selectedId)) {
          setSelectedId(json.data[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  function openCreate() {
    setError(null);
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(t: WaTemplateRow) {
    setError(null);
    setForm({ id: t.id, name: t.name, visibility: t.visibility, processId: t.processId ?? "", fullText: t.fullText });
  }

  function openDuplicate(t: WaTemplateRow) {
    setError(null);
    setForm({ id: null, name: `${t.name} (Copy)`, visibility: t.visibility, processId: t.processId ?? "", fullText: t.fullText });
  }

  async function submitForm() {
    if (!form) return;
    if (!form.name.trim() || !form.fullText.trim()) {
      setError("Name and template text are required.");
      return;
    }
    if (form.visibility === "process" && !form.processId) {
      setError("Select a process for process-scoped visibility.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        visibility: form.visibility,
        processId: form.visibility === "process" ? form.processId : null,
        fullText: form.fullText,
      };
      const res = await fetch(
        form.id ? `/api/whatsapp-templates/${form.id}` : "/api/whatsapp-templates",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to save template.");
        return;
      }
      setForm(null);
      setSelectedId(json.data.id);
      await refetch();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    const res = await fetch(`/api/whatsapp-templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedId(null);
      await refetch();
    }
  }

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
          value={processFilter}
          onChange={(e) => {
            setProcessFilter(e.target.value);
            refetch(search, e.target.value, visibilityFilter);
          }}
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
          <option value="">Process: All</option>
          {processes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={visibilityFilter}
          onChange={(e) => {
            const v = e.target.value as TemplateVisibility | "";
            setVisibilityFilter(v);
            refetch(search, processFilter, v);
          }}
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
          <option value="">Visibility: All Templates</option>
          <option value="all">All</option>
          <option value="process">Process</option>
          <option value="private">Private</option>
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
            onChange={(e) => {
              setSearch(e.target.value);
              refetch(e.target.value, processFilter, visibilityFilter);
            }}
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
          onClick={openCreate}
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
            opacity: loading ? 0.6 : 1,
          }}
        >
          {templates.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", fontSize: 13, color: "#9AA1AC" }}>No templates found.</div>
          )}
          {templates.map((wt) => {
            const isActive = wt.id === selectedId;
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
                    Created By: <b style={{ color: "#4B5565" }}>{wt.createdByName ?? "--"}</b>
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0, marginTop: 6 }}>
                  <path d="M5 3l4 4-4 4" fill="none" stroke="#9AA1AC" strokeWidth="1.4" />
                </svg>
              </div>
            );
          })}
        </div>

        {form ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1D2433" }}>
                {form.id ? "Edit Template" : "Create New Template"}
              </span>
              <svg
                onClick={() => setForm(null)}
                width="16"
                height="16"
                viewBox="0 0 16 16"
                style={{ cursor: "pointer" }}
              >
                <path d="M3 3l10 10M13 3L3 13" stroke="#6B7280" strokeWidth="1.5" />
              </svg>
            </div>

            <div style={{ fontSize: 13, color: "#4B5565", marginBottom: 6 }}>Name</div>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #D9DCE3",
                borderRadius: 7,
                fontSize: 13,
                marginBottom: 14,
              }}
            />

            <div style={{ fontSize: 13, color: "#4B5565", marginBottom: 6 }}>Visibility</div>
            <select
              value={form.visibility}
              onChange={(e) => setForm({ ...form, visibility: e.target.value as TemplateVisibility })}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #D9DCE3",
                borderRadius: 7,
                fontSize: 13,
                marginBottom: 14,
                background: "#FFFFFF",
              }}
            >
              <option value="all">All</option>
              <option value="process">Process</option>
              <option value="private">Private</option>
            </select>

            {form.visibility === "process" && (
              <>
                <div style={{ fontSize: 13, color: "#4B5565", marginBottom: 6 }}>Process</div>
                <select
                  value={form.processId}
                  onChange={(e) => setForm({ ...form, processId: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1px solid #D9DCE3",
                    borderRadius: 7,
                    fontSize: 13,
                    marginBottom: 14,
                    background: "#FFFFFF",
                  }}
                >
                  <option value="">Select a process</option>
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div style={{ fontSize: 13, color: "#4B5565", marginBottom: 6 }}>
              Template Text (use [Candidate Name], [Your Name], etc. as placeholders)
            </div>
            <textarea
              value={form.fullText}
              onChange={(e) => setForm({ ...form, fullText: e.target.value })}
              rows={8}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #D9DCE3",
                borderRadius: 7,
                fontSize: 13,
                marginBottom: 14,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />

            {error && <div style={{ fontSize: 12.5, color: "#C0392B", marginBottom: 12 }}>{error}</div>}

            <button
              onClick={submitForm}
              disabled={saving}
              style={{
                background: "linear-gradient(180deg,#FF7A50,#FF5C35)",
                border: "none",
                color: "#FFFFFF",
                borderRadius: 7,
                padding: "10px 22px",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        ) : (
          selected && (
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
                <div
                  onClick={() => openEdit(selected)}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#4B5565", cursor: "pointer" }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16">
                    <path d="M9.5 1.5l-6 6v3h3l6-6z" fill="none" stroke="#4B5565" strokeWidth="1.2" />
                  </svg>
                  Edit
                </div>
                <div
                  onClick={() => openDuplicate(selected)}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#4B5565", cursor: "pointer" }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16">
                    <rect x="2" y="4" width="8" height="9" rx="1" fill="none" stroke="#4B5565" strokeWidth="1.2" />
                    <rect x="5" y="1.5" width="8" height="9" rx="1" fill="#FFFFFF" stroke="#4B5565" strokeWidth="1.2" />
                  </svg>
                  Duplicate
                </div>
                <div
                  onClick={() => onDelete(selected.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#4B5565", cursor: "pointer" }}
                >
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
          )
        )}
      </div>
    </div>
  );
}
