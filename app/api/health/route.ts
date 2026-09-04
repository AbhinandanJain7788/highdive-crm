import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/health — liveness + DB check (claude.md API structure, "public"). Flagged
// as missing since Phase 0/1 ("add the actual route as part of Phase 1's scaffold")
// but never added until this Phase 7 route sweep. Queries a tiny reference table
// (`processes`) rather than anything RLS-sensitive, since this endpoint is meant to
// be callable unauthenticated.
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("processes").select("id").limit(1);

  if (error) {
    return NextResponse.json({ data: { status: "degraded", db: false } }, { status: 503 });
  }
  return NextResponse.json({ data: { status: "ok", db: true } });
}
