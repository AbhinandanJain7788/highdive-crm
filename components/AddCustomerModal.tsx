"use client";

import { useEffect, useState } from "react";

// Shared by the Customers page's own "+ Add Customer" button and the same
// button in the Topbar (global, so a customer can be added from any screen).
// Job/Assign To are optional: picking both gets the new candidate an assigned
// application, so they show up on Customers immediately (its list requires an
// assigned application). Leaving them blank still creates the candidate — they
// land in Allocations' "New" queue instead, same as any other unassigned intake.
export default function AddCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [jobId, setJobId] = useState("");
  const [recruiterId, setRecruiterId] = useState("");

  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/jobs/open").then((res) => (res.ok ? res.json() : { data: [] })),
      fetch("/api/team?status=active").then((res) => (res.ok ? res.json() : { data: [] })),
    ]).then(([jobsBody, teamBody]) => {
      if (cancelled) return;
      setJobs(jobsBody.data ?? []);
      setTeam(teamBody.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          source: source.trim() || undefined,
          notes: notes.trim() || undefined,
          jobId: jobId || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not add this customer.");

      const applicationId = body?.data?.application?.id as string | undefined;
      if (applicationId && recruiterId) {
        const assignRes = await fetch("/api/assignment/reassign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ applicationId, recruiterId }),
        });
        if (!assignRes.ok) {
          const assignBody = await assignRes.json().catch(() => null);
          throw new Error(
            assignBody?.error?.message ??
              "Customer created, but could not assign them — find them in Allocations to assign manually."
          );
        }
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this customer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={() => (submitting ? null : onClose())}
      style={{ position: "fixed", inset: 0, background: "rgba(29,36,51,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 460, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", background: "#FFFFFF", borderRadius: 12, padding: 24 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#1D2433" }}>Add Customer</div>
          <div onClick={onClose} style={{ cursor: "pointer", fontSize: 20, color: "#9AA1AC", lineHeight: 1 }}>
            ×
          </div>
        </div>

        <Field label="Name *">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Phone *">
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Source">
          <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Referral" style={inputStyle} />
        </Field>
        <Field label="Job (optional)">
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={inputStyle}>
            <option value="">No job — add to Allocations&rsquo; New queue</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </Field>
        {jobId && (
          <Field label="Assign To (optional)">
            <select value={recruiterId} onChange={(e) => setRecruiterId(e.target.value)} style={inputStyle}>
              <option value="">Unassigned</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />
        </Field>

        {!jobId && (
          <div style={{ fontSize: 11.5, color: "#9AA1AC", marginBottom: 14 }}>
            No job selected — this customer will appear in Allocations&rsquo; New queue instead of Customers until assigned.
          </div>
        )}
        {error && <div style={{ fontSize: 12.5, color: "#B42318", marginBottom: 14 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={submitting} style={cancelBtnStyle}>
            Cancel
          </button>
          <button onClick={submit} disabled={submitting} style={{ ...saveBtnStyle, opacity: submitting ? 0.7 : 1, cursor: submitting ? "default" : "pointer" }}>
            {submitting ? "Adding…" : "Add Customer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "#4B5565", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  border: "1px solid #D9DCE3",
  borderRadius: 6,
  fontSize: 13,
  color: "#1D2433",
};

const cancelBtnStyle: React.CSSProperties = {
  flex: 1,
  background: "#FFFFFF",
  border: "1px solid #D9DCE3",
  color: "#4B5565",
  borderRadius: 6,
  padding: "10px 0",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const saveBtnStyle: React.CSSProperties = {
  flex: 1,
  background: "#FF5C35",
  border: "none",
  color: "#FFFFFF",
  borderRadius: 6,
  padding: "10px 0",
  fontSize: 13,
  fontWeight: 600,
};
