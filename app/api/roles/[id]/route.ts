import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions";
import { ROLE_SELECT, shapeRole } from "@/lib/roles";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/roles/:id — single role with its permissions and user count.
// Read is open to any authenticated user, same as GET /api/roles.
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
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

  const { data, error } = await supabase.from("roles").select(ROLE_SELECT).eq("id", id).maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: { code: "server_error", message: error.message } },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Role not found." } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: shapeRole(data) });
}

// PATCH /api/roles/:id — update name/colors and/or replace the permission set.
// A system role's *permissions* can be freely edited; only *deletion* of a
// system role is blocked (see DELETE below).
export async function PATCH(request: Request, { params }: RouteParams) {
  const guard = await requirePermission("manage_roles_permissions");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;

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

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("roles")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json(
      { error: { code: "server_error", message: existingError.message } },
      { status: 500 }
    );
  }
  if (!existing) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Role not found." } },
      { status: 404 }
    );
  }

  const updates: { name?: string; dot_color?: string; badge_bg?: string } = {};
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "`name` must be a non-empty string." } },
        { status: 400 }
      );
    }
    updates.name = name.trim();
  }
  if (dot_color !== undefined) {
    if (typeof dot_color !== "string") {
      return NextResponse.json(
        { error: { code: "bad_request", message: "`dot_color` must be a string." } },
        { status: 400 }
      );
    }
    updates.dot_color = dot_color;
  }
  if (badge_bg !== undefined) {
    if (typeof badge_bg !== "string") {
      return NextResponse.json(
        { error: { code: "bad_request", message: "`badge_bg` must be a string." } },
        { status: 400 }
      );
    }
    updates.badge_bg = badge_bg;
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase.from("roles").update(updates).eq("id", id);
    if (updateError) {
      return NextResponse.json(
        { error: { code: "server_error", message: updateError.message } },
        { status: 500 }
      );
    }
  }

  if (permissionKeys !== undefined) {
    if (!Array.isArray(permissionKeys) || !permissionKeys.every((k) => typeof k === "string")) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "`permissionKeys` must be an array of strings." } },
        { status: 400 }
      );
    }

    let permissionIds: string[] = [];
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
      permissionIds = (perms ?? []).map((p) => p.id);
    }

    const { error: deleteError } = await supabase.from("role_permissions").delete().eq("role_id", id);
    if (deleteError) {
      return NextResponse.json(
        { error: { code: "server_error", message: deleteError.message } },
        { status: 500 }
      );
    }

    if (permissionIds.length > 0) {
      const { error: insertError } = await supabase
        .from("role_permissions")
        .insert(permissionIds.map((permission_id) => ({ role_id: id, permission_id })));
      if (insertError) {
        return NextResponse.json(
          { error: { code: "server_error", message: insertError.message } },
          { status: 500 }
        );
      }
    }
  }

  const { data: fullRole, error: fetchError } = await supabase
    .from("roles")
    .select(ROLE_SELECT)
    .eq("id", id)
    .single();
  if (fetchError || !fullRole) {
    return NextResponse.json(
      { error: { code: "server_error", message: fetchError?.message ?? "Role updated but could not be reloaded." } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: shapeRole(fullRole) });
}

// DELETE /api/roles/:id — a system role (is_system = true) can never be
// deleted; this is the app-layer enforcement of that rule (RLS's
// `roles_write` only checks the manage_roles_permissions permission, not
// is_system, so this check must live here).
export async function DELETE(_request: Request, { params }: RouteParams) {
  const guard = await requirePermission("manage_roles_permissions");
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = await createClient();

  const { data: role, error: fetchError } = await supabase
    .from("roles")
    .select("id, is_system")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json(
      { error: { code: "server_error", message: fetchError.message } },
      { status: 500 }
    );
  }
  if (!role) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Role not found." } },
      { status: 404 }
    );
  }
  if (role.is_system) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "A system role cannot be deleted." } },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabase.from("roles").delete().eq("id", id);
  if (deleteError) {
    // Postgres FK violation (23503) — users are still assigned to this role.
    if (deleteError.code === "23503") {
      return NextResponse.json(
        {
          error: {
            code: "conflict",
            message: "This role still has users assigned to it and cannot be deleted.",
          },
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: { code: "server_error", message: deleteError.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: { id } });
}
