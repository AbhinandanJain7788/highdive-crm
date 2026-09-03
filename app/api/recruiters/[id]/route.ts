import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { getRecruiterDetail } from "@/lib/recruiters";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/recruiters/:id — one recruiter with their real assigned candidates.
// A recruiter may read their own page (RLS already lets them see their own
// assignments); reading anyone else's requires `view_all_records`.
export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { id } = await params;
  if (id !== profile.id && !profile.permissions.includes("view_all_records")) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Missing permission: view_all_records" } },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  try {
    const recruiter = await getRecruiterDetail(supabase, id);
    if (!recruiter) {
      return NextResponse.json({ error: { code: "not_found", message: "Recruiter not found." } }, { status: 404 });
    }
    return NextResponse.json({ data: recruiter });
  } catch (err) {
    console.error(`GET /api/recruiters/${id} failed`, err);
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load recruiter." } }, { status: 500 });
  }
}
