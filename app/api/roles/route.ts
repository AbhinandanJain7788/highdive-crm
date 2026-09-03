import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { ROLE_SELECT, shapeRole } from "@/lib/roles";

// GET /api/roles — list all roles with permission keys + user counts.
// Read is open to any authenticated user (RLS `roles_select`/`permissions_select`/
// `role_permissions_select` all allow `true`) — no permission gate here, only auth.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Sign in required." } },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from("roles")
    .select(ROLE_SELECT)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: { code: "server_error", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: (data ?? []).map(shapeRole) });
}

// POST /api/roles — create a role and assign a set of permission keys.
// Guarded by manage_roles_permissions at the app layer; RLS's `roles_write` /
// `role_permissions_write` policies enforce the same rule independently.
export async function POST(request: Request) {
  const guard = await requirePermission("manage_roles_permissions");
  if (guard instanceof NextResponse) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  const { name, dot_color, badge_bg, permissionKeys } = (body ?? {}) as {
    name?: unknown;
    dot_color?: unknown;
    badge_bg?: unknown;
    permissionKeys?: unknown;
  };

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "`name` is required." } },
      { status: 400 }
    );
  }
  if (!Array.isArray(permissionKeys) || !permissionKeys.every((k) => typeof k === "string")) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "`permissionKeys` must be an array of strings." } },
      { status: 400 }
    );
  }
  if (dot_color !== undefined && typeof dot_color !== "string") {
    return NextResponse.json(
      { error: { code: "bad_request", message: "`dot_color` must be a string." } },
      { status: 400 }
    );
  }
  if (badge_bg !== undefined && typeof badge_bg !== "string") {
    return NextResponse.json(
      { error: { code: "bad_request", message: "`badge_bg` must be a string." } },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: role, error: insertError } = await supabase
    .from("roles")
    .insert({
      name: name.trim(),
      dot_color: (dot_color as string | undefined) ?? "#5B6472",
      badge_bg: (badge_bg as string | undefined) ?? "#EEF0F5",
      is_system: false,
    })
    .select("id")
    .single();

  if (insertError || !role) {
    return NextResponse.json(
      { error: { code: "server_error", message: insertError?.message ?? "Failed to create role." } },
      { status: 500 }
    );
  }

  if (permissionKeys.length > 0) {
    const { data: perms, error: permsError } = await supabase
      .from("permissions")
      .select("id, key")
      .in("key", permissionKeys as string[]);

    if (permsError) {
      return NextResponse.json(
        { error: { code: "server_error", message: permsError.message } },
        { status: 500 }
      );
    }

    const unknownKeys = (permissionKeys as string[]).filter(
      (k) => !(perms ?? []).some((p) => p.key === k)
    );
    if (unknownKeys.length > 0) {
      // Role already exists at this point; still surface a clear error rather
      // than silently ignoring keys that don't map to a real permission.
      return NextResponse.json(
        {
          error: {
            code: "bad_request",
            message: `Unknown permission key(s): ${unknownKeys.join(", ")}`,
          },
        },
        { status: 400 }
      );
    }

    const { error: rpError } = await supabase
      .from("role_permissions")
      .insert((perms ?? []).map((p) => ({ role_id: role.id, permission_id: p.id })));

    if (rpError) {
      return NextResponse.json(
        { error: { code: "server_error", message: rpError.message } },
        { status: 500 }
      );
    }
  }

  const { data: fullRole, error: fetchError } = await supabase
    .from("roles")
    .select(ROLE_SELECT)
    .eq("id", role.id)
    .single();

  if (fetchError || !fullRole) {
    return NextResponse.json(
      { error: { code: "server_error", message: fetchError?.message ?? "Role created but could not be reloaded." } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: shapeRole(fullRole) }, { status: 201 });
}
