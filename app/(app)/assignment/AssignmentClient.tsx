"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UnassignedApplication, WorkloadRow } from "@/lib/assignment";

type AutoMethod = "round_robin" | "load_balanced";
const AUTO_METHOD_LABELS: Record<AutoMethod, string> = { round_robin: "Round Robin", load_balanced: "Load Balanced" };

export default function AssignmentClient({
  initialApplications,
  initialWorkload,
}: {
  initialApplications: UnassignedApplication[];
  initialWorkload: WorkloadRow[];
}) {
  const router = useRouter();
  const [applications, setApplications] = useState<UnassignedApplication[]>(initialApplications);
  const [workload, setWorkload] = useState<WorkloadRow[]>(initialWorkload);
  const [assignMode, setAssignMode] = useState<"auto" | "manual">("auto");
  const [autoMethod, setAutoMethod] = useState<AutoMethod>("load_balanced");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [manualRecruiter, setManualRecruiter] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isAutoMode = assignMode === "auto";
  const isManualMode = assignMode === "manual";

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);
  const selectedCount = selectedIds.length;
  const allSelected = applications.length > 0 && applications.every((a) => selected[a.applicationId]);

  function toggleSelectAll() {
    const allSel = applications.every((a) => selected[a.applicationId]);
    const next: Record<string, boolean> = {};
    applications.forEach((a) => {
      next[a.applicationId] = !allSel;
    });
    setSelected(next);
  }
  function toggleSelectOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function refreshWorkload() {
    try {
      const res = await fetch("/api/assignment/workload");
      if (res.ok) {
        const body = await res.json();
        setWorkload(body.data ?? []);
      }
    } catch {
      // Workload is a secondary panel; a failed refresh here shouldn't block the
      // distribute action from reporting its own result.
    }
  }

  async function onDistributeClick() {
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      let res: Response;
      if (isManualMode) {
        const assignments = selectedIds
          .map((applicationId) => ({ applicationId, recruiterId: manualRecruiter[applicationId] }))
          .filter((a) => a.recruiterId);
        if (assignments.length === 0) {
          setError("Pick a recruiter for at least one selected candidate.");
          setSubmitting(false);
          return;
        }
        res = await fetch("/api/assignment/manual", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ assignments }),
        });
      } else {
        res = await fetch("/api/assignment/auto-distribute", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ applicationIds: selectedIds, method: autoMethod }),
        });
      }

      const bodyJson = await res.json().catch(() => null);
      if (!res.ok) throw new Error(bodyJson?.error?.message ?? "Could not distribute.");

      const result = bodyJson.data as { assigned: { applicationId: string }[]; skipped: { applicationId: string; reason: string }[] };
      const assignedIds = new Set(result.assigned.map((a) => a.applicationId));
      setApplications((prev) => prev.filter((a) => !assignedIds.has(a.applicationId)));
      setSelected({});
      setManualRecruiter({});
      setNotice(
        result.skipped.length
          ? `Assigned ${result.assigned.length}, skipped ${result.skipped.length} (already assigned elsewhere).`
          : `Assigned ${result.assigned.length} candidate${result.assigned.length === 1 ? "" : "s"}.`
      );
      await refreshWorkload();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not distribute.");
    } finally {
      setSubmitting(false);
    }
  }

  const distributeDisabled = selectedCount === 0 || submitting;
  const distributeBg = distributeDisabled ? "#D9DCE3" : "#FF5C35";

  const autoModeStyle = isAutoMode
    ? { background: "#FFFFFF", color: "#1D2433", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }
    : { color: "#6B7280" };
  const manualModeStyle = isManualMode
    ? { background: "#FFFFFF", color: "#1D2433", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }
    : { color: "#6B7280" };

  return (
    <div data-screen-label="Assignment">
      <div style={{ fontSize: 20, fontWeight: 700, color: "#1D2433", marginBottom: 16 }}>Assignment &amp; Distribution</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{applications.length} candidates awaiting assignment</div>
            <div style={{ display: "flex", gap: 4, background: "#F4F5F8", borderRadius: 7, padding: 3 }}>
              <div onClick={() => setAssignMode("auto")} style={{ padding: "6px 14px", borderRadius: 5, fontSize: 12.5, cursor: "pointer", ...autoModeStyle }}>
                Auto-Distribute
              </div>
              <div onClick={() => setAssignMode("manual")} style={{ padding: "6px 14px", borderRadius: 5, fontSize: 12.5, cursor: "pointer", ...manualModeStyle }}>
                Manual Assign
              </div>
            </div>
          </div>

          {isAutoMode && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 12.5, color: "#4B5565" }}>Distribution method:</span>
              <select
                value={autoMethod}
                onChange={(e) => setAutoMethod(e.target.value as AutoMethod)}
                style={{ padding: "7px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5 }}
              >
                <option value="round_robin">Round Robin</option>
                <option value="load_balanced">Load Balanced</option>
              </select>
            </div>
          )}

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, marginBottom: 12 }}>
              {error}
            </div>
          )}
          {notice && (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, marginBottom: 12 }}>
              {notice}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.4fr 2fr 1.5fr 1.6fr",
              gap: 10,
              padding: "8px 10px",
              fontSize: 11.5,
              fontWeight: 600,
              color: "#9AA1AC",
              textTransform: "uppercase",
              borderBottom: "1px solid #EEF0F4",
            }}
          >
            <div>
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            </div>
            <div>Candidate</div>
            <div>Applied For</div>
            <div>Assign To</div>
          </div>
          {applications.map((a) => (
            <div
              key={a.applicationId}
              style={{ display: "grid", gridTemplateColumns: "0.4fr 2fr 1.5fr 1.6fr", gap: 10, alignItems: "center", padding: "10px 10px", borderBottom: "1px solid #F4F5F8" }}
            >
              <div>
                <input type="checkbox" checked={!!selected[a.applicationId]} onChange={() => toggleSelectOne(a.applicationId)} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "#9AA1AC" }}>{a.phone}</div>
              </div>
              <div style={{ fontSize: 13, color: "#4B5565" }}>{a.jobTitle ?? "--"}</div>
              <div>
                {isManualMode && (
                  <select
                    value={manualRecruiter[a.applicationId] || ""}
                    onChange={(e) => setManualRecruiter((prev) => ({ ...prev, [a.applicationId]: e.target.value }))}
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5 }}
                  >
                    <option value="">Select recruiter</option>
                    {workload.map((w) => (
                      <option key={w.recruiterId} value={w.recruiterId}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                )}
                {isAutoMode && <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>Auto ({AUTO_METHOD_LABELS[autoMethod]})</span>}
              </div>
            </div>
          ))}
          {applications.length === 0 && (
            <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "30px 0" }}>No candidates awaiting assignment.</div>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              onClick={onDistributeClick}
              disabled={distributeDisabled}
              style={{
                background: distributeBg,
                border: "none",
                color: "#FFFFFF",
                borderRadius: 6,
                padding: "10px 20px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: distributeDisabled ? "default" : "pointer",
              }}
            >
              {submitting ? "Distributing…" : `Distribute Selected (${selectedCount})`}
            </button>
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Recruiter Workload</div>
          {workload.map((w) => (
            <div key={w.recruiterId} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1D2433", marginBottom: 5 }}>
                <span>{w.name}</span>
                <span style={{ fontWeight: 600 }}>{w.assignedCount}</span>
              </div>
              <div style={{ height: 7, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#FF5C35", borderRadius: 4, width: w.pct }} />
              </div>
            </div>
          ))}
          {workload.length === 0 && <div style={{ fontSize: 12.5, color: "#9AA1AC" }}>No active recruiters.</div>}
        </div>
      </div>
    </div>
  );
}
