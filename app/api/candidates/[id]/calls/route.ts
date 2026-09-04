import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getCallRows } from "@/lib/calls";
import { readPagination } from "@/lib/format";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/candidates/:id/calls — call history for a candidate (claude.md API
// structure). RLS scopes this the same way it scopes /api/calls; a recruiter with
// no tie to this candidate simply gets an empty list, same as the candidate detail
// page itself already 404s for them.
export async function GET(request: Request, { params }: RouteParams) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();
  try {
    const { rows, total } = await getCallRows(supabase, {
      candidateId: id,
      sort: "called-new",
      pagination: readPagination(searchParams),
    });
    return NextResponse.json({ data: rows, total });
  } catch (err) {
    console.error(`GET /api/candidates/${id}/calls failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load call history." } }, { status: 500 });
  }
}
