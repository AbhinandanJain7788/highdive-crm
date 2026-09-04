# Phase 9 — Filter Audit Findings

> **Update (2026-09-04, follow-up pass):** every non-✅ item below except the two
> intentional placeholders has since been fixed and live-verified. See the "Fixed"
> callouts inline and the summary table at the bottom for the current state.

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
- ✅ **Fixed.** "Selected Users" now opens a real multi-select recruiter picker (reusing the existing `CheckboxListPopover`), wired to a new `assignToIds` param on `GET /api/allocations` / `lib/allocations.ts`. Live-verified: filtering to one recruiter narrowed 4 attempted allocations to exactly the 2 belonging to that recruiter.

## Interactions
- ✅ Status filter, date range, pagination — all narrow correctly.
- ✅ "Interacted on" sort — confirmed reading `max(call_time)`, not `created_at` (code comment + live order matches: Sep 1 → Aug 28 → Aug 28 → Aug 26).

## Jobs / Clients / Recruiters
- ✅ **Fixed.** Added a search box to all 3 screens (`getJobRows`/`getClientRows` already supported a `search` option server-side, just never exposed in the UI; `getRecruiterRows`/`listRecruiterUsers` gained one). Clients also gained the pagination controls Jobs already had but Clients was missing. Live-verified: `?search=Backend` on Jobs, `?search=Bluepeak` on Clients, `?search=Ayesha` on Recruiters each returned only the matching row. Sort controls were not added — no sort key beyond the existing `created_at desc` default was ever specified for these screens.
- ✅ Pagination itself renders correctly on all 3 (server-rendered, 200 OK).

## Assignment
- ✅ Round Robin vs Load Balanced **produce genuinely different distributions** — re-verified live (ui-gaps.md item 13's concern was about the *source HTML*, not this codebase): distributing 2 unassigned applications via `load_balanced` correctly picked the least-loaded recruiter first (Suresh Pillai, 1→2) then the next-least-loaded, rather than following pool order. Reverted after testing.
- ✅ Recruiter Workload bars reflect live active-assignment counts and updated correctly after a real distribution, then correctly reverted after the test assignments were undone.
- Not click-tested (no browser): "Distribute Selected (n)" live checkbox count, Auto-Distribute/Manual tab switch — pure client state, code-reviewed only.

## Import
- Not re-run this phase — Phase 4's own self-audit already exhaustively proved the full upload→duplicate-review→decide→confirm flow with a real 500-row batch (both a phone-match and a name-mismatch duplicate case), including the 96.7s→3.2s bulk-insert fix. Re-confirmed only that the 20k-row cap (`MAX_UPLOAD_ROWS`) is enforced identically for both upload types via the same shared constant.

## Reports
- ✅ Pipeline Funnel, Call Outcomes, Calls by Recruiter — all three match direct DB queries exactly (Ayesha: 2 total/1 connected/284s avg; Suresh: 1/1/142s; unattributed: 1) — no drift since Phase 6.
- ✅ **Fixed.** Added a from/to date range control, applied consistently to all three sections (`getReportsData` now takes a `{from, to}` range, passed through to the pipeline funnel query and the calls query both) — satisfies the checkpoint's own "narrows all three sections consistently" wording. Live-verified: a narrow out-of-range window (2020-01-01..02) correctly zeroed out Call Outcomes while the unfiltered baseline still showed 3 calls.

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
- ✅ **Fixed.** Conversion Funnel gained a template selector (`getPipelineFunnel` now takes an optional `templateId`; `GET /api/analytics/overall` returns the full `pipelineTemplates` list plus `activeTemplateId`) instead of always reading only the Default Pipeline template. No 1:1 stage mapping was invented between the two templates' different vocabularies — each template's funnel is shown on its own, which is what the picker is for. Live-verified: Default Pipeline and Bulk Hiring Pipeline return genuinely different, correctly-scoped stage/count lists for the same range.
- ✅ **Fixed.** "Customers By (Select Field)" now genuinely groups the same "one candidate, most-recent-application" set every other widget uses, by Source/Status/Recruiter/Job (`GET /api/analytics/customers-by`, new). Live-verified all 4 fields sum to the correct total (14) for the range.
- ✅ **Fixed.** User Performance tab now shows a real, uncapped table (`GET /api/analytics/top-users?all=true`, reusing the existing Top-5 aggregation with its cap lifted rather than a second query). Live-verified: returns the same 2 real agents Top-5 already showed, just without the 5-row cap.
- No new AI Call Analytics decision was made in Phase 8 (Open Question 2 was already resolved pre-Phase-7: permanently-disabled placeholder) — tab state matches that resolution.

## Rechurn
- ✅ Filter narrows correctly — baseline 3, `status=rejected` → 1, both matching a direct `v_rechurn` query exactly.
- Not re-mutated this phase — both initiate modes (Common Pool / Specific Users) were already live-tested end-to-end with real mutations and fully reverted in Phase 6's own self-audit.

## Team Live Status
- ✅ A-Z / Z-A sort — genuinely implemented (`localeCompare`), not decorative.
- ✅ **Fixed.** Migration `0031_users_device_settings` added real `users.call_tracking_enabled`/`call_recording_enabled`/`app_version` columns — CRM-side settings, not live Android telemetry (claude.md forbids touching the Android app) — defaulted to match the previous hardcoded display values so nothing changed until explicitly toggled. `GET /api/team/live-status` now takes real `status`/`callTracking`/`callRecording`/`version` params. Also fixed the "Status: Select Filters" dropdown, which had the same decorative problem but wasn't separately called out in the original audit. Live-verified: toggling one user's `app_version`/`call_tracking_enabled` in the DB and re-querying with each filter correctly isolated exactly that user, then reverted.
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

## Summary — original findings vs. current state
| Page | Item | Original | Now |
|---|---|---|---|
| Allocations | "Selected Users" filter | ⚠️ mislabeled — no real per-user filter existed | ✅ Fixed — real multi-select |
| Jobs/Clients/Recruiters | Search | 🚫 none existed | ✅ Fixed — search added to all 3 |
| Reports | Date range filter | 🚫 none existed | ✅ Fixed — applies to all 3 sections |
| Analytics | Conversion Funnel | ⚠️ Default Pipeline only | ✅ Fixed — template selector |
| Analytics | "Customers By (Select Field)" | 🚫 intentional static empty state | ✅ Fixed — real grouping (per your instruction to build it, overriding the earlier "leave as placeholder" sign-off) |
| Analytics | User Performance tab | 🚫 intentional "coming soon" | ✅ Fixed — real uncapped table (same override) |
| Team Live Status | Call Tracking / Call Recording / Version / Status filters | 🚫 decorative, no backing schema | ✅ Fixed — real `users` columns (migration 0031) + working filters |

All 7 were fixed and live-verified in the 2026-09-04 follow-up pass (not left for later, per your explicit instruction to correct everything except the calls-volume item). Jobs/Clients/Recruiters sort controls were intentionally not added — no sort key beyond the existing default was ever specified.
