# Phase 5 — Calls, Interactions & Follow-Ups

## Objective
Connect the live `calls` data from the Android app to the CRM: call logs with recording playback, call-to-job attribution, the Interactions screen, and the full follow-up system including the calendar and recurring follow-ups.

## Context
Phase 4 put candidates in recruiters' hands. Call rows have been landing in Supabase this whole time from the **existing Android app** — that pipeline is built and out of scope. This phase reads it.

**Two open questions from claude.md block parts of this phase and must be answered before starting:**
- **Q1, disposition mismatch.** The live `call_disposition` enum is `interested | callback_later | not_reachable`; the UI shows `Connected | Not Connected | Busy | Switched Off`. Recommended resolution: derive connection state from `duration_seconds > 0` and keep `disposition` as the outcome axis, displaying both. Do not alter the enum without a decision.
- **Q3, recordings.** All `b2_url` and `storage_path` values are currently null. Confirm recordings are flowing before wiring playback.

## Step 1 — Call-to-Job Attribution

### What to do
This is the highest-risk step in the build. `calls` links to `candidate_id` but carries no job, so a call to a candidate with several applications is ambiguous.

Add the nullable `application_id` column to `calls` — **additive only, no existing column altered**. Implement the resolution rule from claude.md: look up that candidate's active assignments; exactly one → link automatically; zero or more than one → leave null and surface it in the unattributed queue. Run it as a trigger or scheduled job so the Android app needs no change.

Wire `GET /api/calls/unattributed` and `POST /api/calls/:id/attribute` to the **Attribute to Job** control the HTML already defines in Call Logs (job select + Link button), including its "No unattributed calls — everything is linked to a job" empty state.

### Checkpoint 1
- [ ] A call for a candidate with exactly one active application auto-links to the correct `application_id`
- [ ] A call for the candidate seeded in Phase 0 with two active applications stays null and appears in the unattributed queue — never guessed
- [ ] A call for a candidate with zero active applications appears in the queue rather than being dropped
- [ ] Manual attribution sets `application_id` and removes the row from the queue
- [ ] The empty state renders when nothing is unattributed
- [ ] No existing `calls` column was altered or dropped — verify structure and row count before and after

## Step 2 — Call Logs & Recording Playback

### What to do
Wire `/call-logs` to `GET /api/calls` and `GET /api/calls/:id`: Outgoing/Incoming type arrow, caller avatar and name, phone, by, called at, duration, disposition, and Play Recording. Use `direction_normalized` and `call_time` — never the raw `direction` or `created_at`. Render Connected / Not Connected per the Q1 decision.

Play Recording streams from `b2_url`; when both `b2_url` and `storage_path` are null, render the disabled no-recording state the HTML defines. Wire `PATCH /api/calls/:id` for **`notes` only** — every other column is owned by the Android pipeline.

Also wire the Call History table on `/candidates/[id]`, left on mocks in Phase 3.

### Checkpoint 2
- [ ] Call logs render real rows ordered by `call_time`, not `created_at`
- [ ] The type arrow direction is driven by `direction_normalized`
- [ ] A call with null `b2_url` and null `storage_path` renders the disabled state, not a broken player
- [ ] Editing notes persists; attempting to write `disposition`, `duration_seconds`, `topic`, or any raw column is impossible through the API
- [ ] Candidate detail Call History shows that candidate's real calls
- [ ] A recruiter sees only their own calls

## Step 3 — Interactions

### What to do
Wire `/interactions` to `GET /api/interactions`, reading the `v_interactions` view: name, phone, status, interacted on, sourced by, assigned by, assign to, with the status filter, date range, and 10/25/50 pagination.

### Checkpoint 3
- [ ] Interactions lists only candidates with at least one call
- [ ] "Interacted on" reflects the most recent `call_time` for that candidate
- [ ] The row count matches a direct query against `v_interactions`
- [ ] Filters and pagination behave as on the other list screens

## Step 4 — Follow-Ups & Calendar

### What to do
Wire `/follow-ups` to `GET/POST /api/follow-ups` and `PATCH /api/follow-ups/:id`, with Pending and Upcoming tabs from `due_at` and `status`. Wire the Schedule Follow-up action on candidate detail.

Wire `/calendar` to `GET /api/follow-ups/calendar`: month grid with per-day counts, side panel listing that day's follow-ups with name, status, assigned by, assign to, and time, plus the "No follow-ups scheduled for this date" empty state.

Wire `/recurring-follow-ups` to `GET/POST /api/follow-ups/recurring` using `is_recurring` and `recurrence_rule`, with the Pending/Upcoming counts, View Schedule, History, and "No Data to display" empty state.

**Before building, resolve claude.md Q4:** `calls.callback_due_at` is already populated by the device on callback dispositions and overlaps with `follow_ups`. Confirm `follow_ups` is authoritative and back-fills from `callback_due_at`. Do not ship two competing follow-up systems.

### Checkpoint 4
- [ ] Pending shows overdue and due-today; Upcoming shows future — counts match direct queries
- [ ] Scheduling from candidate detail creates a `follow_ups` row visible on both the list and the calendar
- [ ] Calendar day counts match the follow-ups due that day, and clicking a date populates the side panel
- [ ] Completing a follow-up moves it out of Pending and sets `completed_at`
- [ ] `callback_due_at` values appear as follow-ups under the agreed Q4 rule, with no duplicate entries
- [ ] All three empty states render exactly as in the HTML

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
5. Only say "Phase 5 Complete" when every checkbox is green.

## Final Phase 5 Checklist
- [ ] Call attribution working, with ambiguous cases queued for humans rather than guessed
- [ ] Call logs and recording playback live, with the live `calls` table verifiably unaltered
- [ ] Interactions screen live off `v_interactions`
- [ ] Follow-ups, calendar, and recurring follow-ups live with the `callback_due_at` overlap resolved
- [ ] Self-audit passed with all green
- [ ] Manual verification done by architect
