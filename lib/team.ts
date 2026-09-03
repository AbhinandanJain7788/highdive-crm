import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type UserStatus = Database["public"]["Enums"]["user_status"];
type LiveStatus = Database["public"]["Enums"]["live_status"];

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

export async function getLiveStatusRows(supabase: SupabaseClient<Database>): Promise<LiveStatusRow[]> {
  const { data, error } = await supabase
    .from("users")
    .select(LIVE_STATUS_SELECT)
    .order("name", { ascending: true })
    .returns<RawLiveStatusRow[]>();
  if (error) throw error;

  return (data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    avatarColor: u.avatar_color,
    liveStatus: u.live_status,
    liveStatusSince: u.live_status_since,
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
