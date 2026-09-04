# Phase 9 — Filter Audit Findings

Method: for each page below, filters were tested against the live dev server (real HTTP requests to the API, cross-checked against direct Supabase queries where a numeric result could be independently verified) rather than by reading code alone. Client-only interaction state (checkbox live-counts, tab-switch animations, "+n More" chip expansion) that has no server round-trip is noted as code-reviewed rather than click-tested, since this session had API/DB access but no browser.

Scale: ✅ Works · ⚠️ Partially works · ❌ Broken · 🚫 Not implemented (renders but does nothing)

---

## Dashboard
- ✅ Today / Y'day / Last 7 Days / Last 30 Days — all 4 tabs return distinct, correctly-scoped data (`today`/`yesterday` both zero, matching no seed data in-window; `last7`: 1 call; `last30`: 3 calls). No `NaN`/divide-by-zero at zero volume.
- ✅ Recruiter vs Admin scoping — recruiter session (Ayesha) returns her own 2 calls / 2 candidates, not the org's 3/14.
- ✅ Open Actions match Allocations/Follow-Ups exactly — `unassigned: 5` = `/api/allocations?bucket=new` total; `pendingFollowUps: 7` = `/api/follow-ups?bucket=pending` total.

## Candidates
- ✅ Search by name — partial match (`"an"` matches Manish/Simran/Ananya/Rahul/Karan).
- ✅ Search by phone — partial match (`9820` matches Ananya Sharma).
- ✅ Status filter — `selected` → 1 row, correct.
- ✅ Combine search+status — AND logic confirmed (`an`+`selected` → 0, correctly excludes Priya Nair who matches status but not the name/phone term).
- ✅ Page size 10/25/50 — 14 total, 10 returned on page 1.
- ✅ Edge case (0 results) and clear-to-baseline both confirmed.

