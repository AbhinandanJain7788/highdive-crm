"use client";

import { useState } from "react";
import type { RoleWithPermissions } from "@/lib/roles";

type PermissionRow = { id: string; key: string; label: string; category: string | null };

const PREVIEW_COUNT = 3;

function formatCreatedOn(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const day = d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
  return `${time}, ${day}`;
}

const DOT_COLOR_OPTIONS = [
  { dotColor: "#B33FA0", badgeBg: "#F6E4F5" },
  { dotColor: "#5B6472", badgeBg: "#EEF0F5" },
  { dotColor: "#1E7F43", badgeBg: "#E6F4EA" },
  { dotColor: "#1A56DB", badgeBg: "#E8F0FE" },
  { dotColor: "#FF5C35", badgeBg: "#FFE9E1" },
];

export default function RolesPermissionsClient({
  initialRoles,
  permissions,
  canManage,
}: {
  initialRoles: RoleWithPermissions[];
  permissions: PermissionRow[];
  canManage: boolean;
}) {
  const [roles, setRoles] = useState<RoleWithPermissions[]>(initialRoles);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = Array.from(new Set(permissions.map((p) => p.category ?? "General")));

  function toggleKey(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetForm() {
    setName("");
    setColorIndex(0);
    setSelectedKeys(new Set());
    setError(null);
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const color = DOT_COLOR_OPTIONS[colorIndex];
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          dot_color: color.dotColor,
          badge_bg: color.badgeBg,
          permissionKeys: Array.from(selectedKeys),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Failed to create role.");
        return;
      }
      setRoles((prev) => [...prev, json.data as RoleWithPermissions]);
      setModalOpen(false);
      resetForm();
    } catch {
      setError("Failed to create role. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>Roles & Permissions</div>
        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(180deg,#FF7A50,#FF5C35)",
              border: "none",
              color: "#FFFFFF",
              borderRadius: 7,
              padding: "10px 20px",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 15 }}>+</span>Add a Role
          </button>
        )}
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 3fr 0.8fr 1.2fr 0.6fr",
            gap: 10,
            padding: "12px 20px",
            fontSize: 12,
            fontWeight: 600,
            color: "#9AA1AC",
            borderBottom: "1px solid #EEF0F4",
            background: "#FAFBFC",
          }}
        >
          <div>Role Name</div>
          <div>Permissions</div>
          <div>Users</div>
          <div>Created On</div>
          <div>Actions</div>
        </div>
        {roles.map((r) => {
          const preview = r.permissions.slice(0, PREVIEW_COUNT).map((p) => p.label).join(", ");
          const moreCount = Math.max(0, r.permissions.length - PREVIEW_COUNT);
          return (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 3fr 0.8fr 1.2fr 0.6fr",
                gap: 10,
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid #F4F5F8",
              }}
            >
              <div>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: r.dotColor ?? "#5B6472",
                    background: r.badgeBg ?? "#EEF0F5",
                    padding: "4px 12px",
                    borderRadius: 20,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: r.dotColor ?? "#5B6472" }} />
                  {r.name}
                </span>
              </div>
              <div style={{ fontSize: 13.5, color: "#4B5565" }}>
                {preview || "No permissions"}
                {moreCount > 0 && <span style={{ color: "#FF5C35", fontWeight: 600 }}> +{moreCount} More</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "#FF5C35" }}>
                <svg width="14" height="14" viewBox="0 0 16 16">
                  <circle cx="6" cy="5" r="2.4" fill="none" stroke="#FF5C35" strokeWidth="1.3" />
                  <path
                    d="M1.5 13.5c0-2.4 2-4 4.5-4s4.5 1.6 4.5 4"
                    fill="none"
                    stroke="#FF5C35"
                    strokeWidth="1.3"
                  />
                </svg>
                {r.userCount}
              </div>
              <div style={{ fontSize: 12.5, color: "#4B5565" }}>{formatCreatedOn(r.createdAt)}</div>
              <div style={{ fontSize: 16, color: "#4B5565", cursor: "pointer" }}>⋮</div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(23,26,32,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => !submitting && setModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF",
              borderRadius: 12,
              padding: 24,
              width: 460,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>Add a Role</div>

            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>
              Role Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Team Lead"
              style={{
                width: "100%",
                border: "1px solid #D9DCE3",
                borderRadius: 7,
                padding: "9px 12px",
                fontSize: 13.5,
                marginBottom: 16,
                boxSizing: "border-box",
              }}
            />

            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>
              Colour
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {DOT_COLOR_OPTIONS.map((c, i) => (
                <div
                  key={c.dotColor}
                  onClick={() => setColorIndex(i)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: c.dotColor,
                    cursor: "pointer",
                    border: colorIndex === i ? "2px solid #1D2433" : "2px solid transparent",
                  }}
                />
              ))}
            </div>

            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>
              Permissions
            </label>
            <div style={{ marginBottom: 16 }}>
              {categories.map((category) => (
                <div key={category} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#9AA1AC", marginBottom: 4 }}>
                    {category}
                  </div>
                  {permissions
                    .filter((p) => (p.category ?? "General") === category)
                    .map((p) => (
                      <label
                        key={p.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 13,
                          color: "#1D2433",
                          padding: "4px 0",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(p.key)}
                          onChange={() => toggleKey(p.key)}
                        />
                        {p.label}
                      </label>
                    ))}
                </div>
              ))}
            </div>

            {error && <div style={{ color: "#D64545", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => {
                  if (submitting) return;
                  setModalOpen(false);
                  resetForm();
                }}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #D9DCE3",
                  color: "#4B5565",
                  borderRadius: 7,
                  padding: "9px 18px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                style={{
                  background: "linear-gradient(180deg,#FF7A50,#FF5C35)",
                  border: "none",
                  color: "#FFFFFF",
                  borderRadius: 7,
                  padding: "9px 18px",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: submitting ? "default" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Creating…" : "Create Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
