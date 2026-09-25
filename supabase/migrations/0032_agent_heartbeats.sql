-- Phase 10 — Agent heartbeat: Android app reports whether each agent is
-- actively on a call (true) or free/idle (false). The CRM reads this to show
-- a real-time activity indicator on the Team Live Status board.
--
-- The APK writes via POST /api/agent-heartbeats (authenticated as the agent).
-- The CRM reads the latest heartbeat per user via getLiveStatusRows.

create table if not exists public.agent_heartbeats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  is_active boolean not null default true,
  current_call_id text null,
  heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.agent_heartbeats is
  'Android app heartbeat: each row is one heartbeat from an agent. APK sends true (on call) / false (free/idle).';
comment on column public.agent_heartbeats.is_active is
  'true = agent is on a call or actively working, false = agent is idle/free. Set by Android app.';
comment on column public.agent_heartbeats.current_call_id is
  'If is_active=true, the call ID the agent is currently on.';
comment on column public.agent_heartbeats.heartbeat_at is
  'Timestamp of this heartbeat.';

create index if not exists idx_agent_heartbeats_user_id
  on public.agent_heartbeats(user_id, heartbeat_at desc);
