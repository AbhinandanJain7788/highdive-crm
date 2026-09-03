"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamRow } from "@/lib/team";

type TeamTab = "active" | "inactive" | "invited";
type RoleOption = { id: string; name: string; dot_color: string | null; badge_bg: string | null };
type ProcessOption = { id: string; name: string };

type TeamClientProps = {
  initialRows: TeamRow[];
  roles: RoleOption[];
  processes: ProcessOption[];
  canManageTeam: boolean;
};

const tabStyle = (active: boolean): React.CSSProperties =>
  active
    ? { color: "#FF5C35", borderBottom: "2px solid #FF5C35" }
    : { color: "#4B5565", borderBottom: "2px solid transparent" };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #D9DCE3",
  borderRadius: 7,
  fontSize: 13,
  color: "#1D2433",
  background: "#FFFFFF",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#4B5565", marginBottom: 5, display: "block" };

function formatJoinedOnClient(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "--";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getUTCDate()).padStart(2, "0")} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

type FormState = {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  processId: string;
  reportsTo: string;
  status: TeamTab;
};

function emptyForm(roles: RoleOption[], processes: ProcessOption[]): FormState {
  return {
    name: "",
    email: "",
    phone: "",
    roleId: roles[0]?.id ?? "",
    processId: processes[0]?.id ?? "",
    reportsTo: "",
    status: "invited",
  };
}

