-- Phase 4 — Bulk Delete needs a soft-delete flag (claude.md: never hard-delete
-- candidates/applications/calls; status/flag only). No existing column covers this.
--
-- APPLIED 2026-09-04, pasted into the Supabase Dashboard SQL Editor by the user
-- (DDL access was unavailable to the session that built this phase — no connected
-- Supabase MCP, no direct DB connection string or access token). types/supabase.ts
-- was updated by hand to match, and lib/candidates.ts's list/detail reads now
-- filter `deleted_at is null`.
--
-- Still open: v_allocations/v_interactions/v_rechurn are views built on top of
-- candidates/applications and don't filter deleted_at — their exact CREATE VIEW
-- source wasn't available to this session (PostgREST doesn't expose
-- information_schema), so rewriting them blind risked corrupting the bucket logic
-- Phase 0 built and Phase 3 verified. A soft-deleted candidate can therefore still
-- surface via Allocations/Interactions/Rechurn until someone with SQL editor or
-- MCP access adds the same filter to those three views.

alter table public.candidates
  add column if not exists deleted_at timestamptz null;

comment on column public.candidates.deleted_at is
  'Soft-delete marker set by POST /api/data/bulk-delete. Never hard-delete candidates — filter deleted_at is null in reads instead.';
