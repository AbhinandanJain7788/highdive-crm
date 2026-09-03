# UI Gaps — Phase 1 (HTML → Next.js Conversion)

Everything below was found while converting the signed-off `Recruitment CRM (standalone).html`
prototype to Next.js, screen for screen. Per Phase 1's rule, **nothing here was fixed
unilaterally** — every screen renders the prototype's actual behavior (including its bugs and
dead ends), and this file exists so Vivek can decide what to do about each item. Grouped by
theme, not by which batch found it.

---

## A. Known gaps carried over from claude.md / Phase 1's own starting list

1. **AI Score / AI Call Analytics** — present in the source but stubbed (`aiScoreLabel: '--'`,
   "coming soon"), while AI is explicitly out of scope for this build. Kept as a disabled
   placeholder on Call Logs and Analytics. Remove entirely, or keep as a permanent placeholder?
2. **"Customers" vs "Candidates"** — one entity (`candidates` table), two labels. The sidebar
   nav item reads "Customers" (matches the source exactly) and routes to `/candidates`. No
   second route was built. Confirm this is the intended resolution.
3. **Disposition vocabulary mismatch** — the UI's Connected/Not Connected/Busy/Switched Off
   (used on Call Logs, callLogsSeed) vs. the live DB's `interested/callback_later/not_reachable`
   enum (claude.md Open Question 1). Not resolved in Phase 1 — mock data uses the UI's own
   vocabulary since there's no real `calls` table involved yet. Needs your decision before Phase 5.
4. **Multi-job candidates** — the UI shows one job per candidate row. Phase 0 seeded one
   candidate (Ananya Sharma) with two active applications specifically to exercise this later;
   Phase 1's UI doesn't yet have a place to show a second job on the same candidate row.
5. **Recruiters vs Team** — both screens exist over the same people (`/recruiters` and `/team`),
   confirmed built as two separate screens per the source. Confirm both are wanted long-term.
6. **No create/edit modals for Jobs or Clients** — only List and Detail views exist, matching
   the source exactly (no "+ Add Job" or "+ Add Client" flow anywhere in the prototype).

## B. Screens/handlers that exist in the source's code but have no click path to reach them

7. **Jobs, Clients, Recruiters, Assignment, and Reports have no in-app navigation to them.**
   The main sidebar (18 items, matches claude.md exactly) never links to these five screens, and
   Candidate Detail's "Applied For" / "Assigned Recruiter" fields are plain text/a dropdown, not
   links. All five routes exist and are fully built (`/jobs`, `/clients`, `/recruiters`,
   `/assignment`, `/reports`) and directly reachable by URL, but nothing in the rendered UI leads
   a user there. This looks like navigation that was designed into the data/state model
   (`goJobs`, `goClients`, etc. with matching active-nav-style props) but never got wired to a
   visible element in this prototype. **Decision needed:** should these get sidebar entries, or
   should Candidate Detail's job/recruiter fields become links into them?
8. **A second, entirely different "Settings" panel is dead code.** The source defines two
   unrelated views both called "Settings": the reachable one (General/Account + password reset,
   wired to the sidebar) and a second one — a Pipeline Template stage editor + a User
   Management/Invite User panel — triggered by a `goSettings` handler that is never called from
   any element anywhere in the prototype. Only the reachable one was built into `/settings`. The
   Pipeline Template editor and Invite User panel were not built anywhere. **Decision needed:**
   was pipeline-stage editing meant to live under Data Management, or Invite User under Team?
   Or was this simply an abandoned iteration that should stay unbuilt?
9. **Company Details / API Configuration / Account & Billing / Usage / Activity Logs placeholders
   had no entry point either** — same dead-handler situation as #8 (source: `adminOtherLabels`).
   Since the phase task required these to exist as reachable "coming soon" states, a small
   sub-navigation tab strip was added at the top of `/settings` reusing the app's existing tab
   visual pattern. **This tab strip does not exist in the source — it was synthesized to satisfy
   the "must be reachable" requirement.** Flagging for your review; a different placement may be
   preferred.
10. **Call Logs' "Unattributed" tab has no way back to "All".** The button that switches to
    Unattributed has no counterpart switching back — ported faithfully (same dead end exists in
    the source).

## C. Data/schema gaps surfaced by having a real, structured mock layer

11. **"Created By" is a hardcoded literal in the source, not a real field.** Candidates List
    shows "Rakshit Verma" for every row's Created By column (line 1829 of the source), while
    "Sourced by" is genuinely bound to each candidate's source. There is no second "who created
    this candidate" field anywhere in the data model. Worth confirming this was intentional and
    not a wiring bug that shipped into the signed-off HTML.
