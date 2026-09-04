import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";

// Shared writer for activity_logs, used by every consequential-action site (Phase 7
// Step 4: assignment/reassignment, bulk delete, data transfer, role/permission
// changes, imports, rechurn initiation — login/logout already write their own rows
// directly in the auth routes). RLS's `activity_logs_insert` policy requires
// `actor_id = auth.uid()`, so this must run on the request-scoped client, never the
// service-role client. Errors are logged, not thrown — a failed audit-trail write
// should never roll back or block the action it's describing.
export async function logActivity(
  supabase: SupabaseClient<Database>,
  entry: { actorId: string; action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const { error } = await supabase.from("activity_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    metadata: (entry.metadata ?? null) as Json | null,
  });
  if (error) console.error("activity_logs insert failed", entry.action, entry.entityId, error);
}
