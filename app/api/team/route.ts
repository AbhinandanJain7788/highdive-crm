import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentUserProfile, requirePermission } from "@/lib/permissions";
import { avatarColorFor, getTeamRows } from "@/lib/team";
import type { Database } from "@/types/supabase";

type UserStatus = Database["public"]["Enums"]["user_status"];
const VALID_STATUSES: UserStatus[] = ["active", "invited", "inactive"];

// GET /api/team — any signed-in user can list the team (RLS already allows
// read-all on `users` for the directory views); optional ?status= filters to
// one of the Active/Inactive/Invited tabs.
export async function GET(request: Request) {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status = VALID_STATUSES.includes(statusParam as UserStatus) ? (statusParam as UserStatus) : undefined;

  const supabase = await createClient();
  try {
    const rows = await getTeamRows(supabase, status);
    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ error: { code: "server_error", message: "Failed to load team." } }, { status: 500 });
  }
}

// POST /api/team — "Add User": invites via Supabase Auth (creates auth.users)
// and creates the matching public.users row with status='invited'. Uses the
// service-role client for the invite since inviteUserByEmail only exists
// there, never on the anon-key client.
export async function POST(request: Request) {
  const guard = await requirePermission("manage_team");
  if (guard instanceof NextResponse) return guard;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const roleId = typeof body?.roleId === "string" && body.roleId ? body.roleId : null;
  const processId = typeof body?.processId === "string" && body.processId ? body.processId : null;
  const reportsTo = typeof body?.reportsTo === "string" && body.reportsTo ? body.reportsTo : null;

  if (!name || !email) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Name and email are required." } },
      { status: 400 }
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    // createAdminClient throws synchronously if SUPABASE_SERVICE_ROLE_KEY is
    // unset — a deploy/env misconfiguration, not a user-facing bad request.
    return NextResponse.json(
      {
        error: {
          code: "server_misconfigured",
          message:
            err instanceof Error ? err.message : "The invite service is not configured.",
        },
      },
      { status: 500 }
    );
  }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError || !inviteData?.user) {
    return NextResponse.json(
      { error: { code: "invite_failed", message: inviteError?.message ?? "Could not invite user." } },
      { status: 502 }
    );
  }

  const newUserId = inviteData.user.id;
  const supabase = await createClient();
  const { data: insertedUser, error: insertError } = await supabase
    .from("users")
    .insert({
      id: newUserId,
      name,
      email,
      phone,
      role_id: roleId,
      process_id: processId,
      reports_to: reportsTo,
      status: "invited",
      avatar_color: avatarColorFor(name),
      joined_on: new Date().toISOString().slice(0, 10),
    })
    .select(
      "id, name, email, phone, status, avatar_color, add_ons, joined_on, created_at, role_id, process_id, reports_to"
    )
    .single();

  if (insertError) {
    // Don't leave an orphaned auth.users row if the profile row couldn't be
    // created — roll the invite back so retrying doesn't collide on email.
    await admin.auth.admin.deleteUser(newUserId).catch(() => {});
    return NextResponse.json(
      {
        error: {
          code: "server_error",
          message: "The invite could not be completed; no user was created.",
        },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: insertedUser }, { status: 201 });
}
