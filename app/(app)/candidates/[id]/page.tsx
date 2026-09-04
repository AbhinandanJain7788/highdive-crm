import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getCandidateDetail } from "@/lib/candidates";
import { getCallRows } from "@/lib/calls";
import CandidateDetailClient from "./CandidateDetailClient";

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [profile, candidate] = await Promise.all([getCurrentUserProfile(), getCandidateDetail(supabase, id)]);
  // RLS already hides candidates this user has no assignment tie to, so a hidden
  // row and a missing row look the same here — both 404.
  if (!candidate) notFound();

  // Phase 5: real call history for this candidate, read the same way
  // /candidates/:id/calls does — a direct lib/calls.ts call, not an HTTP hop, same
  // convention as the rest of this page's server-side data.
  const { rows: calls } = await getCallRows(supabase, {
    candidateId: id,
    sort: "called-new",
    pagination: { page: 1, pageSize: 50, from: 0, to: 49 },
  });

  return (
    <CandidateDetailClient
      candidate={candidate}
      canEdit={profile?.permissions.includes("manage_candidates") ?? false}
      calls={calls}
    />
  );
}
