import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getCandidateDetail } from "@/lib/candidates";
import CandidateDetailClient from "./CandidateDetailClient";

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [profile, candidate] = await Promise.all([getCurrentUserProfile(), getCandidateDetail(supabase, id)]);
  // RLS already hides candidates this user has no assignment tie to, so a hidden
  // row and a missing row look the same here — both 404.
  if (!candidate) notFound();

  return (
    <CandidateDetailClient
      candidate={candidate}
      canEdit={profile?.permissions.includes("manage_candidates") ?? false}
    />
  );
}
