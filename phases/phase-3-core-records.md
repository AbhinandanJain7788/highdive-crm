# Phase 3 — Core Records: Candidates, Jobs, Clients

## Objective
Wire the recruitment backbone to Supabase: candidates (aka Customers), jobs with their pipeline breakdown, clients, and the recruiter directory. After this phase the main entity screens run on real data instead of mocks.

## Context
Phase 2 established the Supabase client pattern, the `requirePermission` guard, and RLS. Every query in this phase goes through them. Phase 0 seeded `candidates`, `applications`, `jobs`, `clients`, `pipeline_templates`, `pipeline_stages`.

Remember from claude.md: **candidate ≠ application**. Status, pipeline stage, and recruiter assignment live on `applications`. The list screens read a candidate joined to their application(s).

## Step 1 — Candidates / Customers

### What to do
Wire `/candidates` to `GET/POST /api/candidates`: avatar initial, name, phone, DUP badge (from `candidates.is_duplicate`), status (from `applications.status`), assigned recruiter, created on, and source. Implement search on name and phone via the topbar, pagination with the UI's 10/25/50 page sizes, and the status filter chips.

Wire `/candidates/[id]` to `GET/PATCH /api/candidates/:id`: header block, Assigned Recruiter, Applied For, Source, Resume (render the "no resume" state when `resume_url` is null), Notes, and Schedule Follow-up. Leave the Call History table on mock data — it is wired in Phase 5.

Recruiters must see only their own candidates; this comes from RLS plus the guard, not a client-side filter.

### Checkpoint 1
- [ ] Candidates list renders real rows with correct status badges for all 9 `application_status` values
- [ ] The DUP badge appears only for candidates with `is_duplicate = true`
- [ ] Searching a partial phone number and a partial name both return correct results
- [ ] Page size 10/25/50 changes the result set and the total count stays accurate
- [ ] Signed in as a recruiter, the list shows only their assigned candidates — verified against a direct DB query
- [ ] Candidate detail renders the "no resume" state for a candidate with null `resume_url`

## Step 2 — Jobs & Pipeline Breakdown

### What to do
Wire `/jobs` to `GET/POST /api/jobs` (title, client, status, openings, applications count, created on) and `/jobs/[id]` to `GET/PATCH /api/jobs/:id`. The detail page's **Pipeline Breakdown** must come from that job's own `pipeline_template_id` and count applications per `pipeline_stage_id` — never a hardcoded stage list. "Candidates in this Job" lists applications with their recruiter.

Implement `POST /api/jobs/:id/close` to set `status='closed'`.

### Checkpoint 2
- [ ] Applications count per job matches a direct count on `applications`
- [ ] Pipeline Breakdown renders the stages of that job's assigned template, in `sequence_order`
- [ ] Two jobs using different pipeline templates show different stage lists — verify with the two templates seeded in Phase 0
- [ ] Closing a job sets `status='closed'` and the list reflects it immediately
- [ ] No pipeline stage name is hardcoded anywhere in the codebase

## Step 3 — Clients

### What to do
Wire `/clients` to `GET/POST /api/clients` (company, contact, industry, active jobs count, account manager) and `/clients/[id]` to `GET/PATCH /api/clients/:id` with the contact block and "Jobs with this Client". Active jobs count must count only `status='open'`.

### Checkpoint 3
- [ ] Active jobs count excludes on_hold and closed jobs
- [ ] Account manager resolves to a real `users` record
- [ ] Client detail lists exactly that client's jobs, with correct statuses

## Step 4 — Recruiters Directory

### What to do
Wire `/recruiters` and `/recruiters/[id]`. The list shows live status, assigned count, calls today, and conversion %. Compute: **assigned** = active assignments for that recruiter; **conversion** = applications reaching a terminal positive status (selected, joined) ÷ total assigned. Leave "calls today", "avg talk time", and "Recent Call Activity" on mock data — call metrics are wired in Phase 5.

### Checkpoint 4
- [ ] Assigned count matches active rows in `assignments` for that recruiter
- [ ] Conversion % matches a direct query and never divides by zero for a recruiter with no assignments
- [ ] Recruiter detail lists that recruiter's real assigned candidates
- [ ] Every metric still on mock data is clearly marked with a TODO referencing Phase 5

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
5. Only say "Phase 3 Complete" when every checkbox is green.

## Final Phase 3 Checklist
- [ ] Candidates list and detail live, with search, pagination, filters, and recruiter scoping
- [ ] Jobs live with template-driven pipeline breakdown, no hardcoded stages
- [ ] Clients live with correct active job counts
- [ ] Recruiters directory live for assignment and conversion metrics
- [ ] Self-audit passed with all green
- [ ] Manual verification done by architect
