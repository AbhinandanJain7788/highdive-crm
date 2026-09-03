"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { statusStyles, avatarColorFor, avatarLetterFor, type ApplicationStatus } from "@/lib/mock";
import type { CandidateDetail } from "@/lib/candidates.shared";

const statusKeys = Object.keys(statusStyles) as ApplicationStatus[];

export default function CandidateDetailClient({
  candidate,
  canEdit,
}: {
  candidate: CandidateDetail;
  canEdit: boolean;
}) {
  const router = useRouter();

  // The row's primary application — the most recent one, the same rule the list
  // uses. Any others are listed below so a multi-job candidate isn't misread as
  // having only this one.
  const primary = candidate.applications[0] ?? null;
  const otherApplications = candidate.applications.slice(1);

  const [status, setStatus] = useState<ApplicationStatus | "">(primary?.status ?? "");
  const [notes, setNotes] = useState(candidate.notes);
  const [savedNotes, setSavedNotes] = useState(candidate.notes);
  const [saving, setSaving] = useState<"status" | "notes" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveStatus(next: ApplicationStatus) {
    if (!primary) return;
    const previous = status;
    setStatus(next);
    setSaving("status");
    setError(null);
    try {
      const res = await fetch(`/api/applications/${primary.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not update status.");
      }
      router.refresh();
    } catch (err) {
      setStatus(previous);
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setSaving(null);
    }
  }

  async function saveNotes() {
    setSaving("notes");
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not save notes.");
      }
      setSavedNotes(notes);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notes.");
    } finally {
      setSaving(null);
    }
  }

  const resumeLabel = candidate.hasResume ? "On file" : "Not uploaded";

  return (
    <div data-screen-label="Candidate Detail">
      <div
        onClick={() => router.push("/candidates")}
        style={{ fontSize: 13, color: "#6B7280", cursor: "pointer", marginBottom: 14 }}
      >
        ← Back to Candidates
      </div>

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#B42318",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
        <div>
          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: avatarColorFor(candidate.name),
                  color: "#FFFFFF",
                  fontSize: 18,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {avatarLetterFor(candidate.name)}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1D2433" }}>{candidate.name}</div>
                <div style={{ fontSize: 12.5, color: "#9AA1AC" }}>{candidate.phone || "--"}</div>
              </div>
              {candidate.isDuplicate && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    background: "#FFF4E5",
                    color: "#B15C00",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  DUP
                </span>
              )}
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", marginBottom: 6 }}>
              Status
            </div>
            <select
              value={status}
              disabled={!primary || !canEdit || saving === "status"}
              onChange={(e) => saveStatus(e.target.value as ApplicationStatus)}
              title={primary ? undefined : "This candidate has no application yet."}
              style={{
                width: "100%",
                padding: "9px 10px",
                border: "1px solid #D9DCE3",
                borderRadius: 6,
                fontSize: 13,
                color: "#1D2433",
                marginBottom: 16,
                background: !primary || !canEdit ? "#F7F8FA" : "#FFFFFF",
              }}
            >
              {!primary && <option value="">No application</option>}
              {statusKeys.map((opt) => (
                <option key={opt} value={opt}>
                  {statusStyles[opt].label}
                </option>
              ))}
            </select>

            <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", marginBottom: 6 }}>
              Assigned Recruiter
            </div>
            {/* Read-only here by design: changing an assignment writes the
                `assignments` table under a one-active-assignment-per-application
                constraint, which is Phase 4's allocation flow. Showing the real
                current holder beats a dropdown that silently discards the change. */}
            <div
              title="Reassignment is handled by the Assignment screen (Phase 4)"
              style={{
                width: "100%",
                padding: "9px 10px",
                border: "1px solid #E7E9EE",
                borderRadius: 6,
                fontSize: 13,
                color: primary?.recruiter ? "#1D2433" : "#9AA1AC",
                marginBottom: 16,
                background: "#F7F8FA",
              }}
            >
              {primary?.recruiter?.name ?? "Unassigned"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13, color: "#1D2433" }}>
              <div>
                <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Applied For</div>
                {primary?.job?.title ?? "--"}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Source</div>
                {candidate.source || "--"}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Created On</div>
                {candidate.createdOn}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Resume</div>
                {resumeLabel}
              </div>
            </div>

            {otherApplications.length > 0 && (
              <div style={{ marginTop: 16, borderTop: "1px solid #EEF0F4", paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", marginBottom: 8 }}>
                  Other Applications
                </div>
                {otherApplications.map((a) => (
                  <div
                    key={a.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}
                  >
                    <span style={{ fontSize: 12.5, color: "#4B5565" }}>{a.job?.title ?? "--"}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: statusStyles[a.status].bg,
                        color: statusStyles[a.status].color,
                      }}
                    >
                      {statusStyles[a.status].label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 10 }}>Notes</div>
            {canEdit ? (
              <>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="No notes added yet."
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    border: "1px solid #D9DCE3",
                    borderRadius: 6,
                    fontSize: 13,
                    color: "#4B5565",
                    lineHeight: 1.5,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
                {notes !== savedNotes && (
                  <button
                    onClick={saveNotes}
                    disabled={saving === "notes"}
                    style={{
                      marginTop: 8,
                      background: "#FF5C35",
                      border: "none",
                      color: "#FFFFFF",
                      borderRadius: 6,
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: saving === "notes" ? "default" : "pointer",
                      opacity: saving === "notes" ? 0.7 : 1,
                    }}
                  >
                    {saving === "notes" ? "Saving…" : "Save Notes"}
                  </button>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#4B5565", lineHeight: 1.5 }}>{savedNotes || "No notes added yet."}</div>
            )}
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Call History</div>
          {/* TODO(phase-5): call rows come from the `calls` table, written by the
              Android app. An explicit empty state, not mock rows that would read as
              this candidate's real call history. */}
          <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>
            Call history is wired in Phase 5.
          </div>

          <div style={{ marginTop: 16, borderTop: "1px solid #EEF0F4", paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", marginBottom: 8 }}>
              Schedule Follow-up
            </div>
            {/* TODO(phase-5): writes a `follow_ups` row. Disabled rather than
                accepting input it would throw away. */}
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                disabled
                placeholder="Follow-ups are wired in Phase 5"
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  border: "1px solid #E7E9EE",
                  borderRadius: 6,
                  fontSize: 13,
                  background: "#F7F8FA",
                  color: "#9AA1AC",
                }}
              />
              <button
                disabled
                style={{
                  background: "#F7F8FA",
                  border: "1px solid #E7E9EE",
                  color: "#9AA1AC",
                  borderRadius: 6,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "default",
                }}
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
