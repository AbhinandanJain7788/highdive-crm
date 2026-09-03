"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { jobStatusLabels } from "@/lib/mock";
import type { JobStatus } from "@/lib/jobs";

export default function JobStatusPanel({
  jobId,
  status,
  canEdit,
}: {
  jobId: string;
  status: JobStatus;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function closeJob() {
    setClosing(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/close`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not close job.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close job.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: "#9AA1AC", marginBottom: 3 }}>Status</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span>{jobStatusLabels[status]}</span>
        {canEdit && status !== "closed" && (
          <button
            type="button"
            onClick={closeJob}
            disabled={closing}
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 20,
              border: "1px solid #E7E9EE",
              background: "#FFFFFF",
              color: "#B42318",
              cursor: closing ? "default" : "pointer",
              opacity: closing ? 0.6 : 1,
            }}
          >
            {closing ? "Closing…" : "Close Job"}
          </button>
        )}
      </div>
      {error && <div style={{ fontSize: 11.5, color: "#B42318", marginTop: 4 }}>{error}</div>}
    </div>
  );
}
