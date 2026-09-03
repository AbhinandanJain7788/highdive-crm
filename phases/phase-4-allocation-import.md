# Phase 4 — Allocations, Assignment & Import

## Objective
Wire the operational core: the Allocations screen, the assignment and distribution engine, the CSV import flow with duplicate review, and the bulk Data Management tools.

## Context
Phase 3 made candidates, jobs, and clients real. Phase 0 created `assignments`, `import_batches`, `import_rows` and the `v_allocations` view. This phase is where candidates actually reach recruiters.

`v_allocations` already encodes the bucket logic — query the view, do not reimplement the filter in application code.

## Step 1 — Allocations Screen

### What to do
Wire `/allocations` to `GET /api/allocations`, reading `v_allocations` with `bucket=new|attempted`. Render the table exactly as the HTML defines: avatar, name, phone, allocation status, created on, created by, assign to, sourced by, plus the filters (Search Phone/Name, date range, By Status, Selected Users) and the New / Attempted tab counts.

### Checkpoint 1
- [ ] New tab shows only applications with no `assigned_recruiter_id`
- [ ] Attempted tab shows only applications with a recruiter and at least one call, excluding selected / rejected / joined
- [ ] Tab counts match direct queries against `v_allocations`
- [ ] All four filters narrow results correctly and combine with each other
- [ ] No bucket logic is duplicated in TypeScript — the view is the only definition

## Step 2 — Assignment & Distribution

### What to do
Wire `/assignment`. Implement `POST /api/assignment/auto-distribute` with both `round_robin` and `load_balanced` methods, `POST /api/assignment/manual`, `POST /api/assignment/reassign`, and `GET /api/assignment/workload` for the Recruiter Workload bars.

Every write must respect the partial unique index from Phase 0: exactly one active assignment per application. Reassignment sets the old row to `status='reassigned'` and inserts a new active row — it never updates in place, so assignment history survives.

### Checkpoint 2
- [ ] Round robin distributes evenly across active recruiters
- [ ] Load balanced assigns fewest-first based on current active assignment counts
- [ ] Two concurrent auto-distribute requests against the same pool never double-assign an application — test with genuinely concurrent requests, not sequential ones
- [ ] Reassigning produces two `assignments` rows with exactly one `status='active'`
- [ ] "Distribute Selected (n)" assigns exactly the checked rows and no others
- [ ] Recruiter Workload bars match live active assignment counts
- [ ] Inactive recruiters are excluded from auto-distribution

## Step 3 — CSV Import & Duplicate Review

### What to do
Wire `/import` end to end: `POST /api/import/upload` creates an `import_batch` and parses rows into `import_rows`; `GET /api/import/:id/duplicates` returns rows whose phone or email matches an existing candidate; `POST /api/import/:id/decide` records Skip Duplicate or Import Anyway per row; `POST /api/import/:id/confirm` commits and returns the Import Complete count.

Duplicates are **flagged for review, never auto-merged**. A row imported anyway sets `is_duplicate = true` so the DUP badge shows in Phase 3's candidate list.

### Checkpoint 3
- [ ] Uploading a CSV creates an `import_batch` with correct `total_rows`
- [ ] A row matching an existing phone appears in the review step with both sides rendered
- [ ] A row matching phone but with a different name is still flagged for review, not auto-merged
- [ ] Skip Duplicate excludes the row from the final import; Import Anyway creates a candidate with `is_duplicate = true`
- [ ] Import Complete shows a count matching the rows actually created
- [ ] Importing a 500-row CSV completes without timeout and drops no rows silently

## Step 4 — Data Management

### What to do
Wire `/data-management`: the two-step Configure Upload → Upload Data flow with process selection and upload type (Allocations max 20k / Customers max 20k), plus `POST /api/data/bulk-export`, `POST /api/data/bulk-delete`, and `POST /api/data/transfer`. Bulk delete is soft-delete only, per claude.md. Data Transfer moves candidate ownership between users.

Keep any tab the HTML marks "coming soon" as a placeholder — do not implement it.

### Checkpoint 4
- [ ] Upload type enforces the 20k row cap with a clear error rather than a partial import
- [ ] Bulk export produces a file whose row count matches the applied filters
- [ ] Bulk delete soft-deletes and the records disappear from list screens but remain in the DB
- [ ] Data transfer reassigns ownership and writes an `activity_logs` entry
- [ ] Tabs marked "coming soon" in the HTML remain placeholders

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
5. Only say "Phase 4 Complete" when every checkbox is green.

## Final Phase 4 Checklist
- [ ] Allocations screen live off `v_allocations` with working buckets and filters
- [ ] Distribution engine working in both modes and proven concurrency-safe
- [ ] Import flow complete through all four steps with duplicate review
- [ ] Data Management bulk tools live with soft-delete and activity logging
- [ ] Self-audit passed with all green
- [ ] Manual verification done by architect
