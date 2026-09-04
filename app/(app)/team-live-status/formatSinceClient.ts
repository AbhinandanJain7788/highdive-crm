// Client-safe copy of lib/team.ts's formatSince — that module is `server-only` and
// this file backs a "use client" component that now refetches rows itself (Phase 9
// filter fix), so it needs to compute the "Since:" label without importing lib/team.
export function formatSinceClient(sinceIso: string | null): string {
  if (!sinceIso) return "--";
  const diffMs = Date.now() - new Date(sinceIso).getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days >= 1) return `${days}days ${hours}h`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}
