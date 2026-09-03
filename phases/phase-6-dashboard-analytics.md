# Phase 6 — Dashboard, Analytics & Reports

## Objective
Wire every aggregate screen to real data: the Dashboard, the Analytics module with its charts, the Reports screen, Request Reports, and Rechurn. Built after Phases 3–5 deliberately — these screens aggregate what those phases produce, so building them earlier would mean charting fake numbers.

## Context
Phases 3–5 produced candidates, applications, assignments, calls, and follow-ups. Everything here reads from them. Per claude.md, every call metric uses `call_time`, never `created_at`.

**Blocked on claude.md Q2:** the UI has an "AI Score" column in Call Logs and an "AI Call Analytics" tab in Analytics, both stubbed. AI is out of scope. Confirm with Vivek whether to remove them or keep them as permanently-disabled placeholders — then implement that decision consistently in both places.

## Step 1 — Dashboard

### What to do
Wire `/dashboard` to `GET /api/dashboard`, honouring the Today / Y'day / Last 7 Days / Last 30 Days tabs:
- Overall / Outbound / Inbound call totals from `direction_normalized`
- Connected / Not Connected / Personal with counts and percentages, per the Q1 rule from Phase 5
- Avg Talk Time and Total Talk Time from `duration_seconds`
- Open Actions: unassigned count, pending follow-ups, missed calls
- Total Candidates with the status bucket breakdown and percentages

Recruiters see their own numbers; managers see org-wide.

### Checkpoint 1
- [ ] Every tile matches a direct DB query for the selected date range
- [ ] Switching between all four date tabs changes the numbers correctly
- [ ] Percentages sum correctly and never divide by zero on an empty range
- [ ] Avg and Total Talk Time render in the HTML's existing format
- [ ] Open Actions counts match the Allocations, Follow-Ups, and Call Logs screens exactly
- [ ] A recruiter's dashboard shows only their own activity

## Step 2 — Analytics

### What to do
Wire `/analytics` Overall tab to `GET /api/analytics/overall`, `GET /api/analytics/login`, `GET /api/analytics/top-users`:
- Call Trends chart (Outbound / Inbound / Total Calls)
- Total Talk time chart including the average reference line
- Login Analytics with login duration ranges
- Top 5 User Performances (agent name, total calls, inbound calls)
- Customer Stages with per-stage counts and percentages
- Conversion Funnel
- Customers By (Select Field) with its "No data to display" empty state

Keep the User Performance tab as the "coming soon" placeholder the HTML defines. Handle the AI Call Analytics tab per the Q2 decision.

### Checkpoint 2
- [ ] Call Trends totals match `GET /api/calls` for the same range
- [ ] The average reference line on the talk-time chart is computed, not hardcoded
- [ ] Top 5 User Performances is ordered correctly and shows exactly five rows, or fewer if fewer users have calls
- [ ] Customer Stages percentages match the pipeline stage distribution
- [ ] Conversion Funnel stages are read from `pipeline_stages`, never hardcoded
- [ ] "Customers By" renders its empty state when no field is selected
- [ ] The Q2 decision is implemented identically in Analytics and Call Logs

## Step 3 — Reports

### What to do
Wire `/reports` to `GET /api/reports`: Pipeline Funnel, Call Outcomes (counts per disposition), and Calls by Recruiter (total, connected, avg duration). Exclude soft-deleted records per claude.md. Calls with a null `application_id` must be excluded from per-job breakdowns or clearly labelled unattributed — they must never silently skew job numbers.

### Checkpoint 3
- [ ] All three report sections match direct DB queries
- [ ] Soft-deleted candidates are excluded
- [ ] Unattributed calls do not distort any per-job figure
- [ ] Avg duration excludes zero-duration calls, or states that it includes them

## Step 4 — Request Reports & Rechurn

### What to do
Wire `/request-reports` to `POST /api/report-requests` and `GET /api/report-requests`: Basic tab with report type selection, date and time range with AM/PM, and the Created Date / Last Interaction date basis. Generate asynchronously via Edge Function or pg_cron, set `status` to queued → ready → failed, and expose the file when ready. Keep the Advanced tab as its "coming soon" placeholder.

Wire `/rechurn` to `POST /api/rechurn/count` and `POST /api/rechurn/initiate`, reading `v_rechurn`: filters, Get Count showing Matched Customers, then either Assign in Common Pool or Change owner to Specific Users. Assigning to the common pool clears `assigned_recruiter_id` so those candidates reappear in the Allocations New bucket.

### Checkpoint 4
- [ ] Requesting a report creates a `report_requests` row with `status='queued'` and reaches `ready` with a downloadable file
- [ ] Created Date vs Last Interaction produce genuinely different result sets
- [ ] Get Count returns a number matching a direct query against `v_rechurn`
- [ ] Assign in Common Pool clears the recruiter, and those candidates appear in Allocations New
- [ ] Change owner to Specific Users creates new active `assignments` rows and closes the old ones
- [ ] Bulk import permission is required for the common pool action, as the HTML states

---

## Self-Audit Instruction
Before declaring this phase complete, you must:
1. Re-read every checkpoint in this phase file
2. Test each one: call the route, check the DB record, render the component with real data
3. Return a structured report:
   ✅ [Checkpoint] — Pass
   ⚠️ [Checkpoint] — Partial: [specific reason]
   ❌ [Checkpoint] — Fail: [specific reason]
4. Fix all failures and partials before reporting phase complete.
5. Only say "Phase 6 Complete" when every checkbox is green.

## Final Phase 6 Checklist
- [ ] Dashboard live across all four date ranges with correct role scoping
- [ ] Analytics charts computed from real data, with the AI question resolved consistently
- [ ] Reports accurate, with unattributed calls handled explicitly
- [ ] Request Reports generating asynchronously and Rechurn reassigning correctly
- [ ] Self-audit passed with all green
- [ ] Manual verification done by architect
