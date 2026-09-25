import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/permissions";
import type { Json } from "@/types/supabase";

// GET /api/notifications/mine — returns the current user's idle-timer notifications
// from activity_logs, newest first.
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in required." } }, { status: 401 });
  }

  const supabase = await createClient();

  // Fetch notifications targeted at this user, plus admin-targeted ones if the
  // user has view_all_records (admin).
  const { data: userNotifs } = await supabase
    .from("activity_logs")
    .select("id, action, entity_type, metadata, created_at")
    .eq("entity_id", profile.id)
    .eq("entity_type", "idle_notification")
    .order("created_at", { ascending: false })
    .limit(20);

  let adminNotifs: { id: string; action: string; entity_type: string; metadata: Json; created_at: string }[] = [];
  if (profile.permissions.includes("view_all_records")) {
    const { data } = await supabase
      .from("activity_logs")
      .select("id, action, entity_type, metadata, created_at, entity_id")
      .eq("entity_type", "idle_notification")
      .order("created_at", { ascending: false })
      .limit(50);
    adminNotifs = (data ?? []).filter(
      (n) => (n.metadata as Record<string, unknown> | null)?.recipient === "admin" || n.entity_id === profile.id
    );
  }

  // Merge and deduplicate by id
  const merged = [...(userNotifs ?? []), ...adminNotifs];
  const seen = new Set<string>();
  const unique = merged.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  return NextResponse.json({
    data: unique.map((n) => ({
      id: n.id,
      label: (n.metadata as Record<string, unknown> | null)?.label ?? "Status notification",
      action: n.action,
      createdAt: n.created_at,
    })),
  });
}
