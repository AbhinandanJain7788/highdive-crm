# Phase 9 — Dashboard & Page-by-Page Filter Audit

## Objective
Go through every screen in the product one at a time, and for every filter, tab, search box, date range, sort control, and pagination option on that screen, verify it actually changes the result set correctly — not just that it renders. This is narrower and more mechanical than Phase 8: Phase 8 asks "does the product work end to end," this phase asks "does every single control on every single page do exactly what it says," one control at a time.

## Context
Phases 3–6 wired real data behind these screens, and claude.md/Phase 1's screen tables document every filter each page is supposed to have. Nobody has gone through and clicked every one of them individually against real data — the DB audit and code audit found gaps in whether screens were wired at all, but not whether an individual filter (e.g. "does the date range picker on Allocations actually narrow results, or does it just visually change and do nothing") works correctly. This phase closes that gap.

## How to test every filter (apply this method to each item below)
For each filter/control listed per page:
1. **Baseline** — load the page with no filter applied, note the row count / result shown.
2. **Apply** — set the filter to a specific value, confirm the result set visibly narrows or changes, and that it's the *correct* narrowing (spot-check at least one row that should now be excluded, and one that should remain).
3. **Combine** — if the page has more than one filter, apply two together and confirm they combine with AND logic (both conditions hold), not OR or one overriding the other.
4. **Clear/reset** — clear the filter and confirm it returns to the baseline, not a stuck or broken state.
5. **Edge case** — a filter value that should return zero results — confirm the page's documented empty state renders, not a blank screen or a crash.
6. **Persist across pagination/tab switch** — if the page also has pagination or tabs, confirm the filter survives switching pages/tabs (or note if it's expected to reset, and confirm that's actually the intended behavior, not a bug).

Record each filter as ✅ Works / ⚠️ Partially works (describe what's wrong) / ❌ Broken / 🚫 Not implemented (renders but does nothing).

## Step 1 — Dashboard (highest priority, test first)

`/dashboard` — per claude.md and Phase 6:
- [ ] **Today** tab — numbers reflect only today's activity (verify against a direct Supabase query filtered to today's `call_time`/`created_at` as appropriate)
- [ ] **Y'day** tab — reflects only yesterday
- [ ] **Last 7 Days** tab — reflects the correct trailing 7-day window
- [ ] **Last 30 Days** tab — reflects the correct trailing 30-day window
- [ ] Switching between all four tabs updates every tile on the page (Overall/Outbound/Inbound totals, Connected/Not Connected/Personal, Avg + Total Talk Time, Open Actions, Total Candidates buckets) — not just one section
- [ ] Percentages shown add up correctly and never show `NaN`/divide-by-zero on a range with no data (test this specifically on a role/date combo with zero calls)
- [ ] Recruiter login vs Admin login — recruiter's Dashboard shows only their own numbers, confirmed against a direct DB query scoped to that recruiter
- [ ] Open Actions counts (unassigned, pending follow-ups, missed calls) match what the Allocations, Follow-Ups, and Call Logs screens show independently for the same range

## Step 2 — Recruitment Core Screens

`/candidates`
- [ ] Search by Name — partial match works (e.g. searching "an" matches "Ananya")
- [ ] Search by Phone — partial match works
- [ ] Status filter chips — each of the 9 `application_status` values filters correctly
- [ ] Page size 10/25/50 — result set and total count both change correctly, no duplicate/missing rows across page boundaries
- [ ] Combining search + status filter together narrows correctly

`/allocations`
- [ ] New / Attempted tabs — counts match a direct `v_allocations` query for each bucket
- [ ] Search Phone/Name
- [ ] Date range (including custom range, not just presets)
- [ ] By Status filter
- [ ] Selected Users filter
- [ ] All four filters combine correctly with each other and with the New/Attempted tab

`/interactions`
- [ ] Status filter
- [ ] Date range
- [ ] Pagination 10/25/50
- [ ] "Interacted on" sort/value reflects the most recent `call_time`, not `created_at`

