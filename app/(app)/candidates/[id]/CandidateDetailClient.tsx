"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { statusStyles, avatarColorFor, avatarLetterFor, type ApplicationStatus } from "@/lib/mock";
import { callDispositionStyles, fmtDuration } from "@/lib/mock/styles";
import type { CandidateDetail } from "@/lib/candidates.shared";
import type { CallRow } from "@/lib/calls.shared";

const statusKeys = Object.keys(statusStyles) as ApplicationStatus[];

export default function CandidateDetailClient({
  candidate,
  canEdit,
  calls,
}: {
  candidate: CandidateDetail;
  canEdit: boolean;
  calls: CallRow[];
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

  // Schedule Follow-up — writes a real `follow_ups` row against the candidate's
  // primary application (Phase 5). The signed-off HTML's freeform text input
  // ("e.g. 3 Sep, 11:00 AM") is swapped for a real datetime-local input since a
  // working Schedule action needs an actual parseable due_at, not a string a
  // natural-language date parser would have to guess at.
  const [dueAt, setDueAt] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  async function scheduleFollowUp() {
    if (!primary || !dueAt) return;
    const dueAtMs = new Date(dueAt).getTime();
    if (Number.isNaN(dueAtMs)) {
      setScheduleError("Pick a valid date and time.");
      return;
    }
    setScheduling(true);
    setScheduleError(null);
    setScheduleNotice(null);
    try {
      const endpoint = isRecurring ? "/api/follow-ups/recurring" : "/api/follow-ups";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          applicationId: primary.id,
          dueAt: new Date(dueAtMs).toISOString(),
          ...(isRecurring ? { recurrenceRule: recurrenceRule || "Weekly" } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not schedule the follow-up.");
      }
      setScheduleNotice("Follow-up scheduled.");
      setDueAt("");
      setIsRecurring(false);
      setRecurrenceRule("");
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Could not schedule the follow-up.");
    } finally {
      setScheduling(false);
    }
  }

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
          {calls.length > 0 ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1.4fr", gap: 10, padding: "8px 10px", fontSize: 11.5, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", borderBottom: "1px solid #EEF0F4" }}>
                <div>Date</div>
                <div>By</div>
                <div>Duration</div>
                <div>Disposition</div>
                <div>Recording</div>
              </div>
              {calls.map((call) => {
                const dispStyle = call.disposition ? callDispositionStyles[call.disposition] : null;
                return (
                  <div key={call.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1.4fr", gap: 10, alignItems: "center", padding: "10px 10px", borderBottom: "1px solid #F4F5F8" }}>
                    <div style={{ fontSize: 12.5, color: "#4B5565" }}>{call.calledAt}</div>
                    <div style={{ fontSize: 12.5, color: "#4B5565" }}>{call.byUserName ?? "--"}</div>
                    <div style={{ fontSize: 12.5, color: "#1D2433" }}>{fmtDuration(call.durationSeconds)}</div>
                    <div>
                      {dispStyle ? (
                        <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: dispStyle.bg, color: dispStyle.color }}>
                          {dispStyle.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#9AA1AC" }}>--</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: call.hasRecording ? "#1E7F43" : "#9AA1AC" }}>
                      {call.hasRecording ? "Available" : "Not Available"}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>No calls made yet.</div>
          )}

          <div style={{ marginTop: 16, borderTop: "1px solid #EEF0F4", paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", marginBottom: 8 }}>
              Schedule Follow-up
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <input
                type="datetime-local"
                value={dueAt}
                disabled={!primary || !canEdit}
                onChange={(e) => setDueAt(e.target.value)}
                title={primary ? undefined : "This candidate has no application to schedule a follow-up against."}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  border: "1px solid #D9DCE3",
                  borderRadius: 6,
                  fontSize: 13,
                  background: !primary || !canEdit ? "#F7F8FA" : "#FFFFFF",
                  color: !primary || !canEdit ? "#9AA1AC" : "#1D2433",
                }}
              />
              <button
                onClick={scheduleFollowUp}
                disabled={!primary || !canEdit || !dueAt || scheduling}
                style={{
                  background: !primary || !canEdit || !dueAt ? "#F7F8FA" : "#FF5C35",
                  border: !primary || !canEdit || !dueAt ? "1px solid #E7E9EE" : "none",
                  color: !primary || !canEdit || !dueAt ? "#9AA1AC" : "#FFFFFF",
                  borderRadius: 6,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !primary || !canEdit || !dueAt || scheduling ? "default" : "pointer",
                }}
              >
                {scheduling ? "Scheduling…" : "Schedule"}
              </button>
            </div>
            {primary && canEdit && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#4B5565", marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
                Recurring
                {isRecurring && (
                  <input
                    type="text"
                    value={recurrenceRule}
                    onChange={(e) => setRecurrenceRule(e.target.value)}
                    placeholder="e.g. Weekly"
                    style={{ marginLeft: 6, padding: "5px 8px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, width: 120 }}
                  />
                )}
              </label>
            )}
            {scheduleNotice && <div style={{ fontSize: 12.5, color: "#1E7F43" }}>{scheduleNotice}</div>}
            {scheduleError && <div style={{ fontSize: 12.5, color: "#B42318" }}>{scheduleError}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
