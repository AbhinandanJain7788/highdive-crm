import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AgentCallTimeStats, IdleCheckResult } from "./team.shared";

type UserStatus = Database["public"]["Enums"]["user_status"];
type LiveStatus = Database["public"]["Enums"]["live_status"];

export type { AgentCallTimeStats, IdleCheckResult } from "./team.shared";

export type TeamRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  avatarColor: string | null;
  addOns: string | null;
  joinedOn: string | null;
  createdAt: string;
  role: { id: string; name: string; dotColor: string | null; badgeBg: string | null } | null;
  process: { id: string; name: string } | null;
  reportsTo: { id: string; name: string } | null;
};

export type LiveStatusRow = {
  id: string;
  name: string;
  avatarColor: string | null;
  liveStatus: LiveStatus | null;
  liveStatusSince: string | null;
  role: { id: string; name: string } | null;
  process: { id: string; name: string } | null;
  callTrackingEnabled: boolean;
  callRecordingEnabled: boolean;
  appVersion: string;
  callTimeStats: AgentCallTimeStats | null;
  heartbeatActive: boolean | null;
  lastHeartbeatAt: string | null;
};

// `reports_to` is a self-referencing FK on `users` (users -> users). PostgREST
// can't disambiguate a self-join via the constraint name here (it 500s with
// PGRST200 — "no matches found" — even though the constraint exists); the
// column-name hint is what actually resolves it for a self-referencing FK.
const TEAM_SELECT = `
  id, name, email, phone, status, avatar_color, add_ons, joined_on, created_at,
  role:roles!users_role_id_fkey(id, name, dot_color, badge_bg),
  process:processes!users_process_id_fkey(id, name),
  manager:reports_to(id, name)
`;

const LIVE_STATUS_SELECT = `
  id, name, avatar_color, live_status, live_status_since,
  call_tracking_enabled, call_recording_enabled, app_version,
  role:roles!users_role_id_fkey(id, name),
  process:processes!users_process_id_fkey(id, name)
`;

// Raw row shapes as returned by PostgREST for the selects above — embedded
// one-to-one relations come back as single objects (not arrays) because each
// FK here is a many-to-one from `users`.
type RawTeamRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  avatar_color: string | null;
  add_ons: string | null;
  joined_on: string | null;
  created_at: string;
  role: { id: string; name: string; dot_color: string | null; badge_bg: string | null } | null;
  process: { id: string; name: string } | null;
  manager: { id: string; name: string } | null;
};

type RawLiveStatusRow = {
  id: string;
  name: string;
  avatar_color: string | null;
  live_status: LiveStatus | null;
  live_status_since: string | null;
  call_tracking_enabled: boolean;
  call_recording_enabled: boolean;
  app_version: string;
  role: { id: string; name: string } | null;
  process: { id: string; name: string } | null;
};

export async function getTeamRows(
  supabase: SupabaseClient<Database>,
  statusFilter?: UserStatus
): Promise<TeamRow[]> {
  let query = supabase.from("users").select(TEAM_SELECT).order("created_at", { ascending: true });
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data, error } = await query.returns<RawTeamRow[]>();
  if (error) throw error;

  return (data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    status: u.status,
    avatarColor: u.avatar_color,
    addOns: u.add_ons,
    joinedOn: u.joined_on,
    createdAt: u.created_at,
    role: u.role ? { id: u.role.id, name: u.role.name, dotColor: u.role.dot_color, badgeBg: u.role.badge_bg } : null,
    process: u.process ? { id: u.process.id, name: u.process.name } : null,
    reportsTo: u.manager ? { id: u.manager.id, name: u.manager.name } : null,
  }));
}

export async function getLiveStatusRows(
  supabase: SupabaseClient<Database>,
  options: { liveStatus?: LiveStatus; callTracking?: boolean; callRecording?: boolean; version?: string } = {}
): Promise<LiveStatusRow[]> {
  let query = supabase.from("users").select(LIVE_STATUS_SELECT).order("name", { ascending: true });
  if (options.liveStatus) query = query.eq("live_status", options.liveStatus);
  if (options.callTracking !== undefined) query = query.eq("call_tracking_enabled", options.callTracking);
  if (options.callRecording !== undefined) query = query.eq("call_recording_enabled", options.callRecording);
  if (options.version) query = query.eq("app_version", options.version);

  const { data, error } = await query.returns<RawLiveStatusRow[]>();
  if (error) throw error;

  return (data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    avatarColor: u.avatar_color,
    liveStatus: u.live_status,
    liveStatusSince: u.live_status_since,
    callTrackingEnabled: u.call_tracking_enabled,
    callRecordingEnabled: u.call_recording_enabled,
    appVersion: u.app_version,
    callTimeStats: null,
    heartbeatActive: null,
    lastHeartbeatAt: null,
    role: u.role ? { id: u.role.id, name: u.role.name } : null,
    process: u.process ? { id: u.process.id, name: u.process.name } : null,
  }));
}

// Same deterministic name -> color hash the seed data used (lib/mock/styles.ts),
// duplicated here so real user-creation code (POST /api/team) never imports
// from the mock module.
const AVATAR_COLORS = ["#FF5C35", "#2563EB", "#16A34A", "#7C3AED", "#0F7A6C", "#B15C00", "#DB2777"];
export function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Renders a `date` column ("2026-01-05") as "05 Jan 2026", matching the exact
// display format the signed-off UI used for its mock `joinedOn` strings.
export function formatJoinedOn(dateStr: string | null): string {
  if (!dateStr) return "--";
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "--";
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Renders the "Since:" duration from a `live_status_since` timestamp, in the
// same style as the mock's SINCE_VALUES ("2days 4h", "23h 6m", "0m 11s").
export function formatSince(sinceIso: string | null): string {
  if (!sinceIso) return "--";
  const diffMs = Date.now() - new Date(sinceIso).getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days >= 1) return `${days}days ${hours}h`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

// ── Call time stats ──────────────────────────────────────────────────────────
// All computed from `calls.duration_seconds` — no new columns or tables.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istDayStartUtc(daysAgo: number): Date {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const istMidnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - daysAgo, 0, 0, 0, 0);
  return new Date(istMidnight - IST_OFFSET_MS);
}