`/jobs`, `/clients`, `/recruiters` — confirm any search/sort controls present in the live UI (not just what's documented) actually work; these three screens weren't documented with explicit filters in claude.md, so note anything you find that isn't covered above.

`/assignment`
- [ ] Auto-Distribute vs Manual Assign tabs switch the visible controls correctly
- [ ] Round Robin vs Load Balanced — confirm they actually produce different distributions (code audit flagged these may run identical logic — verify directly)
- [ ] Candidate checkboxes — "Distribute Selected (n)" count updates live as rows are checked/unchecked
- [ ] Recruiter Workload bars reflect live active assignment counts, updating after a distribution

`/import`
- [ ] Upload step accepts a CSV and correctly reports total row count
- [ ] Duplicate review step — a row matching an existing phone/email is flagged, and both "existing" and "new" sides render correctly
- [ ] Skip Duplicate vs Import Anyway both behave correctly per row
- [ ] Confirm Import step shows a count matching what was actually created

`/reports`
- [ ] Pipeline Funnel, Call Outcomes, Calls by Recruiter sections each match a direct DB query
- [ ] Any date range or filter control on this screen narrows all three sections consistently

## Step 3 — Calls, Follow-Ups & Calendar

`/call-logs`
- [ ] Outgoing/Incoming filter
- [ ] Connected/Not Connected status filter (derived from `duration_seconds`)
- [ ] Disposition filter if present
- [ ] Attribute to Job — job select + Link button correctly sets `application_id` and removes the row from Unattributed
- [ ] Unattributed tab ↔ All toggle (Phase 5 fix) works both directions
- [ ] "No unattributed calls" empty state renders when queue is actually empty

`/follow-ups`
- [ ] Pending tab — shows overdue + due-today only
- [ ] Upcoming tab — shows future only
- [ ] Empty state "No follow-ups to display" renders correctly when applicable

`/calendar`
- [ ] Month navigation (prev/next) updates the grid and day counts correctly
- [ ] Clicking a day updates the side panel to that day's follow-ups
- [ ] Empty state for a day with no follow-ups

`/recurring-follow-ups`
- [ ] Pending/Upcoming counts correct
- [ ] View Schedule and History controls work
- [ ] "No Data to display" empty state

## Step 4 — Aggregate & Admin Screens

`/analytics`
- [ ] Overall tab's Call Trends chart (Outbound/Inbound/Total) matches `/api/calls` for the same range
- [ ] Total Talk Time chart's average reference line is computed live, not hardcoded — change the underlying data (or date range) and confirm the line moves
- [ ] Login Analytics ranges
- [ ] Top 5 User Performances — correct order, exactly 5 rows or fewer
- [ ] Customer Stages percentages match pipeline stage distribution
- [ ] Conversion Funnel stages read from `pipeline_stages`, not hardcoded — verify against the now-confirmed 2 pipeline templates
- [ ] "Customers By (Select Field)" — test at least 3 different field selections, plus its empty state with nothing selected
- [ ] User Performance tab stays "coming soon" as documented
- [ ] AI Call Analytics tab — confirm current state matches whatever the Open Questions resolution in Phase 8 decided

`/rechurn`
- [ ] Filters narrow the candidate pool correctly
- [ ] Get Count matches a direct `v_rechurn` query for the same filters
- [ ] Assign in Common Pool clears `assigned_recruiter_id` and those candidates reappear in Allocations New
- [ ] Change Owner to Specific Users creates new active assignments and closes old ones

`/team-live-status`
- [ ] Call Tracking filter
- [ ] Call Recording filter
- [ ] Version filter
- [ ] A-Z / Z-A sort
- [ ] All four states (on_call/idle/on_break/offline) render with correct "Since:" duration
- [ ] Specifically test with the `abhi@gmail.com` account, which has null `live_status` in the DB — confirm it doesn't break the board

`/team`
- [ ] Active / Inactive / Invited tabs match direct `users.status` counts
- [ ] Add User flow

`/roles-permissions`
- [ ] Permission chip "+n More" overflow shows the correct count
- [ ] Creating/editing a role with a subset of permissions persists correctly

`/whatsapp-templates` *(only testable once Phase 7 wires this — currently mock-only)*
- [ ] Process filter
- [ ] Visibility filter
- [ ] Search

`/data-management`
- [ ] Configure Upload → Upload Data two-step flow
- [ ] Process selection
- [ ] Upload type (Allocations vs Customers), each enforcing its 20k row cap correctly
- [ ] Bulk Export produces a file matching applied filters
- [ ] Bulk Delete soft-deletes only (row disappears from lists, still present in DB)

`/settings`, `/notifications`, `/request-reports` — *once Phase 7 wires these:*
- [ ] Settings General toggles persist and survive reload
- [ ] Notifications thresholds + Hours/Minutes unit persist
- [ ] Request Reports Basic tab: report type selection, date+time range with AM/PM, Created Date vs Last Interaction basis — confirm the two date-basis options actually produce different result sets, not just different labels

---

## Self-Audit Instruction
Before declaring this phase complete:
1. Confirm every checkbox above has actually been clicked and observed, not assumed from reading code
2. For anything marked ⚠️ or ❌, note the exact page, filter, and what happened (screenshot if possible)
3. Return a structured report grouped by page, using the ✅/⚠️/❌/🚫 scale defined above
4. Do not fix issues found here inline unless asked — this phase is about producing an accurate list, same principle as Phase 1's `ui-gaps.md`. Compile findings into a `filter-audit-findings.md` for review before anyone starts fixing.
5. Only say "Phase 9 Complete" once every page above has been gone through control by control.

## Final Phase 9 Checklist
- [ ] Dashboard's 4 date tabs verified individually against direct DB queries
- [ ] Every filter on every recruitment core screen (Candidates, Allocations, Interactions, Jobs, Clients, Recruiters, Assignment, Import, Reports) tested per the 6-step method above
- [ ] Every filter on Calls/Follow-Ups/Calendar screens tested
- [ ] Every filter on Analytics, Rechurn, Team Live Status, Team, Roles & Permissions, Data Management tested
- [ ] Settings/Notifications/WhatsApp/Request Reports filters tested (after Phase 7 lands)
- [ ] `filter-audit-findings.md` produced with every ⚠️/❌/🚫 item listed
- [ ] Manual verification done by architect
