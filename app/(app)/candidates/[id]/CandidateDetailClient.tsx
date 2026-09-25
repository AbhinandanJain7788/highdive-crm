"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { statusStyles, avatarColorFor, avatarLetterFor, type ApplicationStatus } from "@/lib/mock";
import { callDispositionStyles, fmtDuration } from "@/lib/mock/styles";
import type { CandidateDetail } from "@/lib/candidates.shared";
import type { CallRow } from "@/lib/calls.shared";
import type { FollowUpRow } from "@/lib/followups.shared";
import type { InterviewRow } from "@/lib/interviews.shared";
import { interviewStatusStyles } from "@/lib/interviews.shared";

const followUpStatusStyles: Record<FollowUpRow["followUpStatus"], { bg: string; color: string; label: string }> = {
  pending: { bg: "#FFF4E5", color: "#B15C00", label: "Pending" },
  completed: { bg: "#E7F6EC", color: "#1E7F43", label: "Completed" },
  cancelled: { bg: "#F4F5F8", color: "#6B7280", label: "Cancelled" },
};

const statusKeys = Object.keys(statusStyles) as ApplicationStatus[];

type AutoMethod = "round_robin" | "load_balanced";

export default function CandidateDetailClient({
  candidate,
  canEdit,
  canAssign,
  calls,
  onClose,
  onStatusChanged,
  onRecruiterChanged,
}: {
  candidate: CandidateDetail;
  canEdit: boolean;
  canAssign: boolean;
  calls: CallRow[];
  // Set only when this is rendered inline (e.g. the Allocations detail modal)
  // instead of as its own routed page — swaps the "Back to Candidates" nav
  // for a plain close action and lets the caller sync its own row state.
  onClose?: () => void;
  onStatusChanged?: (status: ApplicationStatus) => void;
  onRecruiterChanged?: (recruiterName: string) => void;
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

  // Assigned Recruiter — was read-only by design (a dropdown that silently discarded
  // the change); now a real editor calling the same reassign/auto-distribute endpoints
  // the Assignment screen uses, so this is the one place Assign To can actually change.
  const [recruiterName, setRecruiterName] = useState(primary?.recruiter?.name ?? null);
  const [assignEditing, setAssignEditing] = useState(false);
  const [assignMode, setAssignMode] = useState<"manual" | "auto">("manual");
  const [teamOptions, setTeamOptions] = useState<{ id: string; name: string }[]>([]);
  const [manualRecruiterId, setManualRecruiterId] = useState("");
  const [autoMethod, setAutoMethod] = useState<AutoMethod>("load_balanced");
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (!canAssign && !canEdit) return;
    let cancelled = false;
    fetch("/api/team?status=active")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body) => {
        if (!cancelled) setTeamOptions(body.data ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canAssign, canEdit]);

  async function submitAssign() {
    if (!primary) return;
    setAssigning(true);
    setAssignError(null);
    try {
      if (assignMode === "manual") {
        if (!manualRecruiterId) {
          setAssignError("Pick a recruiter.");
          return;
        }
        const res = await fetch("/api/assignment/reassign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ applicationId: primary.id, recruiterId: manualRecruiterId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? "Could not assign this candidate.");
        }
        const name = teamOptions.find((t) => t.id === manualRecruiterId)?.name ?? "Assigned";
        setRecruiterName(name);
        onRecruiterChanged?.(name);
      } else {
        const res = await fetch("/api/assignment/auto-distribute", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ applicationIds: [primary.id], method: autoMethod }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not auto-assign this candidate.");
        const assigned = body?.data?.assigned?.[0];
        if (!assigned) {
          throw new Error(
            body?.data?.skipped?.[0]?.reason ??
              "This candidate is already assigned — auto-distribute only picks up unassigned candidates. Use Manual to reassign."
          );
        }
        setRecruiterName(assigned.recruiterName);
        onRecruiterChanged?.(assigned.recruiterName);
      }
      setAssignEditing(false);
      setManualRecruiterId("");
      if (!onClose) router.refresh();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Could not update the assignment.");
    } finally {
      setAssigning(false);
    }
  }

  // Schedule Follow-up — writes a real `follow_ups` row against the candidate's
  // primary application (Phase 5). The signed-off HTML's freeform text input
  // ("e.g. 3 Sep, 11:00 AM") is swapped for a real datetime-local input since a
  // working Schedule action needs an actual parseable due_at, not a string a
  // natural-language date parser would have to guess at.
  const [dueAt, setDueAt] = useState("");
  // Follow-up frequency — replaces the old bare "Recurring" checkbox + freeform
  // text box with the same Default/Custom split the tier-cadence picker uses,
  // minus the per-tier defaults and weekday selector (nothing in this schema
  // ties a candidate to a tier or a specific contact day, so those would just be
  // decoration). "weekly" is the one-click default; "custom" takes a day count.
  const [frequency, setFrequency] = useState<"once" | "weekly" | "custom">("once");
  const [customDays, setCustomDays] = useState("14");
  const isRecurring = frequency !== "once";
  const recurrenceRule =
    frequency === "weekly" ? "Weekly" : frequency === "custom" ? `Every ${customDays || "14"} days` : "";
  const [scheduling, setScheduling] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Follow-Up History — surfaces every follow-up (pending, completed, cancelled)
  // scheduled against this candidate, since previously the only way to find one
  // after marking it complete on /follow-ups was to leave the candidate page,
  // go to the global list, and search for them again.
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState(true);
  const [followUpsError, setFollowUpsError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  async function loadFollowUps() {
    setFollowUpsLoading(true);
    setFollowUpsError(null);
    try {
      const res = await fetch(`/api/follow-ups?candidateId=${candidate.id}&sort=due-desc&pageSize=50`);
      if (!res.ok) throw new Error("Could not load follow-up history.");
      const body = await res.json();
      setFollowUps(body.data ?? []);
    } catch (err) {
      setFollowUpsError(err instanceof Error ? err.message : "Could not load follow-up history.");
    } finally {
      setFollowUpsLoading(false);
    }
  }

  useEffect(() => {
    loadFollowUps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id]);

  async function completeFollowUp(id: string) {
    setCompletingId(id);
    try {
      const res = await fetch(`/api/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not complete follow-up.");
      }
      await loadFollowUps();
    } catch (err) {
      setFollowUpsError(err instanceof Error ? err.message : "Could not complete follow-up.");
    } finally {
      setCompletingId(null);
    }
  }

  // Interviews — schedule against the candidate's primary application; the
  // client is derived server-side from the application's job (jobs.client_id),
  // so this form only needs an interviewer and a date/time.
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [interviewsLoading, setInterviewsLoading] = useState(true);
  const [interviewsError, setInterviewsError] = useState<string | null>(null);

  const [interviewAt, setInterviewAt] = useState("");
  const [interviewerId, setInterviewerId] = useState("");
  const [interviewLocation, setInterviewLocation] = useState("");
  const [scheduling2, setScheduling2] = useState(false);
  const [interviewNotice, setInterviewNotice] = useState<string | null>(null);
  const [updatingInterviewId, setUpdatingInterviewId] = useState<string | null>(null);

  async function loadInterviews() {
    setInterviewsLoading(true);
    setInterviewsError(null);
    try {
      const res = await fetch(`/api/interviews?candidateId=${candidate.id}`);
      if (!res.ok) throw new Error("Could not load interviews.");
      const body = await res.json();
      setInterviews(body.data ?? []);
    } catch (err) {
      setInterviewsError(err instanceof Error ? err.message : "Could not load interviews.");
    } finally {
      setInterviewsLoading(false);
    }
  }

  useEffect(() => {
    loadInterviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.id]);

  async function scheduleInterview() {
    if (!primary || !interviewAt) return;
    const atMs = new Date(interviewAt).getTime();
    if (Number.isNaN(atMs)) {
      setInterviewsError("Pick a valid date and time.");
      return;
    }
    setScheduling2(true);
    setInterviewsError(null);
    setInterviewNotice(null);
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          applicationId: primary.id,
          scheduledAt: new Date(atMs).toISOString(),
          interviewerId: interviewerId || undefined,
          location: interviewLocation || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not schedule the interview.");
      }
      setInterviewNotice("Interview scheduled.");
      setInterviewAt("");
      setInterviewerId("");
      setInterviewLocation("");
      await loadInterviews();
    } catch (err) {
      setInterviewsError(err instanceof Error ? err.message : "Could not schedule the interview.");
    } finally {
      setScheduling2(false);
    }
  }

  async function setInterviewStatus(id: string, status: "completed" | "cancelled" | "no_show") {
    setUpdatingInterviewId(id);
    try {
      const res = await fetch(`/api/interviews/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not update the interview.");
      }
      await loadInterviews();
    } catch (err) {
      setInterviewsError(err instanceof Error ? err.message : "Could not update the interview.");
    } finally {
      setUpdatingInterviewId(null);
    }
  }

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
          ...(isRecurring ? { recurrenceRule } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not schedule the follow-up.");
      }
      setScheduleNotice("Follow-up scheduled.");
      setDueAt("");
      setFrequency("once");
      setCustomDays("14");
      await loadFollowUps();
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
      onStatusChanged?.(next);
      if (!onClose) router.refresh();
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
      if (!onClose) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notes.");
    } finally {
      setSaving(null);
    }
  }

  const resumeLabel = candidate.hasResume ? "On file" : "Not uploaded";

  return (
    <div data-screen-label="Candidate Detail">
      {onClose ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 10 }}>
          <div onClick={onClose} style={{ cursor: "pointer", fontSize: 22, color: "#9AA1AC", lineHeight: 1 }}>
            ×
          </div>
        </div>
      ) : (
        <div
          onClick={() => router.push("/candidates")}
          style={{ fontSize: 13, color: "#6B7280", cursor: "pointer", marginBottom: 14 }}
        >
          ← Back to Candidates
        </div>
      )}

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
          <div style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,40,0.04)", padding: 20, marginBottom: 16 }}>
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

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase" }}>
                Assigned Recruiter
              </div>
              {canAssign && primary && !assignEditing && (
                <div
                  onClick={() => {
                    setAssignEditing(true);
                    setAssignError(null);
                  }}
                  style={{ fontSize: 12, fontWeight: 600, color: "#FF5C35", cursor: "pointer" }}
                >
                  Change
                </div>
              )}
            </div>

            {!assignEditing ? (
              <div
                title={!primary ? "This candidate has no application to assign." : undefined}
                style={{
                  width: "100%",
                  padding: "9px 10px",
                  border: "1px solid #E7E9EE",
                  borderRadius: 6,
                  fontSize: 13,
                  color: recruiterName ? "#1D2433" : "#9AA1AC",
                  marginBottom: 16,
                  background: "#F7F8FA",
                }}
              >
                {recruiterName ?? "Unassigned"}
              </div>
            ) : (
              <div style={{ border: "1px solid #E7E9EE", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 4, background: "#F4F5F8", borderRadius: 6, padding: 3, marginBottom: 10 }}>
                  <div
                    onClick={() => setAssignMode("manual")}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "6px 0",
                      borderRadius: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: assignMode === "manual" ? "#FFFFFF" : "transparent",
                      color: assignMode === "manual" ? "#1D2433" : "#6B7280",
                    }}
                  >
                    Manual Assign
                  </div>
                  <div
                    onClick={() => setAssignMode("auto")}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "6px 0",
                      borderRadius: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      background: assignMode === "auto" ? "#FFFFFF" : "transparent",
                      color: assignMode === "auto" ? "#1D2433" : "#6B7280",
                    }}
                  >
                    Automatic Assign
                  </div>
                </div>

                {assignMode === "manual" ? (
                  <select
                    value={manualRecruiterId}
                    onChange={(e) => setManualRecruiterId(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, marginBottom: 10 }}
                  >
                    <option value="">Select recruiter</option>
                    {teamOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={autoMethod}
                    onChange={(e) => setAutoMethod(e.target.value as AutoMethod)}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5, marginBottom: 10 }}
                  >
                    <option value="load_balanced">Load Balanced</option>
                    <option value="round_robin">Round Robin</option>
                  </select>
                )}

                {assignError && <div style={{ fontSize: 12, color: "#B42318", marginBottom: 8 }}>{assignError}</div>}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={submitAssign}
                    disabled={assigning || (assignMode === "manual" && !manualRecruiterId)}
                    style={{
                      flex: 1,
                      background: "#FF5C35",
                      border: "none",
                      color: "#FFFFFF",
                      borderRadius: 6,
                      padding: "8px 0",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: assigning ? "default" : "pointer",
                      opacity: assigning ? 0.7 : 1,
                    }}
                  >
                    {assigning ? "Assigning…" : "Assign"}
                  </button>
                  <button
                    onClick={() => {
                      setAssignEditing(false);
                      setAssignError(null);
                    }}
                    style={{ flex: 1, background: "#FFFFFF", border: "1px solid #D9DCE3", color: "#4B5565", borderRadius: 6, padding: "8px 0", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

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

          <div style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,40,0.04)", padding: 20 }}>
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

        <div style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,40,0.04)", padding: 20 }}>
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
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>Follow-up frequency</div>
                <div style={{ display: "flex", gap: 4, background: "#F4F5F8", borderRadius: 6, padding: 3, maxWidth: 320 }}>
                  {(
                    [
                      { key: "once", label: "One-time" },
                      { key: "weekly", label: "Weekly" },
                      { key: "custom", label: "Custom" },
                    ] as const
                  ).map((opt) => (
                    <div
                      key={opt.key}
                      onClick={() => setFrequency(opt.key)}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        padding: "6px 0",
                        borderRadius: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: frequency === opt.key ? "#FFFFFF" : "transparent",
                        color: frequency === opt.key ? "#1D2433" : "#6B7280",
                      }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
                {frequency === "custom" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12.5, color: "#4B5565" }}>
                    Repeat every
                    <input
                      type="number"
                      min={1}
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      style={{ width: 60, padding: "5px 8px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 12.5 }}
                    />
                    days
                  </div>
                )}
              </div>
            )}
            {scheduleNotice && <div style={{ fontSize: 12.5, color: "#1E7F43" }}>{scheduleNotice}</div>}
            {scheduleError && <div style={{ fontSize: 12.5, color: "#B42318" }}>{scheduleError}</div>}
          </div>

          <div style={{ marginTop: 16, borderTop: "1px solid #EEF0F4", paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", marginBottom: 8 }}>
              Follow-Up History
            </div>
            {followUpsError && <div style={{ fontSize: 12.5, color: "#B42318", marginBottom: 8 }}>{followUpsError}</div>}
            {followUpsLoading ? (
              <div style={{ fontSize: 12.5, color: "#9AA1AC", padding: "10px 0" }}>Loading…</div>
            ) : followUps.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#9AA1AC", padding: "10px 0" }}>No follow-ups scheduled yet.</div>
            ) : (
              followUps.map((fu) => {
                const badge = followUpStatusStyles[fu.followUpStatus];
                return (
                  <div
                    key={fu.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 0",
                      borderBottom: "1px solid #F4F5F8",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12.5, color: "#1D2433", fontWeight: 600 }}>{fu.dueAt}</div>
                      <div style={{ fontSize: 11.5, color: "#9AA1AC", marginTop: 2 }}>
                        {fu.assignToName ? `Assigned to ${fu.assignToName}` : "Unassigned"}
                        {fu.note ? ` — ${fu.note}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: badge.bg,
                          color: badge.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {badge.label}
                      </span>
                      {fu.followUpStatus === "pending" && canEdit && (
                        <button
                          onClick={() => completeFollowUp(fu.id)}
                          disabled={completingId === fu.id}
                          title="Mark Complete"
                          style={{
                            background: "#FF5C35",
                            border: "none",
                            color: "#FFFFFF",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: completingId === fu.id ? "default" : "pointer",
                            opacity: completingId === fu.id ? 0.7 : 1,
                          }}
                        >
                          {completingId === fu.id ? "…" : "✓"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div style={{ background: "#FFFFFF", border: "1px solid #EDEFF3", borderRadius: 12, boxShadow: "0 1px 2px rgba(16,24,40,0.04)", padding: 20, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Interviews</div>

        {canEdit && (
          <div style={{ border: "1px solid #E7E9EE", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", marginBottom: 8 }}>
              Schedule Interview
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <input
                type="datetime-local"
                value={interviewAt}
                disabled={!primary}
                onChange={(e) => setInterviewAt(e.target.value)}
                title={primary ? undefined : "This candidate has no application to schedule an interview against."}
                style={{
                  flex: "1 1 200px",
                  padding: "9px 12px",
                  border: "1px solid #D9DCE3",
                  borderRadius: 6,
                  fontSize: 13,
                  background: !primary ? "#F7F8FA" : "#FFFFFF",
                  color: !primary ? "#9AA1AC" : "#1D2433",
                }}
              />
              <select
                value={interviewerId}
                disabled={!primary}
                onChange={(e) => setInterviewerId(e.target.value)}
                style={{ flex: "1 1 160px", padding: "9px 12px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 13 }}
              >
                <option value="">Assign Interviewer</option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={interviewLocation}
                disabled={!primary}
                onChange={(e) => setInterviewLocation(e.target.value)}
                placeholder="Location / Link (optional)"
                style={{ flex: "1 1 160px", padding: "9px 12px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 13 }}
              />
              <button
                onClick={scheduleInterview}
                disabled={!primary || !interviewAt || scheduling2}
                style={{
                  background: !primary || !interviewAt ? "#F7F8FA" : "#FF5C35",
                  border: !primary || !interviewAt ? "1px solid #E7E9EE" : "none",
                  color: !primary || !interviewAt ? "#9AA1AC" : "#FFFFFF",
                  borderRadius: 6,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !primary || !interviewAt || scheduling2 ? "default" : "pointer",
                }}
              >
                {scheduling2 ? "Scheduling…" : "Schedule"}
              </button>
            </div>
            {primary && (
              <div style={{ fontSize: 11.5, color: "#9AA1AC" }}>
                For {primary.job?.title ?? "this application"} — appears on the Calendar once scheduled.
              </div>
            )}
            {interviewNotice && <div style={{ fontSize: 12.5, color: "#1E7F43", marginTop: 6 }}>{interviewNotice}</div>}
          </div>
        )}

        {interviewsError && <div style={{ fontSize: 12.5, color: "#B42318", marginBottom: 8 }}>{interviewsError}</div>}
        {interviewsLoading ? (
          <div style={{ fontSize: 12.5, color: "#9AA1AC", padding: "10px 0" }}>Loading…</div>
        ) : interviews.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#9AA1AC", padding: "10px 0" }}>No interviews scheduled yet.</div>
        ) : (
          interviews.map((iv) => {
            const badge = interviewStatusStyles[iv.status];
            return (
              <div
                key={iv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid #F4F5F8",
                }}
              >
                <div>
                  <div style={{ fontSize: 12.5, color: "#1D2433", fontWeight: 600 }}>{iv.scheduledAt}</div>
                  <div style={{ fontSize: 11.5, color: "#9AA1AC", marginTop: 2 }}>
                    {iv.clientName} — {iv.jobTitle ?? "--"}
                    {iv.interviewerName ? ` · Interviewer: ${iv.interviewerName}` : " · No interviewer assigned"}
                    {iv.location ? ` · ${iv.location}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: badge.bg,
                      color: badge.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {badge.label}
                  </span>
                  {iv.status === "scheduled" && canEdit && (
                    <>
                      <button
                        onClick={() => setInterviewStatus(iv.id, "completed")}
                        disabled={updatingInterviewId === iv.id}
                        title="Mark Completed"
                        style={{
                          background: "#FF5C35",
                          border: "none",
                          color: "#FFFFFF",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: updatingInterviewId === iv.id ? "default" : "pointer",
                          opacity: updatingInterviewId === iv.id ? 0.7 : 1,
                        }}
                      >
                        {updatingInterviewId === iv.id ? "…" : "✓"}
                      </button>
                      <button
                        onClick={() => setInterviewStatus(iv.id, "cancelled")}
                        disabled={updatingInterviewId === iv.id}
                        title="Cancel Interview"
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #D9DCE3",
                          color: "#6B7280",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: updatingInterviewId === iv.id ? "default" : "pointer",
                          opacity: updatingInterviewId === iv.id ? 0.7 : 1,
                        }}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
