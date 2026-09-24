-- Phase 5 addendum — Call disposition sync: when the Android app (or CRM) sets a
-- call's disposition, the application status is updated to match.
--
-- The mapping (enforced in application code, not as a DB constraint):
--   interested     → interview_scheduled (or selected / contacted per caller)
--   callback_later → contacted
--   not_reachable  → not_interested

alter table public.calls
  add column if not exists disposition text null
    check (disposition in ('interested', 'callback_later', 'not_reachable'));

comment on column public.calls.disposition is
  'Call outcome set by the Android app or CRM: interested, callback_later, not_reachable.';
