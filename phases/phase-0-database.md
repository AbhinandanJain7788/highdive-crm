# Phase 0 — Database & Supabase Foundation

## Objective
Build the complete Supabase schema derived from the signed-off UI, alongside the live `calls` table that already exists. Seed it with data matching the UI's own seed arrays so that when Phase 1 converts the HTML, every screen has real records behind it.

## Context
Two things already exist and must be respected: the **HTML UI** (final, signed off — it defines every field this schema needs) and the **live Supabase `calls` table** (populated by the Android app, with `call_direction`/`call_disposition` enums and 6 RLS policies). Nothing else exists.

Read claude.md's Data Schema section in full before starting. Do not invent columns the UI does not show.

## Step 1 — Inspect What Already Exists

### What to do
Before writing any migration, query the live Supabase project and record: every column and type on `calls`, the exact values of the `call_direction` and `call_disposition` enums, and all 6 RLS policies on `calls`. Compare against claude.md's "Existing" schema block. If anything differs, **update claude.md first** — the live database wins.

### Checkpoint 1
- [ ] All 18 `calls` columns confirmed against claude.md, with any difference written back into claude.md
- [ ] Exact enum values for `call_direction` and `call_disposition` recorded in claude.md
- [ ] All 6 existing RLS policies on `calls` documented — Phase 2 will follow their convention
- [ ] Current `calls` row count recorded, to verify later that nothing was destroyed

## Step 2 — Enums & Reference Tables

### What to do
Create every new enum from claude.md: `user_status`, `live_status`, `job_status`, `application_status`, `assign_method`, `assignment_status`, `follow_up_status`, `template_visibility`, `upload_type`, `import_status`, `import_decision`, `date_basis`, `report_status`, `threshold_unit`. Do **not** touch `call_direction` or `call_disposition` — they exist.

`application_status` values come straight from the UI's status badges: `new, contacted, interview_scheduled, interview_done, selected, rejected, not_interested, no_response, joined`.

Then create the reference tables: `processes`, `roles`, `permissions`, `role_permissions`, `pipeline_templates`, `pipeline_stages`.

### Checkpoint 2
- [ ] All 14 new enums created; `call_direction` and `call_disposition` unmodified
- [ ] `application_status` contains exactly the 9 values above, matching the UI's badges
- [ ] `processes` has one row, "Default process", with `is_default = true`
- [ ] `permissions` seeded with the catalogue the Roles screen implies — including at minimum: User Web Panel, Bulk Import, Bulk Export, Play Call Recordings, Show Pop-up (the UI shows 18+ total; seed the full set you define)
- [ ] `roles` seeded with "Admin" and "User" and their `dot_color`/`badge_bg` values from the UI

## Step 3 — Core Tables

### What to do
Create, in dependency order: `users` → `clients` → `jobs` → `candidates` → `applications` → `assignments` → `application_status_history` → `follow_ups` → `notes`. Use uuid PKs for `users` and `candidates` so the live `calls.candidate_id` and `calls.resolved_agent_id` FKs resolve. `users.id` must equal `auth.users.id`.

Apply the two load-bearing constraints: `UNIQUE(candidate_id, job_id)` on `applications`, and the partial unique index on `assignments(application_id) WHERE status='active'`.

Do **not** add `application_id` to `calls` yet — that is Phase 5.

### Checkpoint 3
- [ ] All 9 core tables created with FKs enforced at DB level
- [ ] `users.id` and `candidates.id` are uuid
- [ ] Inserting two `applications` rows with the same candidate+job pair fails with a constraint violation — test it
- [ ] Inserting two `assignments` rows for one application both with `status='active'` fails — test it
- [ ] `calls` row count and structure are unchanged from Step 1

## Step 4 — Supporting Tables & Derived Views

### What to do
Create: `whatsapp_templates`, `import_batches`, `import_rows`, `report_requests`, `notification_settings`, `company_settings`, `activity_logs`.

Then create the three SQL views from claude.md. These are views, **not tables** — the UI derives them by filtering candidates:
- `v_allocations` — bucket `new` = application with no `assigned_recruiter_id`; bucket `attempted` = has recruiter and ≥1 call, excluding terminal statuses (selected, rejected, joined).
- `v_interactions` — candidates with ≥1 call, exposing last interaction time, sourced_by, assigned_by, assign_to.
- `v_rechurn` — candidates filtered by status and date basis, for bulk re-assignment.

### Checkpoint 4
- [ ] All 7 supporting tables created
- [ ] All 3 views exist and return rows; `v_allocations` bucket counts match what the UI's Allocations tabs would show for the seed data
- [ ] No table named `allocations`, `interactions`, or `rechurn` was created

## Step 5 — Seed Data

### What to do
Seed from the UI's own seed arrays so screens look identical to the signed-off HTML:
- **users** — 6–8, covering all roles (Super Admin, Recruitment Manager, Recruiter, HR Executive) and all three statuses (active, invited, inactive), each with `avatar_color` and a `live_status` spread across on_call / idle / on_break / offline.
- **clients** — 4, matching `clientsSeed` (RapidArc Technologies etc.).
- **jobs** — ~14, matching `jobsSeed`, across open / on_hold / closed.
- **candidates + applications** — ~14 matching `candidatesSeed`, covering every one of the 9 statuses, at least one with `is_duplicate = true` (the DUP badge), some with `resume_url` null, some with no assigned recruiter (so Allocations "New" is non-empty).
- **follow_ups** — ~9 matching `followUpsSeed`, split across pending and upcoming, at least one overdue.
- **whatsapp_templates** — 4 matching `waTemplatesSeed`, including full body text.
- **calls** — do **not** bulk-seed; rows already exist. Instead make the seeded `candidates.id` / `users.id` values match the `candidate_id` / `resolved_agent_id` already present in live `calls` rows. Add only these three test rows if absent: one candidate with two active applications (ambiguous attribution for Phase 5), one call with null `b2_url` and null `storage_path`, one call with `callback_due_at` set.

### Checkpoint 5
- [ ] Seed script is idempotent and never deletes or rewrites existing `calls` rows
- [ ] Every one of the 9 `application_status` values appears on at least one seeded application
- [ ] At least one candidate has `is_duplicate = true`
- [ ] At least one application has no `assigned_recruiter_id`, so `v_allocations` bucket `new` is non-empty
- [ ] Every `candidate_id` and `resolved_agent_id` in the live `calls` rows resolves to a seeded record — zero orphans
- [ ] A candidate exists with two active applications, for Phase 5's ambiguous-attribution test

## Step 6 — Environment

### What to do
Create `.env.example` with a comment per variable: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `B2_BUCKET`, `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY` (read-only — recordings are never uploaded by the CRM), `APP_BASE_URL`, `NODE_ENV`. Generate TypeScript types from the schema into `/types`.

### Checkpoint 6
- [ ] `.env.example` covers every variable needed through Phase 7
- [ ] Generated Supabase types compile with zero errors
- [ ] `GET /api/health` returns 200 and confirms a live DB connection

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
5. Only say "Phase 0 Complete" when every checkbox is green.

## Final Phase 0 Checklist
- [ ] Live `calls` table inspected, documented, and verifiably untouched
- [ ] All enums, core tables, supporting tables, and 3 derived views created
- [ ] Seed data mirrors the UI's seed arrays and covers every status and edge case listed
- [ ] Environment configured, types generated, health check passing
- [ ] Self-audit passed with all green
- [ ] Manual verification done by architect