## Allocations
- ✅ New/Attempted tab counts — 5/4, matches direct `v_allocations` query.
- ✅ Search — narrows correctly.
- ✅ Date range — `2026-08-30..08-31` → 5, matches a direct `v_allocations` count exactly.
- ✅ Status filter — `attempted`+`contacted` → 2, matches direct DB count exactly.
- ✅ Pool scope (Common Pool) — 5, matches unassigned count.
- ⚠️ **"Selected Users" filter — mislabeled, not a real per-user filter.** The `UserScopeDropdown` only toggles between "Common Pool" (`pool=true`) and a default "Selected Users" state that applies **no additional filtering at all** — there is no actual user-picker anywhere in the code (`lib/allocations.ts`'s own comment confirms: "'Selected Users' (no extra scoping)"). The label implies a multi-select of specific recruiters; it doesn't do that.

## Interactions
- ✅ Status filter, date range, pagination — all narrow correctly.
- ✅ "Interacted on" sort — confirmed reading `max(call_time)`, not `created_at` (code comment + live order matches: Sep 1 → Aug 28 → Aug 28 → Aug 26).

## Jobs / Clients / Recruiters
- 🚫 **No search or sort control exists on any of these 3 screens** — confirmed by reading the live page components (`jobs/page.tsx`, `clients/page.tsx`, `recruiters/page.tsx`): only a `page` param for pagination. Not a regression — these were never documented with filters and none were ever built.
- ✅ Pagination itself renders correctly on all 3 (server-rendered, 200 OK).

## Assignment
- ✅ Round Robin vs Load Balanced **produce genuinely different distributions** — re-verified live (ui-gaps.md item 13's concern was about the *source HTML*, not this codebase): distributing 2 unassigned applications via `load_balanced` correctly picked the least-loaded recruiter first (Suresh Pillai, 1→2) then the next-least-loaded, rather than following pool order. Reverted after testing.
- ✅ Recruiter Workload bars reflect live active-assignment counts and updated correctly after a real distribution, then correctly reverted after the test assignments were undone.
- Not click-tested (no browser): "Distribute Selected (n)" live checkbox count, Auto-Distribute/Manual tab switch — pure client state, code-reviewed only.

## Import
- Not re-run this phase — Phase 4's own self-audit already exhaustively proved the full upload→duplicate-review→decide→confirm flow with a real 500-row batch (both a phone-match and a name-mismatch duplicate case), including the 96.7s→3.2s bulk-insert fix. Re-confirmed only that the 20k-row cap (`MAX_UPLOAD_ROWS`) is enforced identically for both upload types via the same shared constant.

## Reports
- ✅ Pipeline Funnel, Call Outcomes, Calls by Recruiter — all three match direct DB queries exactly (Ayesha: 2 total/1 connected/284s avg; Suresh: 1/1/142s; unattributed: 1) — no drift since Phase 6.
- 🚫 **No date range or filter control exists on this screen at all** — confirmed by reading `reports/page.tsx`. The checkpoint asking whether such a control "narrows all three sections consistently" doesn't apply; there is nothing to narrow with.

## Call Logs
- ✅ Direction filter (outbound=3, inbound=0), disposition filter (`interested`→1), connected/not-connected (`connected=true`→2, `false`→1, sums to total) all correct.
- ✅ Unattributed count (1) matches Reports' `unattributedCallCount` exactly.
- Not click-tested: Attribute-to-Job link button, Unattributed↔All toggle direction — code-reviewed only (both call the same underlying endpoints already verified working).

## Follow-Ups / Calendar / Recurring Follow-Ups
- ✅ Pending (7) vs Upcoming (3) — every pending row's due date is ≤ today (2026-09-04), every upcoming row's is after — correctly split, not just a status flag.
- ✅ Calendar month grid returns real September 2026 events.
- ✅ Recurring Follow-Ups returns `0/0` with no data — the "No Data to display" empty state is genuinely reachable (there's no recurring follow-up seed data at all), not just theoretically defined.

## Analytics
- ✅ Call Trends chart matches `/api/calls` totals exactly (3 calls).
- ✅ Total Talk Time average — genuinely computed (`totalMinutes / points.length`), confirmed live, not hardcoded.
- ✅ Login Analytics — real computed duration from paired login/logout `activity_logs` rows; Wrap-up/Break/Idle correctly show `"--"` (no backing history table, documented).
- ✅ Top 5 User Performances — 2 rows (correct: only 2 agents have any calls), correctly fewer than 5.
- ✅ Customer Stages — percentages sum to ~100% (21+50+14+14=99, rounding), no NaN.
- ⚠️ **Conversion Funnel only covers the Default Pipeline template, not both.** `getDefaultPipelineFunnel` (`lib/pipeline.ts`) explicitly queries only `pipeline_templates WHERE is_default = true` — applications on the 3 jobs using "Bulk Hiring Pipeline" (Phase 3's second template) are invisible to this chart. This is a **pre-existing, self-documented limitation** (the code's own comment cites it as "same documented, pre-existing limitation as ui-gaps.md item 15"), not a new regression — but it means the "verify against the now-confirmed 2 pipeline templates" checkpoint fails as literally worded: the funnel does not, in fact, cover both.
- 🚫 "Customers By (Select Field)" — confirmed still the static empty state, per Phase 6's explicit instruction to leave it that way. No regression.
- 🚫 User Performance tab — confirmed still "coming soon," as documented.
- No new AI Call Analytics decision was made in Phase 8 (Open Question 2 was already resolved pre-Phase-7: permanently-disabled placeholder) — tab state matches that resolution.

## Rechurn
- ✅ Filter narrows correctly — baseline 3, `status=rejected` → 1, both matching a direct `v_rechurn` query exactly.
- Not re-mutated this phase — both initiate modes (Common Pool / Specific Users) were already live-tested end-to-end with real mutations and fully reverted in Phase 6's own self-audit.

## Team Live Status
- ✅ A-Z / Z-A sort — genuinely implemented (`localeCompare`), not decorative.
- 🚫 **Call Tracking, Call Recording, and Version filters are all decorative.** Each dropdown has exactly one option ("Any") and no `onChange` handler wired to any filtering logic — confirmed by reading `TeamLiveStatusClient.tsx`, whose own comment states these three fields "aren't part of the users schema." They render but do nothing.
- ✅ `abhi@gmail.com`'s null `live_status`/`live_status_since` renders cleanly (`liveStatus: null` from the API, page renders "Abhi" with no error) — the specific edge case the phase brief calls out by name.

## Team
- ✅ Active/Inactive/Invited tab counts — 8/1/1, matches direct `users.status` counts exactly.
- Add User flow not re-tested this phase (already end-to-end verified in Phase 2, including the auth.users/public.users pairing and cleanup).

## Roles & Permissions
- Not independently re-tested this phase for the "+n More" overflow count specifically (client-only rendering). Create/edit persistence re-confirmed live in Phase 7 (create→delete round trip, `role_created`/`role_deleted` activity rows correct).

## WhatsApp Templates (Phase 7-wired)
- ✅ Process filter, Visibility filter, Search — all confirmed live in Phase 7's own self-audit (full CRUD + visibility-scoping round trip).

## Data Management
- Not re-run this phase (see Import above) — Phase 4's self-audit already covered Configure Upload → Upload Data, Process selection, both upload types' 20k caps, Bulk Export (row count matches applied filters, with and without search), and Bulk Delete (confirmed genuine soft-delete, re-confirmed again in Phase 7 and at higher volume in Phase 8 Step 5).

## Settings / Notifications / Request Reports (Phase 7-wired)
- ✅ Settings General toggles — persist and survive reload (Phase 7 self-audit).
- ✅ Notifications thresholds + Hours/Minutes unit — persist (Phase 7 self-audit).
- ✅ Request Reports — submitted a real report end-to-end in Phase 8 Step 3 (`Customers`, `created_date` basis) and it reached `status: "ready"` with a real generated CSV. Created Date vs Last Interaction basis confirmed producing genuinely different result sets in Phase 6 (8 vs 3 candidates for the same window).

---

## Summary of non-✅ items
| Page | Item | Status |
|---|---|---|
| Allocations | "Selected Users" filter | ⚠️ mislabeled — no real per-user filter exists |
| Jobs/Clients/Recruiters | Search/sort | 🚫 none exist |
| Reports | Any filter | 🚫 none exist |
| Analytics | Conversion Funnel | ⚠️ Default Pipeline only, excludes Bulk Hiring Pipeline's 3 jobs (pre-existing, documented) |
| Analytics | "Customers By (Select Field)" | 🚫 intentional static empty state |
| Analytics | User Performance tab | 🚫 intentional "coming soon" |
| Team Live Status | Call Tracking / Call Recording / Version filters | 🚫 decorative, no backing schema |

None of the above were fixed inline, per this phase's own instruction.
