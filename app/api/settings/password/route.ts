import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import { PASSWORD_RULES } from "@/lib/settings.shared";

// POST /api/settings/password — "any" per claude.md: reset own password via Supabase
// Auth. The old password is verified by re-running signInWithPassword on the same
// session-bound client (the only way to confirm a password without a dedicated
// "verify current password" Auth endpoint) before calling updateUser — so a stolen
// session cookie alone still can't change the password without knowing the old one.
export async function POST(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const oldPassword = typeof body?.oldPassword === "string" ? body.oldPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

  if (!oldPassword) {
    return NextResponse.json({ error: { code: "bad_request", message: "Enter your old password." } }, { status: 400 });
  }
  const failedRule = PASSWORD_RULES.find((rule) => !rule.test(newPassword));
  if (failedRule) {
    return NextResponse.json({ error: { code: "bad_request", message: failedRule.label } }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "New password and confirm password do not match." } },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: oldPassword,
  });
  if (verifyError) {
    return NextResponse.json({ error: { code: "bad_request", message: "Old password is incorrect." } }, { status: 400 });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return NextResponse.json(
      { error: { code: "server_error", message: updateError.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { success: true } });
}
