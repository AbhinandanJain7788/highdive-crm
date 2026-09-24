-- Phase 5 addendum — Agent action log: after a call ends, the Android app can
-- store a pending next-action (follow-up or interview scheduled) directly on the
-- call row. The CRM reads these, shows them in the call log, and provides a button
-- to complete the action (creating the actual follow-up or interview record).
--
-- The APK writes these columns with its service-role key; the CRM can only complete
-- (not create or edit) them via POST /api/calls/:id/complete-action.

alter table public.calls
  add column if not exists next_action_type text null
    check (next_action_type in ('follow_up', 'interview_scheduled')),
  add column if not exists next_action_at timestamptz null,
  add column if not exists next_action_note text null;

comment on column public.calls.next_action_type is
  'Set by Android app after call ends: follow_up or interview_scheduled.';
comment on column public.calls.next_action_at is
  'Date+time for the pending next action (follow-up or interview).';
comment on column public.calls.next_action_note is
  'Optional note about the next action set by the agent.';