12. **Call attribution doesn't persist which job a call was linked to.** The mock `calls` schema
    (matching Phase 0's real `calls` table) has no field to record the attributed job on the call
    row itself once "Link" is clicked in Call Logs' Unattributed tab — only `candidate_id` and an
    unattributed flag. Cosmetically interactive in Phase 1; needs `application_id` (added for
    real in Phase 5 per claude.md) before this becomes more than cosmetic.
13. **Round Robin vs Load Balanced (Assignment screen) run identical logic in the source** — the
    method choice only changes a label, not the actual distribution algorithm. If "Load Balanced"
    should genuinely weight by current recruiter workload, that logic needs to be designed; it
    isn't present in the signed-off prototype to translate.
14. **"Calls Today" isn't actually filtered to today, even in the source** — it's each
    recruiter's total row count across the whole call log. Mirrored literally rather than
    inventing a real date filter the source itself doesn't have.
15. **Pipeline stage "Offered" can never have any candidates.** The 8-stage pipeline (from the
    source's `defaultPipelineStages`) includes "Offered" between Selected and Joined, but the
    `application_status` enum has no value that maps to it (see Phase 0's As-Built Notes on the
    `rejected`→Screening / `not_interested`,`no_response`→Contacted mapping). Job Detail's
    Pipeline Breakdown and Reports' Pipeline Funnel will always show 0 for "Offered." Pre-existing
    Phase 0 gap, now visible on two more screens.
16. **Team Live Status's per-member Call Tracking / Call Recording / Version fields, and its
    7-bucket status taxonomy (Idle/On Call/Wrapping up/On Break/Checked Out/Logged Out/Hasn't
    Logged in), have no backing schema.** Phase 0's `live_status` enum only has 4 values. Rows
    are defaulted to a common case; 3 of the 7 buckets can never be non-zero. Needs a decision on
    growing the enum vs. shrinking the UI.
17. ~~Rechurn's status filter dropdown doesn't constrain "Get Count"~~ — **fixed** (was true in
    the source too, but flagged as looking broken live). `getRechurnCount` now respects the
    status dropdown and the Today/Last 30 Days/Select Range basis (Created Date or Last
    Interaction), instead of always using the fixed eligible-status set unconditionally.
18. **Analytics' Overall tab numbers (Call Trends, Talk Time, Customer Stages, Conversion Funnel,
    Login Analytics, Top 5 User Performances, the `avg(39.3)` reference line) are hard-coded
    literals in the source itself**, never computed from any seed array — not something Phase 1
    introduced. These will need to become real query-backed metrics in Phase 5/6.
19. **Recruiters list is 5 people in Phase 1's mock vs. 6 in the source's own hardcoded
    `recruiters` array.** The source's list always includes Tanvi Shah regardless of her invited
    status; Phase 1's mock filters to `status === 'active'`, excluding her (and Meera Nair, a
    Phase-0-only synthetic addition). Tanvi has 2 call log rows attributed to her that never
    surface on `/recruiters`, `/recruiters/[id]`, or Reports' Calls by Recruiter as a result.
    **Decision needed:** should invited recruiters appear in these three screens?

## D. Minor, low-stakes items

20. Notification bell "11" badge (Request Reports, Rechurn, Team Live Status, Analytics) is a
    static literal with no real data source — preserved as-is.
21. Team's "Total Licenses : 3 | Used : 1" is a hardcoded constant unrelated to the actual
    9-person user list, same as in the source.
22. Team's "Add-ons" column has no backing field; always renders `'--'`, matching the source's
    only-ever value.
23. Several controls are decorative/non-functional in the source itself and were left inert
    (no invented behavior): Team's process filter/icon buttons/Add User/row "⋮" menu, Roles &
    Permissions' "Add a Role"/row "⋮" menu, Whatsapp Templates' filters/Create New/Edit/
    Duplicate/Delete, Data Management's Bulk Import "Next" button (step 2 doesn't exist in the
    source at all).
24. Candidate Detail's "Schedule Follow-up" input/button had zero handlers in the source (purely
    decorative) — made locally interactive per this phase's explicit task brief, flagged here
    since it's slightly more functional than the signed-off design.
25. Settings' password reset had no working handler in the source at all — implemented real
    client-side validation against the 4 stated rules (per this phase's explicit instructions),
    no backend call.
26. WhatsApp template visibility casing (`all` → "All") is a display-only mapping, not a data
    change.
27. **Range tab strips (Today/Y'day/Last 7/Last 30 Days/Select Range) were cosmetic-only across
    several screens in the source** — the state variable only ever drove which tab was
    highlighted, never filtered anything on screen. Flagged by Vivek as looking broken in a live
    demo, so — unlike the other dead interactions in this list — these were fixed rather than
    just documented, using two new mock-layer date-rank helpers:
    `lib/mock/callLogs.ts` exports `dayRank()`/`withinRange()` (relative day labels like
    `"Today"`/`"Yesterday"`/`"27 Aug"` on `callLogsSeed.calledAt`), and `lib/mock/candidates.ts`
    exports `candidateDayRank()`/`withinCandidateRange()` (absolute `"DD Mon YYYY"` on
    `candidatesSeed.createdOn`) plus `callDateRank()` for each candidate's embedded call history
    (`"DD Mon, HH:MM AM/PM"`). Fixed with these: **Dashboard** (Overall/Outbound/Inbound,
    Connected/Not Connected/Personal, Avg/Total Talk Time, Missed Calls, and now also the
    Candidates stage breakdown, Status panel, and the Allocations/Followups Open Actions tiles —
    all previously showing the unfiltered full set regardless of tab); **Interactions** (its
    Today/Last 30 Days/Select Range tab); **Call Logs** (its Today/Last 30 Days/Select Range
    tab); **Allocations** (its Overall/Last 30 Days/Select Range tab); **Rechurn** ("Get Count"
    previously ignored both the status dropdown and the date-range basis entirely — see item 17).
    Where "Select Range" has no real date-picker UI built, it shows everything unfiltered — an
    honest "not narrowed" state rather than a fake bound. **Left alone, deliberately**:
    Analytics' range selectors (item 18) — its numbers are hard-coded chart literals with no
    underlying per-hour data to filter at all, not a wiring bug; real wiring is Phase 5/6 work.
    Checked and already correctly wired (no bug found): Candidates search/status filter,
    Interactions status/search/pagination, Follow-ups Pending/Upcoming, Calendar's status filter.

---

Each item above states which phase it blocks, where relevant. None were silently resolved in
the UI during conversion.
