"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  statusStyles,
  dispositionStyles,
  recruiters,
  usersSeed,
  jobsSeed,
  fmtDuration,
  avatarColorFor,
  avatarLetterFor,
  type MockCandidate,
  type ApplicationStatus,
} from "@/lib/mock";

const statusKeys = Object.keys(statusStyles) as ApplicationStatus[];
const recruiterOptionsAll = ["Unassigned", ...recruiters.map((r) => r.name)];

export default function CandidateDetailClient({ candidate }: { candidate: MockCandidate }) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(candidate.status);
  const [recruiterId, setRecruiterId] = useState<string | null>(candidate.recruiterId);
  const [followUpValue, setFollowUpValue] = useState("");

  const recruiterLabel = recruiterId ? usersSeed.find((u) => u.id === recruiterId)?.name ?? "Unassigned" : "Unassigned";
  const job = jobsSeed.find((j) => j.id === candidate.jobId);
  const jobLabel = job ? job.title : candidate.jobId;
  const resumeLabel = candidate.hasResume ? "On file" : "Not uploaded";
  const notesLabel = candidate.notes || "No notes added yet.";
  const hasCalls = candidate.calls.length > 0;
  const hasNoCalls = candidate.calls.length === 0;

  const enrichedCalls = candidate.calls.map((call) => ({
    ...call,
    durationLabel: fmtDuration(call.durationSeconds),
    dispBg: dispositionStyles[call.disposition].bg,
    dispColor: dispositionStyles[call.disposition].color,
    recLabel: call.recording ? "Available" : "Unavailable",
    recColor: call.recording ? "#1E7F43" : "#9AA1AC",
  }));

  const onRecruiterChange = (value: string) => {
    if (value === "Unassigned") {
      setRecruiterId(null);
      return;
    }
    const rec = usersSeed.find((u) => u.name === value);
    setRecruiterId(rec ? rec.id : null);
  };

  const onSchedule = () => {
    if (!followUpValue.trim()) return;
    setFollowUpValue("");
  };

  return (
    <div data-screen-label="Candidate Detail">
      <div
        onClick={() => router.push("/candidates")}
        style={{ fontSize: 13, color: "#6B7280", cursor: "pointer", marginBottom: 14 }}
      >
        ← Back to Candidates
      </div>
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
                <div style={{ fontSize: 12.5, color: "#9AA1AC" }}>{candidate.phone}</div>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", marginBottom: 6 }}>
              Status
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
              style={{
                width: "100%",
                padding: "9px 10px",
                border: "1px solid #D9DCE3",
                borderRadius: 6,
                fontSize: 13,
                color: "#1D2433",
                marginBottom: 16,
              }}
            >
              {statusKeys.map((opt) => (
                <option key={opt} value={opt}>
                  {statusStyles[opt].label}
                </option>
              ))}
            </select>

            <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", marginBottom: 6 }}>
              Assigned Recruiter
            </div>
            <select
              value={recruiterLabel}
              onChange={(e) => onRecruiterChange(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 10px",
                border: "1px solid #D9DCE3",
                borderRadius: 6,
                fontSize: 13,
                color: "#1D2433",
                marginBottom: 16,
              }}
            >
              {recruiterOptionsAll.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13, color: "#1D2433" }}>
              <div>
                <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Applied For</div>
                {jobLabel}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Source</div>
                {candidate.source}
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
          </div>

          <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 10 }}>Notes</div>
            <div style={{ fontSize: 13, color: "#4B5565", lineHeight: 1.5 }}>{notesLabel}</div>
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E7E9EE", borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF5C35", marginBottom: 14 }}>Call History</div>
          {hasCalls && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1.4fr",
                  gap: 10,
                  padding: "8px 10px",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "#9AA1AC",
                  textTransform: "uppercase",
                  borderBottom: "1px solid #EEF0F4",
                }}
              >
                <div>Date</div>
                <div>By</div>
                <div>Duration</div>
                <div>Disposition</div>
                <div>Recording</div>
              </div>
              {enrichedCalls.map((call, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1.4fr",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 10px",
                    borderBottom: "1px solid #F4F5F8",
                  }}
                >
                  <div style={{ fontSize: 12.5, color: "#4B5565" }}>{call.date}</div>
                  <div style={{ fontSize: 12.5, color: "#4B5565" }}>{call.by}</div>
                  <div style={{ fontSize: 12.5, color: "#1D2433" }}>{call.durationLabel}</div>
                  <div>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: 20,
                        background: call.dispBg,
                        color: call.dispColor,
                      }}
                    >
                      {call.disposition}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: call.recColor }}>{call.recLabel}</div>
                </div>
              ))}
            </>
          )}
          {hasNoCalls && (
            <div style={{ textAlign: "center", color: "#9AA1AC", fontSize: 13, padding: "40px 0" }}>No calls made yet.</div>
          )}

          <div style={{ marginTop: 16, borderTop: "1px solid #EEF0F4", paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9AA1AC", textTransform: "uppercase", marginBottom: 8 }}>
              Schedule Follow-up
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                value={followUpValue}
                onChange={(e) => setFollowUpValue(e.target.value)}
                placeholder="e.g. 3 Sep, 11:00 AM"
                style={{ flex: 1, padding: "9px 12px", border: "1px solid #D9DCE3", borderRadius: 6, fontSize: 13 }}
              />
              <button
                onClick={onSchedule}
                style={{
                  background: "#FF5C35",
                  border: "none",
                  color: "#FFFFFF",
                  borderRadius: 6,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
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
