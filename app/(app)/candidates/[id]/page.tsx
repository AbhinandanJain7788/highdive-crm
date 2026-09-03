import { notFound } from "next/navigation";
import { candidatesSeed } from "@/lib/mock";
import CandidateDetailClient from "./CandidateDetailClient";

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = candidatesSeed.find((c) => c.id === id);

  if (!candidate) {
    notFound();
  }

  return <CandidateDetailClient candidate={candidate} />;
}