function istMonthStartUtc(): Date {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const istMidnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(istMidnight - IST_OFFSET_MS);
}

export async function getAgentCallTimeStats(
  supabase: SupabaseClient<Database>,
  userId?: string
): Promise<AgentCallTimeStats[]> {
  const todayStart = istDayStartUtc(0).toISOString();
  const monthStart = istMonthStartUtc().toISOString();

  let query = supabase
    .from("calls")
    .select("resolved_agent_id, duration_seconds, call_time")
    .not("resolved_agent_id", "is", null);

  if (userId) query = query.eq("resolved_agent_id", userId);

  const { data, error } = await query.returns<{ resolved_agent_id: string; duration_seconds: number | null; call_time: string }[]>();
  if (error) throw error;

  const byUser = new Map<string, { today: number; month: number; allTime: number; count: number }>();
  for (const c of data ?? []) {
    const ds = c.duration_seconds ?? 0;
    if (ds <= 0) continue;
    const entry = byUser.get(c.resolved_agent_id) ?? { today: 0, month: 0, allTime: 0, count: 0 };
    entry.allTime += ds;
    entry.count += 1;
    if (c.call_time >= todayStart) entry.today += ds;
    if (c.call_time >= monthStart) entry.month += ds;
    byUser.set(c.resolved_agent_id, entry);
  }

  const userIds = [...byUser.keys()];
  if (!userIds.length) return [];

  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, name")
    .in("id", userIds);

  if (userError) throw userError;

  const nameById = new Map((users ?? []).map((u) => [u.id, u.name]));

  return [...byUser.entries()].map(([uid, s]) => ({
    userId: uid,
    userName: nameById.get(uid) ?? "Unknown",
    todaySeconds: s.today,
    monthSeconds: s.month,
    allTimeSeconds: s.allTime,
    callCount: s.count,
    talkSeconds: s.allTime,
  }));
}

// ── Idle timer check ────────────────────────────────────────────────────────
// Scans users who are currently idle and creates notification entries in
// activity_logs at thresholds: 10 min (user warned), 12 min (escalation
// warning), 15 min (admin notified). Uses activity_logs as the dedup mechanism
// — each (user_id, threshold) pair is only sent once per idle session.

const IDLE_THRESHOLDS = [10, 12, 15] as const;
const IDLE_ACTION = "idle_notification" as const;

export async function checkIdleTimers(supabase: SupabaseClient<Database>): Promise<IdleCheckResult> {
  const { data: idleUsers, error } = await supabase
    .from("users")
    .select("id, name, live_status_since")
    .eq("live_status", "idle")
    .not("live_status_since", "is", null);

  if (error) throw error;
  if (!idleUsers?.length) return { checked: 0, notificationsSent: 0 };

  const now = Date.now();
  let sent = 0;

  for (const user of idleUsers) {
    if (!user.live_status_since) continue;
    const idleMs = now - new Date(user.live_status_since).getTime();
    const idleMinutes = Math.floor(idleMs / 60_000);

    for (const threshold of IDLE_THRESHOLDS) {
      if (idleMinutes < threshold) break;

      // Check if this notification was already sent.
      const { data: existing } = await supabase
        .from("activity_logs")
        .select("id")
        .eq("entity_id", user.id)
        .eq("action", IDLE_ACTION)
        .eq("entity_type", `idle_${threshold}`)
        .limit(1)
        .maybeSingle();

      if (existing) continue;

      const recipient = threshold >= 15 ? "admin" : "user";
      const label =
        threshold === 10
          ? `You have been idle for ${idleMinutes} min`
          : threshold === 12
            ? `You have been idle for ${idleMinutes} min — admin will be notified in 3 min`
            : `${user.name} has been idle for ${idleMinutes} min`;

      await supabase.from("activity_logs").insert({
        entity_id: user.id,
        entity_type: IDLE_ACTION,
        action: `idle_${threshold}`,
        actor_id: user.id,
        metadata: { threshold, recipient, label, idleMinutes },
      });
      sent += 1;
    }
  }

  return { checked: idleUsers.length, notificationsSent: sent };
}

// ── Latest heartbeats ───────────────────────────────────────────────────────
// Returns a Map of userId → { isActive, heartbeatAt } for the most recent
// heartbeat per user.

export async function getLatestHeartbeats(
  supabase: SupabaseClient<Database>
): Promise<Map<string, { isActive: boolean; heartbeatAt: string }>> {
  // Fetch the latest heartbeat per user using a subquery approach.
  // PostgREST doesn't support DISTINCT ON, so we fetch all recent heartbeats
  // (last 24h) and deduplicate in JS — heartbeat rows are small.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("agent_heartbeats")
    .select("user_id, is_active, heartbeat_at")
    .gte("heartbeat_at", since)
    .order("user_id", { ascending: true })
    .order("heartbeat_at", { ascending: false });

  if (error) throw error;

  const result = new Map<string, { isActive: boolean; heartbeatAt: string }>();
  for (const h of data ?? []) {
    if (!result.has(h.user_id)) {
      result.set(h.user_id, { isActive: h.is_active, heartbeatAt: h.heartbeat_at });
    }
  }
  return result;
}
