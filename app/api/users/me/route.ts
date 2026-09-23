import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";

// GET /api/users/me — current user profile (id, name, role, permissions).
// Used by client components that need to check permissions without a server
// round-trip through a page component.
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }
  return NextResponse.json({
    data: {
      id: profile.id,
      name: profile.name,
      permissions: profile.permissions,
    },
  });
}
