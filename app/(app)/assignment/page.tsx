"use client";

import { useMemo, useState } from "react";
import { candidatesSeed, recruiters, jobsSeed, type MockCandidate } from "@/lib/mock";

type AutoMethod = "Round Robin" | "Load Balanced";

const recruiterNames = recruiters.map((r) => r.name);

function jobTitleFor(jobId: string) {
  const job = jobsSeed.find((j) => j.id === jobId);
  return job ? job.title : jobId;
}

export default function AssignmentPage() {
  const [candidates, setCandidates] = useState<MockCandidate[]>(candidatesSeed);
  const [assignMode, setAssignMode] = useState<"auto" | "manual">("auto");
  const [autoMethod, setAutoMethod] = useState<AutoMethod>("Load Balanced");
  const [selectedForAssign, setSelectedForAssign] = useState<Record<string, boolean>>({});
  const [manualAssignee, setManualAssignee] = useState<Record<string, string>>({});
  const [roundRobinIndex, setRoundRobinIndex] = useState(0);

  const isAutoMode = assignMode === "auto";
  const isManualMode = assignMode === "manual";

  const unassignedList = useMemo(() => candidates.filter((c) => !c.recruiterId), [candidates]);
  const unassignedCount = unassignedList.length;
  const selectedCount = Object.values(selectedForAssign).filter(Boolean).length;
  const allSelected = unassignedList.length > 0 && unassignedList.every((c) => !!selectedForAssign[c.id]);

  const maxWorkload = Math.max(1, ...recruiters.map((r) => candidates.filter((c) => c.recruiterId === r.id).length));
  const recruiterWorkload = recruiters.map((r) => {
    const count = candidates.filter((c) => c.recruiterId === r.id).length;
    return { id: r.id, name: r.name, assignedCount: count, pct: Math.max(4, Math.round((count / maxWorkload) * 100)) + "%" };
  });

  const toggleSelectAll = () => {
    const allSel = unassignedList.every((c) => !!selectedForAssign[c.id]);
    const next: Record<string, boolean> = {};
    unassignedList.forEach((c) => {
      next[c.id] = !allSel;
    });
    setSelectedForAssign(next);
  };

  const toggleSelectOne = (id: string) => {
    setSelectedForAssign((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setManualAssigneeFor = (id: string, name: string) => {
    setManualAssignee((prev) => ({ ...prev, [id]: name }));
  };

  const onDistributeClick = () => {
    let idx = roundRobinIndex;
    const names = recruiters.map((r) => r.name);
    const updated = candidates.map((c) => {
      if (!selectedForAssign[c.id]) return c;
      if (assignMode === "manual") {
        const recName = manualAssignee[c.id];
        if (!recName) return c;
        const rec = recruiters.find((r) => r.name === recName);
        return rec ? { ...c, recruiterId: rec.id } : c;
      }
      const recName = names[idx % names.length];
      const rec = recruiters.find((r) => r.name === recName);
      idx++;
      return rec ? { ...c, recruiterId: rec.id } : c;
    });
    setCandidates(updated);
    setSelectedForAssign({});
    setManualAssignee({});
    setRoundRobinIndex(idx);
  };

  const distributeDisabled = selectedCount === 0;
  const distributeBg = selectedCount === 0 ? "#D9DCE3" : "#FF5C35";

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
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D2433" }}>{unassignedCount} candidates awaiting assignment</div>
            <div style={{ display: "flex", gap: 4, background: "#F4F5F8", borderRadius: 7, padding: 3 }}>
              <div
                onClick={() => setAssignMode("auto")}
                style={{ padding: "6px 14px", borderRadius: 5, fontSize: 12.5, cursor: "pointer", ...autoModeStyle }}
              >
                Auto-Distribute
              </div>
              <div
                onClick={() => setAssignMode("manual")}
                style={{ padding: "6px 14px", borderRadius: 5, fontSize: 12.5, cursor: "pointer", ...manualModeStyle }}
              >
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
                <option value="Round Robin">Round Robin</option>
                <option value="Load Balanced">Load Balanced</option>
              </select>
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
          {unassignedList.map((c) => (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "0.4fr 2fr 1.5fr 1.6fr",
                gap: 10,
                alignItems: "center",
                padding: "10px 10px",
                borderBottom: "1px solid #F4F5F8",
              }}
            >
              <div>
                <input type="checkbox" checked={!!selectedForAssign[c.id]} onChange={() => toggleSelectOne(c.id)} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1D2433" }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "#9AA1AC" }}>{c.phone}</div>
              </div>
              <div style={{ fontSize: 13, color: "#4B5565" }}>{jobTitleFor(c.jobId)}</div>
              <div>
                {isManualMode && (
                  <select
                    value={manualAssignee[c.id] || ""}
                    onChange={(e) => setManualAssigneeFor(c.id, e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5 }}
                  >
                    {recruiterNames.map((rn) => (
                      <option key={rn} value={rn}>
                        {rn}
                      </option>
                    ))}
                  </select>
                )}
                {isAutoMode && <span style={{ fontSize: 12.5, color: "#9AA1AC" }}>Auto ({autoMethod})</span>}
              </div>
            </div>
          ))}

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
                cursor: "pointer",
              }}
            >
              Distribute Selected ({selectedCount})
            </button>
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Recruiter Workload</div>
          {recruiterWorkload.map((w) => (
            <div key={w.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1D2433", marginBottom: 5 }}>
                <span>{w.name}</span>
                <span style={{ fontWeight: 600 }}>{w.assignedCount}</span>
              </div>
              <div style={{ height: 7, background: "#EEF0F5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#FF5C35", borderRadius: 4, width: w.pct }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