export default function TeamClient({ initialRows, roles, processes, canManageTeam }: TeamClientProps) {
  const router = useRouter();
  const [teamSearch, setTeamSearch] = useState("");
  const [teamTab, setTeamTab] = useState<TeamTab>("active");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"none" | "add" | "edit">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(roles, processes));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usersById = Object.fromEntries(initialRows.map((u) => [u.id, u]));

  const teamRowsAll = initialRows.map((u) => ({
    ...u,
    avatarLetter: u.name.charAt(0).toUpperCase(),
    reportsToName: u.reportsTo?.name ?? "--",
    roleBg: u.role?.badgeBg ?? "#EEF0F5",
    roleColor: u.role?.dotColor ?? "#5B6472",
    roleLabel: u.role?.name ?? "--",
    processLabel: u.process?.name ?? "--",
    joinedOnLabel: formatJoinedOnClient(u.joinedOn),
  }));

  const q = teamSearch.trim().toLowerCase();
  const teamRowsVisible = teamRowsAll.filter(
    (t) =>
      t.status === teamTab &&
      (!q ||
        t.name.toLowerCase().includes(q) ||
        (t.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, "")))
  );

  const teamActiveCount = teamRowsAll.filter((t) => t.status === "active").length;
  const teamInactiveCount = teamRowsAll.filter((t) => t.status === "inactive").length;
  const teamInvitedCount = teamRowsAll.filter((t) => t.status === "invited").length;

  const tabs: { key: TeamTab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: teamActiveCount },
    { key: "inactive", label: "Inactive", count: teamInactiveCount },
    { key: "invited", label: "Invited", count: teamInvitedCount },
  ];

  function openAddModal() {
    setForm(emptyForm(roles, processes));
    setFormError(null);
    setEditingId(null);
    setModalMode("add");
    setOpenMenuId(null);
  }

  function openEditModal(userId: string) {
    const u = usersById[userId];
    if (!u) return;
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone ?? "",
      roleId: u.role?.id ?? "",
      processId: u.process?.id ?? "",
      reportsTo: u.reportsTo?.id ?? "",
      status: u.status,
    });
    setFormError(null);
    setEditingId(userId);
    setModalMode("edit");
    setOpenMenuId(null);
  }

  function closeModal() {
    setModalMode("none");
    setEditingId(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim() || (!editingId && !form.email.trim())) {
      setFormError("Name and email are required.");
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === "add") {
        const res = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            roleId: form.roleId || undefined,
            processId: form.processId || undefined,
            reportsTo: form.reportsTo || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "Could not add user.");
      } else if (modalMode === "edit" && editingId) {
        const res = await fetch(`/api/team/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            role_id: form.roleId || null,
            process_id: form.processId || null,
            reports_to: form.reportsTo || null,
            status: form.status,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "Could not update user.");
      }
      closeModal();
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#1D2433" }}>Team</span>
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
        <div
          style={{
            flex: 1,
            maxWidth: 280,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#FFFFFF",
            border: "1px solid #D9DCE3",
            borderRadius: 7,
            padding: "8px 12px",
          }}
        >
          <input
            type="text"
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            placeholder="Search by Name/Phone"
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
          <option>Process: Default p...</option>
        </select>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 7,
            border: "1px solid #E7E9EE",
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M1 2h12M3.5 7h7M6 12h2" stroke="#4B5565" strokeWidth="1.3" fill="none" />
          </svg>
        </div>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 7,
            border: "1px solid #E7E9EE",
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16">
            <circle cx="6" cy="5.5" r="2.6" fill="none" stroke="#4B5565" strokeWidth="1.3" />
            <path
              d="M1.5 13.5c0-2.4 2-4 4.5-4s4.5 1.6 4.5 4"
              fill="none"
              stroke="#4B5565"
              strokeWidth="1.3"
            />
            <path d="M12 4v4M10 6h4" stroke="#4B5565" strokeWidth="1.3" />
          </svg>
        </div>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 7,
            border: "1px solid #E7E9EE",
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16">
            <circle cx="6" cy="5.5" r="2.6" fill="none" stroke="#4B5565" strokeWidth="1.3" />
            <path
              d="M1.5 13.5c0-2.4 2-4 4.5-4s4.5 1.6 4.5 4"
              fill="none"
              stroke="#4B5565"
              strokeWidth="1.3"
            />
            <path d="M10 8v-4M12 6h-4" stroke="#4B5565" strokeWidth="1.3" />
          </svg>
        </div>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 7,
            border: "1px solid #E7E9EE",
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16">
            <rect x="2" y="2.5" width="12" height="11" rx="1.4" fill="none" stroke="#4B5565" strokeWidth="1.3" />
            <circle cx="6" cy="7" r="1.6" fill="none" stroke="#4B5565" strokeWidth="1.1" />
            <line x1="9" y1="6" x2="12" y2="6" stroke="#4B5565" strokeWidth="1.1" />
            <line x1="9" y1="8.5" x2="12" y2="8.5" stroke="#4B5565" strokeWidth="1.1" />
          </svg>
        </div>
        {canManageTeam && (
          <button
            onClick={openAddModal}
            style={{
              background: "linear-gradient(180deg,#FF7A50,#FF5C35)",
              border: "none",
              color: "#FFFFFF",
              borderRadius: 7,
              padding: "10px 22px",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Add User
          </button>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433", marginBottom: 14 }}>
        Total Licenses : 3 | Used : 1
      </div>

      <div style={{ display: "flex", gap: 28, marginBottom: 2, borderBottom: "1px solid #E7E9EE" }}>
        {tabs.map((t) => (
          <div
            key={t.key}
            onClick={() => setTeamTab(t.key)}
            style={{
              paddingBottom: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              ...tabStyle(teamTab === t.key),
            }}
          >
            {t.label}{" "}
            <span
              style={{
                background: t.key === "active" ? "#FF5C35" : "#EEF0F5",
                color: t.key === "active" ? "#FFFFFF" : "#4B5565",
                borderRadius: 10,
                padding: "1px 8px",
                fontSize: 12,
              }}
            >
              {t.count}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E7E9EE",
          borderRadius: "0 0 10px 10px",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1.2fr 1.6fr 1.2fr 0.9fr 0.9fr 0.9fr 1.1fr 0.6fr",
            gap: 10,
            padding: "12px 18px",
            fontSize: 11.5,
            fontWeight: 600,
            color: "#9AA1AC",
            borderBottom: "1px solid #EEF0F4",
            background: "#FAFBFC",
            whiteSpace: "nowrap",
          }}
        >
          <div>Name</div>
          <div>Mobile Number</div>
          <div>Email</div>
          <div>Processes</div>
          <div>Reports to</div>
          <div>Role</div>
          <div>Add-ons</div>
          <div>Created On</div>
          <div>Actions</div>
        </div>
        {teamRowsVisible.map((t) => (
          <div
            key={t.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1.2fr 1.6fr 1.2fr 0.9fr 0.9fr 0.9fr 1.1fr 0.6fr",
              gap: 10,
              alignItems: "center",
              padding: "13px 18px",
              borderBottom: "1px solid #F4F5F8",
              whiteSpace: "nowrap",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" />
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: t.avatarColor ?? "#9AA1AC",
                  color: "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {t.avatarLetter}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "#9AA1AC" }}>{t.roleLabel}</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{t.phone ?? "--"}</div>
            <div style={{ fontSize: 13, color: "#4B5565" }}>{t.email}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{t.processLabel}</div>
            <div style={{ fontSize: 13, color: "#9AA1AC" }}>{t.reportsToName}</div>
            <div>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: t.roleBg,
                  color: t.roleColor,
                }}
              >
                ● {t.roleLabel}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#9AA1AC" }}>{t.addOns ?? "--"}</div>
            <div style={{ fontSize: 12.5, color: "#4B5565" }}>{t.joinedOnLabel}</div>
            <div style={{ position: "relative" }}>
              <div
                onClick={() => canManageTeam && setOpenMenuId(openMenuId === t.id ? null : t.id)}
                style={{ fontSize: 16, color: "#4B5565", cursor: canManageTeam ? "pointer" : "default" }}
              >
                ⋮
              </div>
              {openMenuId === t.id && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 22,
                    background: "#FFFFFF",
                    border: "1px solid #E7E9EE",
                    borderRadius: 7,
                    boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
                    zIndex: 5,
                    minWidth: 110,
                  }}
                >
                  <div
                    onClick={() => openEditModal(t.id)}
                    style={{ padding: "9px 14px", fontSize: 12.5, color: "#1D2433", cursor: "pointer" }}
                  >
                    Edit
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {modalMode !== "none" && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(29,36,51,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            style={{
              background: "#FFFFFF",
              borderRadius: 10,
              padding: 24,
              width: 380,
              maxWidth: "90vw",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>
              {modalMode === "add" ? "Add User" : "Edit User"}
            </div>

            <label style={labelStyle}>Name</label>
            <input
              style={{ ...inputStyle, marginBottom: 12 }}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />

            {modalMode === "add" && (
              <>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  style={{ ...inputStyle, marginBottom: 12 }}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </>
            )}

            <label style={labelStyle}>Phone</label>
            <input
              style={{ ...inputStyle, marginBottom: 12 }}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />

            <label style={labelStyle}>Role</label>
            <select
              style={{ ...inputStyle, marginBottom: 12 }}
              value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            >
              <option value="">--</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <label style={labelStyle}>Process</label>
            <select
              style={{ ...inputStyle, marginBottom: 12 }}
              value={form.processId}
              onChange={(e) => setForm({ ...form, processId: e.target.value })}
            >
              <option value="">--</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <label style={labelStyle}>Reports To</label>
            <select
              style={{ ...inputStyle, marginBottom: 12 }}
              value={form.reportsTo}
              onChange={(e) => setForm({ ...form, reportsTo: e.target.value })}
            >
              <option value="">--</option>
              {initialRows
                .filter((u) => u.id !== editingId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>

            {modalMode === "edit" && (
              <>
                <label style={labelStyle}>Status</label>
                <select
                  style={{ ...inputStyle, marginBottom: 12 }}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as TeamTab })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="invited">Invited</option>
                </select>
              </>
            )}

            {formError && (
              <div style={{ fontSize: 12.5, color: "#C0392B", marginBottom: 10 }}>{formError}</div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #D9DCE3",
                  color: "#4B5565",
                  borderRadius: 7,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: "linear-gradient(180deg,#FF7A50,#FF5C35)",
                  border: "none",
                  color: "#FFFFFF",
                  borderRadius: 7,
                  padding: "9px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: submitting ? "default" : "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Saving..." : modalMode === "add" ? "Send Invite" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
