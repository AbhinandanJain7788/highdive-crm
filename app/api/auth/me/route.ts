import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/permissions";

export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sign in required." } },
      { status: 401 }
    );
  }
  return NextResponse.json({ data: profile });
}
