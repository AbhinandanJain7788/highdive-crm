import "server-only";
import { cache } from "react";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type CurrentUserProfile = {
  id: string;
  name: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
};

// Resolves the signed-in user's profile and flattened permission-key list.
// Never check `roleName` for access control — only `permissions` — roles are
// editable data (claude.md: "Never hardcode a role name in a permission check").
// The app layout resolves the profile on every navigation, and each Supabase round-trip
// costs ~200ms. Keyed by the access token so a different (or refreshed) token always
// misses, and held for only 30s, which is short enough that a role or permission edit
// shows up almost immediately but long enough to keep back-to-back navigations off the
// network. Data access stays protected by RLS regardless of what this returns.
const PROFILE_TTL_MS = 30_000;
const profileCache = new Map<string, { at: number; profile: CurrentUserProfile | null }>();

function readCachedProfile(token: string) {
  const hit = profileCache.get(token);
  if (!hit) return undefined;
  if (Date.now() - hit.at > PROFILE_TTL_MS) {
    profileCache.delete(token);
    return undefined;
  }
  return hit.profile;
}

function writeCachedProfile(token: string, profile: CurrentUserProfile | null) {
  // Bounded so a long-lived dev server can't grow this without limit.
  if (profileCache.size > 100) profileCache.clear();
  profileCache.set(token, { at: Date.now(), profile });
}

// Wrapped in React's cache() so the layout, a page, and any route handler in the same
// request all share one lookup instead of each paying the round-trips again.
export const getCurrentUserProfile = cache(async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const supabase = await createClient();

  // Local cookie read (no network) purely to key the cache.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (token) {
    const cached = readCachedProfile(token);
    if (cached !== undefined) return cached;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (token) writeCachedProfile(token, null);
    return null;
  }

  // One embedded query instead of two sequential ones (users -> roles ->
  // role_permissions -> permissions); each round-trip to Supabase costs ~200ms and
  // this runs on every navigation via the app layout.
  const { data: profile } = await supabase
    .from("users")
    .select("id, name, email, role_id, roles(name, role_permissions(permissions(key)))")
    .eq("id", user.id)
    .single();
  if (!profile) {
    if (token) writeCachedProfile(token, null);
    return null;
  }

  const role = profile.roles as
    | { name: string; role_permissions: { permissions: { key: string } | null }[] | null }
    | null;
  const permissions = (role?.role_permissions ?? [])
    .map((rp) => rp.permissions?.key)
    .filter((k): k is string => Boolean(k));

  const resolved: CurrentUserProfile = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    roleId: profile.role_id,
    roleName: role?.name ?? null,
    permissions,
  };
  if (token) writeCachedProfile(token, resolved);
  return resolved;
});

// Route-handler guard. Returns the profile on success, or a Response to
// return immediately (401/403) on failure — callers do:
//   const guard = await requirePermission("roles.manage");
//   if (guard instanceof NextResponse) return guard;
export async function requirePermission(
  key: string
): Promise<CurrentUserProfile | NextResponse> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }
  if (!profile.permissions.includes(key)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: `Missing permission: ${key}` } },
      { status: 403 }
    );
  }
  return profile;
}
