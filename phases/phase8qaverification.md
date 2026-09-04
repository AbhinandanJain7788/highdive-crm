# Phase 8 — Navigation Fix, QA & Full Verification

## Objective
Close the gap between "code exists and compiles" and "the product actually works end to end." Fix the confirmed navigation gap, reconcile claude.md against what's actually true in the live app and database, verify every phase's checkpoints against real usage rather than assumed-passing, and resolve the open questions that have been sitting unanswered since Phase 0/5.

## Context
Phases 0–7 built the product. This phase does not add features — it proves the features that exist actually work, fixes the one confirmed UI defect blocking discoverability, and forces a decision on the items that have been silently deferred (claude.md's 5 Open Questions, the `pipeline_templates` documentation drift, the "is `calls` actually live" question). Run this after Phase 7, because Phase 7 finishes the last unbuilt screens and this phase needs everything to exist first — same reasoning claude.md gives for why Phase 7's own audit step is last.

This phase exists because "I built all the phases" and "the product works" turned out to be two different claims — Phase 7 was documented as needed but never actually built, several screens were built but unreachable, and Phase 6/7's own aggregate screens had never been exercised even once (0 rows in `report_requests`, `notification_settings`, `company_settings` at audit time). This phase is what catches that gap before a real user does.

## Step 1 — Fix the Navigation Gap

### What to do
`ui-gaps.md` item #7 (written during Phase 1, never resolved): Jobs, Clients, Recruiters, Assignment, and Reports are fully built and wired to live data but have **no sidebar entry and no in-app link anywhere** — only reachable by typing the URL. Get a decision on whether these should be added to the sidebar (and where — they don't fit the documented 18-item structure from Phase 1 Step 1) or whether Candidate Detail's "Applied For"/"Assigned Recruiter" fields should become links into them instead. Implement whichever is decided. Do not silently add sidebar items without confirming placement — the sidebar's exact order/grouping was explicitly signed off in Phase 1.

### Checkpoint 1
- [ ] Decision made and recorded (in claude.md or this file) on how Jobs/Clients/Recruiters/Assignment/Reports become reachable
- [ ] The decision is implemented — every screen in the product is reachable through the UI, not just by URL
- [ ] No other unrelated sidebar item was reordered or restyled in the process

## Step 2 — Reconcile claude.md Against Reality

### What to do
claude.md's own rule is "if the file and reality disagree, update the file." Apply that rule to everything found since Phase 0's original writing:
- `pipeline_templates` now has 2 rows ("Default Pipeline" + "Bulk Hiring Pipeline") — claude.md's Phase 0 as-built notes say only 1 exists and explicitly call Phase 3's two-template checkpoint unsatisfiable. Find out when/how the second template was added, update claude.md, and re-run Phase 3's checkpoint 2 ("two jobs using different pipeline templates show different stage lists") for real, since it's no longer blocked.
- Resolve claude.md's 5 open questions (disposition mismatch, AI Score column, recordings, `callback_due_at` vs `follow_ups`, multi-job candidates) — these have been sitting since Phase 1 with "confirm with Vivek before the phase that needs them," and every phase that needed them has now shipped. Get real answers and record them in claude.md, replacing the "Open Questions" section with resolutions.
- Confirm whether the live `calls` table (currently 3 rows, all matching Phase 0's own synthetic test-row description) is meant to be receiving real Android call traffic and isn't yet, or whether this Supabase project is intentionally a test/staging project separate from production call data. This materially changes what Phase 5/6's checkpoints actually proved — a checkpoint verified against 3 synthetic rows is not the same claim as one verified against real volume.

### Checkpoint 2
- [ ] `pipeline_templates` discrepancy resolved and claude.md updated
- [ ] All 5 Open Questions in claude.md have recorded answers, not just recommendations
- [ ] The `calls` table's real-vs-test status is confirmed and documented
- [ ] claude.md's Data Schema / Business Logic sections reflect the current live schema exactly (spot-check a handful of tables against `list_tables`, not just calls)

## Step 3 — Re-Verify Every Phase's Checkpoints Against Live Usage

### What to do
Every phase file's checkpoints were marked complete based on self-audit at the time. Re-run them for real, this time by actually clicking through the deployed app as each of the three role levels (Admin, and at least one seeded recruiter — not just `abhi@gmail.com`, which is Admin-only), not by re-reading the code. Prioritize the screens most likely to have silently regressed or never been exercised:
- Request Reports: submit a real report end to end, confirm it reaches `ready` (0 rows existed at last audit — first real submission is the actual test)
- Settings/Notifications/WhatsApp Templates: re-test after Phase 7 actually wires them
- Team Live Status specifically with a user that has null `process_id`/`live_status` (matches the `abhi@gmail.com` test account's actual current state) — confirm it renders sensibly rather than breaking
- Dashboard and Analytics: sanity-check the numbers shown against a direct Supabase query for the same date range, now that Phase 7's screens add more real data to work against
- Every "empty state" the HTML defines (No follow-ups, No unattributed calls, No Data to display, etc.) — trigger each one for real rather than trusting it was seen once during Phase 1

### Checkpoint 3
- [ ] Every phase's Final Checklist re-verified against the deployed app, not the codebase alone
- [ ] Tested as both Admin and a non-Admin recruiter account, not just `abhi@gmail.com`
- [ ] Every documented empty state actually triggered and confirmed to render correctly
- [ ] Any checkpoint that fails on re-verification is logged with the specific screen/action that broke it, not silently fixed without a record

## Step 4 — Route-by-Route Permission Sweep (independent of Phase 7 Step 5)

### What to do
This duplicates Phase 7 Step 5 deliberately — run it again here, independently, after Phase 7's own fixes land, as a second, adversarial pass rather than trusting the builder's own self-audit. For every route in claude.md's API Structure: call it signed out (expect 401), call it as a recruiter without the required permission (expect 403), call it as the correct role (expect success). Record actual HTTP responses, not assumptions.

### Checkpoint 4
- [ ] Every route tested in all three states (signed out / wrong permission / correct permission) with actual recorded responses
- [ ] No route returns 500 for a permission failure — only 401/403
- [ ] Findings cross-checked against Phase 7 Step 5's own audit — any disagreement between the two passes is investigated, not averaged away

## Step 5 — Data Volume & Edge Case Stress Test

### What to do
Every derived view (`v_allocations`, `v_interactions`, `v_rechurn`) and every dashboard/analytics number has only ever been verified against a small seed dataset (17 candidates, 3 calls at last audit). Before calling this production-ready, either get real Android call volume flowing (see Step 2's `calls` question) or synthetically generate a larger, more realistic dataset (hundreds of candidates/calls/follow-ups) and re-run Phase 4/5/6's checkpoints against it, specifically watching for: pagination correctness at 10/25/50 page sizes with >50 rows, percentage calculations that divide by zero at low volume but might round oddly at high volume, and the concurrent-assignment race-condition checkpoint from Phase 4 (which needs genuinely concurrent requests, not sequential ones, to mean anything).

### Checkpoint 5
- [ ] A realistic-volume dataset (real or synthetic) exists and every Phase 4/5/6 checkpoint has been re-run against it
- [ ] Pagination verified with actual multi-page result sets, not single-page seed data
- [ ] The concurrent auto-distribute test (Phase 4 Step 2) run with genuinely concurrent requests and confirmed no double-assignment
- [ ] Percentage/average calculations checked at both low and high volume for correctness

---

## Self-Audit Instruction
Before declaring this phase complete, you must:
1. Re-read every checkpoint in this phase file
2. Test each one against the deployed app and the live database directly — not the codebase in isolation
3. Return a structured report:
   ✅ [Checkpoint] — Pass
   ⚠️ [Checkpoint] — Partial: [specific reason]
   ❌ [Checkpoint] — Fail: [specific reason]
4. Fix all failures and partials before reporting phase complete.
5. Only say "Phase 8 Complete" when every checkbox is green — this is the last gate before calling the product done.

## Final Phase 8 Checklist
- [ ] Navigation gap fixed — every built screen is reachable through the UI
- [ ] claude.md fully reconciled with the live schema, live data, and all 5 Open Questions resolved
- [ ] Every phase's checkpoints re-verified against the deployed app as multiple roles, not just re-read from code
- [ ] Independent second-pass permissions sweep complete with recorded results
- [ ] Realistic data volume tested, not just the original seed set
- [ ] Self-audit passed with all green
- [ ] Manual verification done by architect
