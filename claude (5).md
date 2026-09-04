# claude.md — Project Constitution

> **Source of truth: `Recruitment_CRM__standalone__.html`.** The UI is built, signed off, and final. This file was derived *from* it. If this file and the UI ever disagree, the UI wins — update this file, not the UI.
>
> Second source of truth: the **live Supabase `calls` table**, which already holds real data from the existing Android calling app. Its columns are fixed and listed verbatim below.

## Project Overview
"High Dive" — a recruitment CRM and calling-operations platform. Recruitment agency takes hiring requirements from client companies, sources candidates, distributes them to calling agents, and tracks every call, follow-up, and pipeline movement in one place. The UX is a Runo.ai clone adapted to recruitment.

**User types (roles are data, not hardcoded — see `roles`/`permissions`):**
- **Super Admin** — everything, including billing, API config, roles & permissions.
- **Recruitment Manager / Admin** — jobs, clients, candidates, allocation & distribution, team, reports, data management.
- **Recruiter / HR Executive** — own allocated candidates, calling, interactions, follow-ups, own analytics.

## Architecture

**Stack:** Next.js (App Router, TypeScript) · **Supabase** (Postgres + Auth + RLS + Storage) · Backblaze B2 for call recordings (read-only — populated by the Android app) · Recharts for the analytics charts · pg_cron / Supabase Edge Functions for scheduled work.

**Build order (non-negotiable):** Database (Phase 0) → HTML converted to Next.js (Phase 1) → Supabase wired module by module (Phases 2–7).

**The Android calling app is already built and out of scope.** It writes rows into `calls` directly. The CRM only ever *reads* `calls` — plus two CRM-owned fields (`notes`, `application_id`). Never build call ingestion, recording upload, or any Android integration.

**Folder structure:**
```
/app                      Next.js App Router
  /(auth)/login
  /(app)/dashboard | allocations | customers | interactions | follow-ups
         calendar | call-logs | recurring-follow-ups | request-reports
         rechurn | team-live-status | analytics | whatsapp-templates
         notifications | data-management | team | roles-permissions | settings
         candidates | jobs | clients | recruiters | assignment | import | reports
  /api/...                route handlers
/components               shared UI extracted from the HTML
/lib/supabase             client, server, RLS-aware helpers
/lib/queries              one file per module
/types                    generated Supabase types
```

**Key decisions & why:**
- **Allocations, Interactions, and Rechurn are derived views, not tables.** The UI computes them by filtering candidates (`Allocations` = no recruiter assigned; `Attempted` = has recruiter + ≥1 call; `Interactions` = has ≥1 call). Implement as SQL views or query filters. Do not create tables for them.
- **Roles are granular, not enums.** The UI's Roles & Permissions screen shows named roles with permission lists ("User Web Panel, Bulk Import, Bulk Export", +15 more). Requires `roles` / `permissions` / `role_permissions`, not a role string column.
- **`Process` is a real entity** (Runo concept — "Default process"). Users belong to a process; uploads and templates are scoped by it. Ship with one default process; do not hardcode it.
- **Candidate ≠ Application.** A candidate is a person; an application is that person against one job. Status, pipeline stage, and recruiter assignment live on `applications`. The UI's candidate list shows one job per row because each seed candidate has exactly one — the schema must still support many.
- **"Customers" and "Candidates" are the same entity.** The Runo-derived screens say Customers; the recruitment screens say Candidates. One table (`candidates`), two labels in the UI. Do not build both.
- UUID PKs for `candidates` and `users` to match the uuid FKs the live `calls` table already points at.

## Data Schema

### Existing — DO NOT create, drop, or alter destructively
```
calls   id(int8 PK) · agent_id(text, raw device id e.g. asha@41agency.test) · call_record_id(text, device call id / dedup key)
        number(text, raw) · direction(text, raw: outgoing|incoming) · duration_seconds(int4) · topic(text, raw outcome)
        notes(text) · recording_url(text) · created_at(timestamptz, row insert)
        candidate_id(uuid→candidates) · resolved_agent_id(uuid→users)
        direction_normalized(enum call_direction: outbound|inbound)
        disposition(enum call_disposition: interested|callback_later|not_reachable)
        callback_due_at(timestamptz) · call_time(timestamptz — USE THIS for all reporting, not created_at)
        storage_path(text) · b2_url(text)
        + ADDITIVE ONLY: application_id(uuid→applications, nullable) — added in Phase 5
EXISTING ENUMS — reuse, never redefine: call_direction, call_disposition
```

### New tables
```
processes            id(uuid) · name · is_default(bool) · created_at
roles                id(uuid) · name · dot_color · badge_bg · is_system(bool) · created_at
permissions          id(uuid) · key(unique) · label · category
role_permissions     role_id→roles · permission_id→permissions   [PK both]
users                id(uuid, = auth.users.id) · name · email(unique) · phone · role_id→roles
                     process_id→processes · reports_to→users(nullable) · status(enum user_status: active|invited|inactive)
                     live_status(enum live_status: on_call|idle|on_break|offline) · live_status_since(timestamptz)
                     avatar_color · add_ons(text) · joined_on(date) · created_at
clients              id(uuid) · company · contact_name · email · phone · industry
                     account_manager_id→users · created_at
pipeline_templates   id(uuid) · name · is_default(bool) · created_at
pipeline_stages      id(uuid) · pipeline_template_id→pipeline_templates · name · sequence_order · is_terminal(bool)
jobs                 id(uuid) · client_id→clients · title · status(enum job_status: open|on_hold|closed)
                     openings(int) · pipeline_template_id→pipeline_templates · created_by→users · created_at
candidates           id(uuid) · name · phone · email(nullable) · source(text: Naukri|LinkedIn|Indeed|Apna|Referral|CSV Import|…)
                     resume_url(nullable) · notes(text) · is_duplicate(bool, the DUP badge) · duplicate_of→candidates(nullable)
                     process_id→processes · created_by→users · created_at
                     deleted_at(nullable, soft-delete marker — migration 0029, Phase 4)
applications         id(uuid) · candidate_id→candidates · job_id→jobs · pipeline_stage_id→pipeline_stages
                     status(enum application_status: new|contacted|interview_scheduled|interview_done|
                            selected|rejected|not_interested|no_response|joined)
                     assigned_recruiter_id→users(nullable) · created_at   [UNIQUE candidate_id+job_id]
assignments          id(uuid) · application_id→applications · recruiter_id→users · assigned_by→users(nullable)
                     method(enum assign_method: round_robin|load_balanced|manual) · assigned_at · unassigned_at(nullable)
                     status(enum assignment_status: active|reassigned)   [PARTIAL UNIQUE application_id WHERE status='active']
application_status_history  id(uuid) · application_id→applications · from_status · to_status · changed_by→users · changed_at · note
follow_ups           id(uuid) · application_id→applications · candidate_id→candidates · due_at(timestamptz)
                     assigned_by→users · assign_to→users · is_recurring(bool) · recurrence_rule(text, nullable)
                     status(enum follow_up_status: pending|completed|cancelled) · note · created_at · completed_at
notes                id(uuid) · application_id→applications · author_id→users · body · created_at
whatsapp_templates   id(uuid) · name · visibility(enum template_visibility: all|process|private)
                     process_id→processes(nullable) · full_text · created_by→users · created_at
import_batches       id(uuid) · filename · upload_type(enum upload_type: allocations|customers)
                     process_id→processes · uploaded_by→users · total_rows · imported_rows · skipped_rows
                     status(enum import_status: uploading|validating|review|completed|failed) · created_at
import_rows          id(uuid) · import_batch_id→import_batches · raw(jsonb) · matched_candidate_id→candidates(nullable)
                     decision(enum import_decision: pending|skip|import_anyway) · created_at
report_requests      id(uuid) · report_type · date_from · date_to · date_basis(enum date_basis: created_date|last_interaction)
                     requested_by→users · status(enum report_status: queued|ready|failed) · file_url(nullable) · created_at
notification_settings id(uuid) · user_id→users(nullable, null = org default) · key(text) · enabled(bool)
                      threshold_value(int, nullable) · threshold_unit(enum threshold_unit: hours|minutes, nullable)
company_settings     id(uuid) · key(unique) · value(jsonb) · updated_by→users · updated_at
activity_logs        id(uuid) · actor_id→users · action · entity_type · entity_id · metadata(jsonb) · created_at
```

### Derived views (create as SQL views)
```
v_allocations   candidates + application + assigned recruiter, bucketed: 'new' (no recruiter) | 'attempted' (recruiter + ≥1 call)
v_interactions  candidates having ≥1 call, with last interaction time, sourced_by, assigned_by, assign_to
v_rechurn       candidates matching a filter set, for bulk re-assignment into the common pool
```

## API Structure

```
AUTH (Supabase Auth — do not hand-roll)
POST /api/auth/login                    sign in                                         public
POST /api/auth/logout                   sign out                                        any
GET  /api/auth/me                       profile + role + resolved permissions           any

DASHBOARD & ANALYTICS
GET  /api/dashboard                     call tabs, open actions, candidate buckets      any (scoped)
GET  /api/analytics/overall             call trends, talk time, stages, funnel          view_analytics (any (scoped) — see Phase 2 sidebar mapping)
GET  /api/analytics/login               login duration analytics                        view_analytics (any (scoped))
GET  /api/analytics/top-users           top 5 user performances                         view_analytics (any (scoped))

CANDIDATES  (aka Customers)
GET/POST  /api/candidates               list (filter/search/paginate) / create          any (recruiter: own)
GET/PATCH /api/candidates/:id           detail / update                                 any (recruiter: own)
GET       /api/candidates/:id/calls     call history for candidate                      any (recruiter: own)

JOBS
GET/POST  /api/jobs                     list / create                                   manager+
GET/PATCH /api/jobs/:id                 detail incl. pipeline breakdown                 any
POST      /api/jobs/:id/close           close job                                       manager+

CLIENTS
GET/POST  /api/clients                  list / create                                   manager+
GET/PATCH /api/clients/:id              detail incl. jobs with this client              manager+

RECRUITERS  (added Phase 3 — not in the original table)
GET       /api/recruiters              directory with assignment/conversion metrics     view_all_records
GET       /api/recruiters/:id          one recruiter incl. real assigned candidates     self, or view_all_records

APPLICATIONS
GET/POST  /api/applications             list / create                                   manager+
PATCH     /api/applications/:id         update status / stage                           any (recruiter: own)

ALLOCATIONS & ASSIGNMENT
GET  /api/allocations                   v_allocations, bucket=new|attempted             manager+
POST /api/assignment/auto-distribute    round_robin | load_balanced                     manager+
POST /api/assignment/manual             assign selected to a recruiter                  manager+
POST /api/assignment/reassign           reassign                                        manager+
GET  /api/assignment/workload           recruiter workload bars                         manager+

IMPORT & DATA MANAGEMENT
POST /api/import/upload                 CSV upload, creates import_batch                manager+
GET  /api/import/:id/duplicates         rows needing dedup review                       manager+
POST /api/import/:id/decide             skip / import-anyway per row                    manager+
POST /api/import/:id/confirm            finalize import                                 manager+
POST /api/data/bulk-export              bulk export                                     manager+
POST /api/data/bulk-delete              bulk delete                                     admin
POST /api/data/transfer                 transfer ownership between users                admin

CALLS  (READ-MOSTLY — rows are created by the Android app, never by the CRM)
GET   /api/calls                        call logs, filterable                           any (recruiter: own)
GET   /api/calls/:id                    detail incl. b2_url for playback                any (recruiter: own)
PATCH /api/calls/:id                    CRM-owned fields ONLY: notes, application_id     any (recruiter: own)
GET   /api/calls/unattributed           calls with null application_id                  manager+
POST  /api/calls/:id/attribute          link call to a job/application                  any (recruiter: own)
GET   /api/interactions                 v_interactions                                  any (scoped)

FOLLOW-UPS
GET/POST  /api/follow-ups               list (pending|upcoming) / schedule              any (scoped)
PATCH     /api/follow-ups/:id           complete / cancel / reassign                    any (scoped)
GET       /api/follow-ups/calendar      month grid + per-day events                     any (scoped)
GET/POST  /api/follow-ups/recurring     recurring follow-ups                            any (scoped)

RECHURN & REPORTS
POST /api/rechurn/count                 matched customers count for filters             manager+
POST /api/rechurn/initiate              assign to common pool / specific users          manager+
GET  /api/reports                       pipeline funnel, call outcomes, by recruiter    manager+
POST /api/report-requests               request a basic/advanced report                 manager+
GET  /api/report-requests               list requested reports + history                manager+

TEAM, ROLES & LIVE STATUS
GET/POST  /api/team                     list (active|inactive|invited) / add user       GET: any (RLS read-all on users) · POST: manage_team
PATCH     /api/team/:id                 update user                                     admin
GET       /api/team/live-status         live status board                               any (see Phase 2 notes)
PATCH     /api/users/me/live-status     set own status                                  any
GET/POST  /api/roles                    list / create role                              GET: any · POST: manage_roles_permissions
GET/PATCH /api/roles/:id                role detail / edit permissions                  GET: any · PATCH: manage_roles_permissions
GET       /api/permissions              full permission catalogue                       admin

TEMPLATES, NOTIFICATIONS & SETTINGS
GET/POST   /api/whatsapp-templates      list / create                                   any
PATCH/DELETE /api/whatsapp-templates/:id edit / duplicate / delete                      manager+
GET/PATCH  /api/notification-settings   user status + allocation assignment alerts      admin
GET/PATCH  /api/settings/general        limit assign-to, WhatsApp notifs, logout rules  admin
POST       /api/settings/password       reset own password                              any
GET/PATCH  /api/settings/company        company details                                 admin
GET        /api/settings/activity-logs  activity log                                    admin

SYSTEM
GET /api/health                         liveness + DB check                             public
```

## Business Logic Rules (never break these)

- **The CRM writes to `calls` only for `notes` and `application_id`.** Every other column belongs to the Android pipeline. Read-only.
- **Call attribution:** a call has `candidate_id` but no job. Resolve `application_id` from that candidate's active assignments — exactly one → auto-link; zero or many → leave null and surface in the unattributed queue. Never guess.
- Use `call_time` for every metric, chart, and report. `created_at` is row-insert time and lags the real call.
- **Connected vs Not Connected is derived from `duration_seconds > 0`**, not from `disposition`. The live `call_disposition` enum (interested / callback_later / not_reachable) is an *outcome* vocabulary; the UI's Connected / Not Connected / Busy / Switched Off is a *connection-state* vocabulary. They are different axes — see Open Questions.
- A call with null `b2_url` **and** null `storage_path` has no recording: render the disabled "no recording" state the UI already defines.
- One active assignment per application, enforced by the partial unique index — never worked around in app code.
- One application per candidate+job pair, enforced by unique constraint.
- Permissions are resolved from `role_permissions` at request time. Never hardcode a role name in a permission check.
- Never hard-delete candidates, applications, or calls. Status/flag only.
- Recruiters see only candidates/applications/calls/follow-ups tied to an assignment they hold or held — enforced in RLS *and* the route guard.

## Conventions

- DB `snake_case`; API routes kebab-case plural; components `PascalCase`; vars/hooks `camelCase`.
- Every list endpoint supports `search`, `page`, `pageSize` (UI offers 10/25/50) and returns `{data, total}`.
- Date ranges use the UI's presets: Today, Y'day, Last 7 Days, Last 30 Days, plus custom range.
- Errors: `{error:{code,message}}` with correct HTTP status; log server-side, never swallow.
- Brand colors from the HTML: primary `#FF5C35`, app/page background `#F4F5F8`, card background `#FFFFFF`, card border `#E7E9EE` (corrected during Phase 1 conversion — the actual signed-off HTML uses `#F4F5F8`, not `#FFF5F2` as originally written here; the UI wins per this file's own rule). Do not restyle.
- **DO NOT:** modify or integrate with the Android app · create call rows or upload recordings · write to raw `calls` columns · redefine `call_direction`/`call_disposition` · create tables for Allocations/Interactions/Rechurn · hardcode role names or pipeline stages · redesign any screen that exists in the HTML.

## Phase 0 — As-Built Notes (read before Phase 2 or Phase 3)

Phase 0 was built against a fresh Supabase project (`recruitment-crm`, ap-south-1) that
turned out to already contain an unrelated, previously-built schema (granular
`user_role` enum instead of roles/permissions tables, no `processes`, different enum
values, `calls.application_id` already present). Per explicit sign-off, that schema and
its seed data (798 calls, 406 candidates, etc.) were **dropped and rebuilt from scratch**
to match this file exactly. Decisions made during that rebuild, where the signed-off HTML
was ambiguous or silent:

- **Roles are exactly 2: Admin and User** (`dot_color`/`badge_bg` taken verbatim from the
  HTML's `rolesSeed`). The Team screen's three labels (Super Admin, Recruitment Manager,
  Recruiter) are **not** separate roles — they're display-only; those users are seeded
  with role `Admin` (Super Admin, Recruitment Manager) or `User` (Recruiter). Per your
  explicit instruction: "only admin and user, nothing else."
- **Permissions catalogue (18 keys)** was authored by Claude, not extracted from the HTML
  — the HTML only ever shows 5 permission labels as decorative text on the Roles screen,
  with no real backing array (confirmed by direct extraction). claude.md's Phase 0 Step 2
  explicitly delegates this ("seed the full set you define").
- **Only 1 pipeline template exists** ("Default Pipeline", the HTML's 8-stage
  `defaultPipelineStages` verbatim), per your decision to stay literal to the HTML. **This
  leaves Phase 3's checkpoint "two jobs using different pipeline templates show different
  stage lists — verify with the two templates seeded in Phase 0" unsatisfiable as written.**
  Revisit that checkpoint when Phase 3 starts.
  **RESOLVED in Phase 3** (see its As-Built Notes): a second template, "Bulk Hiring
  Pipeline" (5 stages), was seeded and assigned to 3 jobs, making the checkpoint genuinely
  testable — confirmed again live during Phase 8's reconciliation pass (2026-09-04):
  `pipeline_templates` has exactly 2 rows and every `pipeline_stages` row resolves to one
  of them; Default Pipeline's 8 stages and Bulk Hiring's 5 still render as disjoint lists
  for two real jobs on `/jobs/:id`.
- **Users are one canonical set of 9**: the 8 people from `usersSeed` (Rakshit Verma,
  Devika Kulkarni, Ayesha Khan, Rohan Deshmukh, Kavya Menon, Suresh Pillai, Anjali Bhatt,
  Tanvi Shah) plus one synthetic user, **Meera Nair** (`status='inactive'`), added only
  because `usersSeed` never demonstrates the inactive state and Phase 0's own checklist
  requires covering all three `user_status` values. The disconnected placeholder casts
  used by `teamRowsSeed`/`teamLiveSeed`/`followUpsSeed` in the HTML (different names on
  every screen, per your confirmation) were **not** seeded as separate people — when
  Phase 1 rebuilds those screens' mocks, wire them to this same 9-person set.
- **Dev login credentials**: every seeded user has a real `auth.users` row.
  Password for all: `Highdive@123`. Only `active`-status users have a confirmed email
  (can log in today); `invited`/`inactive` users exist but can't sign in yet — matches
  their status. Rotate before any real deployment.
- **Known pitfall, fixed**: inserting `auth.users` rows via direct SQL (as this
  migration did) leaves `confirmation_token`, `recovery_token`,
  `email_change_token_new`, `email_change_token_current`, `email_change`,
  `phone_change`, and `phone_change_token` as `NULL` unless set explicitly.
  GoTrue scans these into non-nullable Go strings, so any `NULL` among them
  causes **every** password login project-wide to fail with a generic
  `500 "Database error querying schema"` — the real error
  (`sql: Scan error on column ... converting NULL to string is unsupported`)
  only appears in Supabase's `auth_logs`, not in the client-facing response
  or `auth.audit_log_entries`. Fixed in migration `0020_fix_auth_users_null_tokens`
  (coalesces all of the above to `''`). If any future migration inserts into
  `auth.users` directly, set these columns to `''` explicitly, or use
  `supabase.auth.admin.createUser()` instead, which does this correctly.
- **`sourced_by` and `created_by`** (Allocations screen) and **`sourced_by`**
  (Interactions view) all read from `candidates.created_by` — the schema has only one
  such user-reference column, and no seed data suggested these were ever meant to differ.
- Ananya Sharma was given a **second application** (Backend Engineer, on top of her one
  HTML-defined job) specifically to satisfy Phase 0 Step 5's requirement for a candidate
  with two active applications, for Phase 5's ambiguous-attribution test.
- `pipeline_stage_id` on `applications` is inferred from `application_status` where the
  two vocabularies don't line up 1:1 (`rejected`→Screening stage, `not_interested`/
  `no_response`→Contacted stage) — an internal linkage choice, not shown anywhere in the UI.
- **RLS is intentionally disabled on every new table** (Supabase advisors will flag this
  as critical) — per claude.md's own phase boundaries, Phase 2 designs and enables it
  holistically. The 3 derived views were explicitly set `security_invoker = true` so they
  respect RLS once Phase 2 turns it on, instead of silently bypassing it as views do by
  default.
- `/api/health` (Phase 0 Step 6 checkpoint) doesn't exist yet since no Next.js project
  exists until Phase 1 — DB connectivity was instead verified directly via the Supabase
  connector throughout. Add the actual route as part of Phase 1's scaffold.

## Phase 2 — As-Built Notes (read before Phase 3)

- **Auth bug found and fixed before Phase 2 could even be tested**: Phase 0's direct-SQL
  `auth.users` seeding left `confirmation_token`/`recovery_token`/`email_change_token_new`/
  `email_change_token_current`/`email_change`/`phone_change`/`phone_change_token` as `NULL`
  instead of `''`. GoTrue scans these into non-nullable Go strings, so every password login
  failed project-wide with a generic `500 "Database error querying schema"`. Fixed in
  migration `0020_fix_auth_users_null_tokens`. Full detail already recorded in the Phase 0
  notes above — flagging again here since it's what actually unblocked Phase 2 testing.
- **The original `calls` table's "6 RLS policies" (referenced in Phase 0 Step 1 and in
  this Phase 2 doc's Step 2 as "the convention to follow") no longer exist and were never
  captured before the Phase 0 wipe** — `DROP SCHEMA public CASCADE` destroyed them along
  with everything else, and no `pg_policies` query was run before that wipe. RLS for every
  table (including `calls`) was instead designed from claude.md's own stated principle
  (line ~218: recruiters see only rows tied to an assignment they hold or held; admins/
  managers see all) and applied uniformly, not by reverse-engineering the lost originals.
- **New permission key added: `view_all_records`** (category "Administration"), granted to
  Admin only, seeded via migration `0021`. It exists purely as the RLS "sees everything"
  bypass condition — it is not a UI feature toggle like the other 18 permissions, and
  doesn't correspond to any checkbox the signed-off HTML shows. It will appear in the Roles
  & Permissions screen's permission list like any other row since it lives in the same
  `permissions` table; if that's undesired, filtering it out of that screen's display (while
  keeping it enforced in RLS) is a cheap follow-up. Chosen over hardcoding a role name or
  role_id inside RLS policies, per claude.md's "never hardcode a role name in a permission
  check" rule — kept that rule consistent across both the app-guard layer and the DB layer.
- **RLS enabled on all 23 `public` tables** (migrations `0021`-`0027`), using 3 SECURITY
  DEFINER helper functions (`auth_has_permission(key)`, `auth_holds_application(id)`,
  `auth_holds_candidate(id)`) so policies can check permission keys and assignment ties
  without recursive RLS lockout. Design summary (full policy SQL is in the migrations):
  - `candidates`/`applications`: visible to `view_all_records` holders, or the row's
    creator, or a recruiter with a current-or-past `assignments` row tying them to it.
  - `follow_ups`: visible to `view_all_records` holders, whoever it's `assign_to`, or
    anyone holding the assignment on its application.
  - `calls`: visible to `view_all_records` holders, `resolved_agent_id`, or anyone holding
    the assignment on the linked candidate. No INSERT/DELETE policy for `authenticated` —
    the Android app writes `calls` via the service-role key, which bypasses RLS entirely;
    the web app can only UPDATE (attribution), gated on the `attribute_calls` permission.
  - `notes`: visible to `view_all_records` holders, the note's author, or anyone holding
    the assignment on its application. A user can only ever insert a note as themselves.
  - `assignments`: writes require `manage_assignment` (Admin-only in the current seed);
    reads are `view_all_records` holders or the assignment's own `recruiter_id`.
  - Reference/config tables (`processes`, `roles`, `permissions`, `role_permissions`,
    `pipeline_templates`, `pipeline_stages`, `users`, `clients`, `jobs`, `company_settings`)
    are read-open to every authenticated user, write-gated by the closest matching
    permission (`manage_roles_permissions`, `manage_jobs`, `manage_clients`,
    `manage_team`, or `view_all_records` where nothing more specific exists).
  - `whatsapp_templates` follows its own `visibility` enum (all/process/private).
  - `import_batches`/`import_rows` (bulk_import), `report_requests` (own rows +
    `request_reports` to create), `notification_settings` (strictly own rows only),
    `activity_logs` (insert-own, admin-only read) round out the rest.
  - Verified live against the real REST API (not raw SQL, which bypasses RLS): an Admin
    session sees all 14 seeded candidates; a recruiter session (Ayesha Khan) sees exactly
    the 2 tied to her via `created_by`/`assignments`, matching a direct DB count. A
    recruiter's attempt to INSERT into `clients` (an admin-only table) returns a genuine
    Postgres `42501` RLS violation via PostgREST, surfaced as HTTP 403.
- **`/api/auth/login` bug fixed**: it was mapping every Supabase Auth error — including a
  genuine 5xx — to a `401 invalid_credentials`. A real backend outage would have looked
  identical to a user mistyping their password. Now 5xx errors return `502 auth_unavailable`
  instead; only actual bad-credentials/unconfirmed-email cases still render the login form's
  existing error slot as `401 invalid_credentials`.
- **Sidebar items are now permission-gated**, hidden when the signed-in user lacks the
  mapped permission key (`Sidebar.tsx`'s `NavItem.permission` field). The mapping from nav
  item to permission key was my own judgment call, not specified anywhere in the HTML or
  claude.md — documented here for review: Allocations→`manage_allocations`,
  Customers/Interactions→`manage_candidates`, Follow-Ups/Calendar/Recurring Follow-
  Ups→`manage_follow_ups`, Call Logs→`attribute_calls`, Request Reports→`request_reports`,
  Rechurn→`manage_rechurn`, Analytics→`view_analytics`, Data Management→`bulk_import`,
  Team→`manage_team`, Roles & Permissions→`manage_roles_permissions`. Dashboard, Whatsapp,
  Notifications, Team Live Status, and Settings are left ungated (visible to any signed-in
  user) since no existing permission key maps cleanly to them.
- **Known pitfall, fixed**: `revoke execute ... from public` does NOT remove `anon`'s
  execute access to a function if that access came from Supabase's own default-privileges
  setup (which grants EXECUTE on every new `public`-schema function to `anon`/
  `authenticated`/`service_role` at creation time) rather than from `PUBLIC` itself. The
  security advisor kept flagging `auth_has_permission`/`auth_holds_application`/
  `auth_holds_candidate` as anon-executable even after migration `0027`'s revoke; fixed for
  real in migration `0028` with an explicit `revoke ... from anon`. `authenticated` still
  (correctly, unavoidably) needs execute on these — RLS policies run as the querying role,
  so it must hold execute on any function its own policies call.
- **Roles & Permissions and Team/Team Live Status were built by two parallel background
  agents** against this same design. Both self-audited against Phase 2's checkpoints and
  were independently spot-checked (real REST calls, not just code review) before being
  accepted. One genuine bug found along the way, already fixed: PostgREST's constraint-name
  embed hint (`users!users_reports_to_fkey`) 500s on the `users.reports_to` self-referencing
  FK; the bare column-name embed (`manager:reports_to(id, name)`) resolves the correct
  (manager, not direct-reports) direction.
- **`SUPABASE_SERVICE_ROLE_KEY` supplied and the invite flow verified end-to-end** (2026-09-03).
  `POST /api/team` was exercised for real: invited `phase2-verify-test@highdive.com` as Admin,
  confirmed matching `auth.users` (invited) and `public.users` (`status='invited'`) rows on the
  same UUID, then deleted the test account via the GoTrue admin API to leave seed data clean.
  Also re-verified live: permission grant/revoke on the `User` role changes what a signed-in
  session can call with zero code change or redeploy (round-tripped `manage_roles_permissions`
  onto `User`, watched `/api/auth/me` and `POST /api/roles` react immediately, then reverted).
- **Fixed a real Phase 1 checkpoint 4 gap**: `/settings`'s sub-view tab strip (ui-gaps.md item 9)
  was missing "Activity Logs" — the source HTML's `adminOtherLabels` defines it alongside
  Company Details/API Configuration/Account & Billing/Usage, all four of which got the
  synthesized "coming soon" tab, but Activity Logs was dropped. Added as a fifth tab, same
  pattern, in `app/(app)/settings/page.tsx`.
- **Role-naming note**: Phase 2's own checkpoint 1 wording ("seeded Super Admin, Recruitment
  Manager, and Recruiter") doesn't match what Phase 0 actually seeded — there are only two
  roles, `Admin` and `User` (`is_system=true` on both, 19 and 7 permissions respectively). Login
  was verified for both actual roles (Rakshit/Devika = Admin, Ayesha/Rohan/Kavya/Suresh/Anjali =
  User). Not treated as a bug to silently fix — renaming or adding seed roles is a data decision
  for Vivek, and the RBAC mechanism itself is fully generic (Roles & Permissions supports
  arbitrary roles already, live-tested above).

## Phase 3 — As-Built Notes (read before Phase 4)

- **Multi-job candidates (Open Question 5, now resolved):** the candidates list shows
  one row per person, carrying their **most recent application** (status, job,
  recruiter). Ananya Sharma's second application isn't hidden — it's on the detail
  page's full application list, sorted newest-first. Chosen over one-row-per-application
  because the list is explicitly a *candidate* list (claude.md: "candidate ≠
  application"), and over earliest-application because a stale first role would
  misrepresent where someone actually stands today. Per your explicit sign-off.
- **Second pipeline template seeded** (`scratch-seed-pipeline.mjs`, run once, not part
  of the app): "Bulk Hiring Pipeline" (5 stages: Sourced → Screened → Interview →
  Offer → Joined), assigned to the 3 seeded jobs that read as high-volume/field roles
  (Field Sales Executive, Customer Support Associate, Warehouse Supervisor), with their
  applications' `pipeline_stage_id` remapped onto the new stage set using the same
  status→stage inference Phase 0 used. This is what makes Checkpoint 2 ("two jobs on
  different templates show different stage lists") genuinely testable instead of
  vacuously true — verified live: Default Pipeline's 8 stages vs. Bulk Hiring's 5 render
  as different lists for two real jobs, and per-stage counts match a direct DB count
  for both. Per your explicit sign-off ("Seed a 2nd template").
- **`GET /api/recruiters` and `GET /api/recruiters/:id` added** — not in claude.md's
  original API Structure table (which never mentions the /recruiters screens Phase 3
  Step 4 asks for). List is gated on `view_all_records` rather than left open: RLS
  restricts `assignments` reads to the assignment's own recruiter, so any other
  permission would return a "directory" where everyone but the caller shows 0
  assigned/0% conversion — a 403 for non-managers is more honest than a page of silent
  zeros. A recruiter can still read their own detail row.
- **"Recruiter" is derived from permissions, not a role name or job title** — a
  recruiter is precisely a user who lacks `view_all_records` (claude.md: never
  hardcode a role name in a permission check). In the current 2-role seed that resolves
  to the six `User`-role people, but stays correct if roles are renamed or a third role
  is ever added.
- **Assignment metrics (`assignedCount`, `conversion`) are computed over *active*
  assignments only**, so the two numbers on a row stay mutually consistent — a
  candidate unassigned after joining stops counting for that recruiter. `conversion`
  is `(selected + joined) / assigned`, explicitly excluding the other terminal-but-
  negative statuses (`rejected`, `not_interested`, `no_response`) from the numerator;
  returns `0`, never `NaN`, when nothing is assigned.
- **Call metrics left genuinely null, not faked.** "Calls Today," "Avg Talk Time," and
  "Recent Call Activity" are out of scope until Phase 5 wires `calls`. Rather than a
  page still rendering `candidatesSeed`/`callLogsSeed` imports alongside real data, the
  recruiter API returns `callsToday: null` / `avgTalkSeconds: null` with a
  `TODO(phase-5)` in `lib/recruiters.ts`, so the eventual swap is a single-file change
  and nothing downstream is treating an absence as a real zero in the meantime.
- **Known pitfall, not a Phase 3 bug — inherited from Phase 2's middleware:** an
  unauthenticated request to any `/api/*` route (this phase's included) gets a `307`
  redirect to `/login`, not the route handler's own `401 {error:{code,message}}` JSON —
  `lib/supabase/middleware.ts` intercepts every non-public path before the handler
  runs, by design, purely as a browser-navigation UX gate (its own comment: "a forged
  cookie gets past this redirect but still cannot read or write anything," since RLS
  and `requirePermission` are the authoritative layer). This is uniform across every
  route in the app, not specific to candidates/jobs/clients/recruiters, and touching
  shared middleware was out of this phase's scope — flagging for whoever picks up a
  pure-API (non-browser) consumer of these routes.
- **Screens wired, mocks removed.** `/candidates`, `/candidates/:id`, `/jobs`,
  `/jobs/:id`, `/clients`, `/clients/:id`, `/recruiters` and `/recruiters/:id` all read
  live data now. Jobs/clients/recruiters are server components calling the `lib/*`
  query modules directly (the Team/Roles pattern — no HTTP hop for the first render);
  the candidates list server-renders page 1 and then refetches `/api/candidates` as
  filters change, so search, status, date-range, sort and paging are all resolved
  **server-side** and stay correct across pages. `lib/candidates.shared.ts` holds the
  row types and `PAGE_SIZES` because `lib/candidates.ts` and `lib/format.ts` are
  `server-only` and a "use client" component can't import them.
- **A pagination control was added to the candidates list** (rows-per-page 10/25/50 +
  prev/next + an "x–y of n" counter). The signed-off HTML has no pager on this screen
  at all, but Phase 3's checkpoint explicitly requires the 10/25/50 page sizes, so the
  control is new UI — the only element added to a signed-off screen in this phase.
- **`PATCH /api/applications/:id` added** so the candidate detail's Status dropdown
  actually persists. It writes `status` and/or `pipeline_stage_id` and deliberately
  does **not** auto-sync one from the other: they're separate vocabularies, and each
  template names its stages differently, so inferring a stage from a status would
  write a stage belonging to another template. It rejects a stage that doesn't belong
  to the application's own job's template.
- **Controls that can't persist yet are disabled, not fake.** Assigned Recruiter on the
  candidate detail is now read-only text (reassignment writes `assignments` under the
  one-active-assignment constraint — Phase 4's allocation flow); Schedule Follow-up and
  Call History are disabled/empty with a "wired in Phase 5" note. The previous mock
  page let you change these and silently discarded the change.
- **GAP — the UI has a 10th status the database can't store.** The frontend's
  `ApplicationStatus` now includes **`not_eligible`** (added during the styling pass,
  with a label in `lib/mock/styles.ts` and mappings in `lib/mock/pipeline.ts`), but the
  `application_status` enum has only the 9 values Phase 0 created. Selecting it on the
  candidate detail returns a `400` from `PATCH /api/applications/:id` (validated
  against the real enum) rather than a Postgres error, and filtering by it is dropped
  from the query rather than sent — verified. **Resolving it needs a decision:** add
  `not_eligible` to the enum (a migration, so it needs DDL access — see below), or drop
  it from the UI.
- **GAP — most "Manage Table Columns" columns have no backing schema.** The column
  picker offers ~18 fields (Address, City, State, Country, Pincode, Alternate name/
  phone, Highest Education, Institute, Years of Experience, Employment Type, Company,
  Current Designation, Last CTC, Age, Interview Scheduled On) plus the **Filter by
  Location** and **Priority** filters — none of which exist as columns on `candidates`.
  They read `lib/mock/candidateProfiles.ts`, which is keyed by seed ids (`c1`…`c14`),
  so against real uuids they render `--`, Location matches nothing and Priority buckets
  everyone as "Unprioritized". Only Created On, Assign To, Source, Notes and Email are
  genuinely DB-backed; `renderColumnCell` now prefers the live `recruiterName`/`email`
  and falls back to the mock profile for the rest. Location/Priority are applied
  client-side over the loaded page, which is also why they can't page correctly.
  **Resolving it needs a decision:** extend `candidates` with those columns (a
  migration), or drop the unbacked columns/filters from the UI.
- **DDL is currently blocked from this session.** The Supabase MCP connector attached
  here is authorized for a different account (it lists `jewellery-backend` and
  `instashop-content`, not this project's `xvcnhfkrjghjxyyftkkm`), and the service-role
  key only reaches PostgREST, which can't run DDL. So both gaps above, and the
  `phone_digits` generated column noted in `lib/format.ts`, need either the Highdive
  project connected to the Supabase connector, a DB password/personal access token, or
  someone pasting the SQL into the dashboard's SQL editor. Data-only seeding (the
  second pipeline template) worked fine through the service-role key.
- **Self-audit run against the live dev server**, not just code review: signed in as
  both an Admin and a real recruiter (Ayesha Khan) via `/api/auth/login`, then exercised
  every checkpoint above with real HTTP requests, cross-checked against direct
  service-role DB queries. Confirmed live: recruiter-scoped candidate list matches
  Ayesha's actual `assignments`/`created_by` rows exactly (2 of 14) and not the full 14;
  a recruiter gets 403 on `/api/clients`, `/api/jobs`, `/api/recruiters` but 200 on their
  own recruiter page; a POST/PATCH round-trip (create candidate + application, patch
  notes, blank phone with `""`) landed and cleared correctly, then was cleaned up. 22/23
  checks passed on the first run; the one gap is the pre-existing middleware behavior
  documented above, not a Phase 3 defect.
- **The wired screens were then verified as rendered HTML, not just as API responses**
  (`scratch-verify-pages.mjs`, 15/15): every real candidate/job/client/recruiter name
  appears on its list; the candidate detail shows real source/notes and the "Not
  uploaded" resume state; the multi-application candidate shows its "Other
  Applications" block; two jobs on different templates each render only their own
  stages and none of the other template's; the recruiter directory is gated for a
  non-manager instead of showing zeroed metrics; and **the candidates screen itself is
  RLS-scoped** — signed in as Ayesha Khan the page renders exactly her 2 candidates out
  of 14, with 0 leaked. Filter params were verified separately
  (`scratch-verify-filters.mjs`, 7/7): status, stage-expansion, `createdFrom`/
  `createdTo`, `unassigned`, sorting, and an unknown status being dropped rather than
  sent to Postgres.

## Phase 4 — As-Built Notes (read before Phase 5)

- **Allocations, Assignment, Import, and Data Management are all wired to live
  data.** `/allocations` reads `v_allocations` directly (bucket filter is
  `.eq("bucket", ...)` on the view — no bucket logic duplicated in TypeScript);
  `/assignment` implements round-robin and load-balanced auto-distribution, manual
  assignment, and reassignment; `/import` runs the real 3-step upload → dedup review
  → confirm flow against `import_batches`/`import_rows`; `/data-management` gained a
  real "Upload Data" step (the source HTML never built one — ui-gaps.md item 23 —
  but this phase explicitly required it) plus working Bulk Export, Bulk Delete, and
  Data Transfer panels. Only "Data Clean-up" stays a coming-soon placeholder, since
  it isn't in claude.md's API table at all.
- **Concurrency safety is enforced by the DB, not the app.** Every assignment write
  (`lib/assignment.ts`'s `insertAssignment`) always attempts the INSERT and lets the
  partial unique index on `assignments(application_id) WHERE status='active'` reject
  a genuine double-assign with Postgres `23505`, reported back as "skipped" rather
  than crashing. Verified live with two truly concurrent `curl` requests (backgrounded
  processes, not sequential calls) against the same unassigned application: one
  request won, the other came back with `skipped: [{reason: "Already assigned."}]`,
  and a direct DB query afterward confirmed exactly one `assignments` row existed.
- **`applications.assigned_recruiter_id` is kept in sync with `assignments` on every
  write** (auto-distribute, manual, reassign, and Data Transfer all go through the
  same `insertAssignment`/`reassign` helpers) — closing the gap Phase 3's As-Built
  Notes flagged (item 3: "two separate sources of truth... nothing in this phase
  keeps these two in sync on reassignment"). Reassignment itself never updates a row
  in place: the current active row is flipped to `status='reassigned'` with
  `unassigned_at` set, then a fresh active row is inserted — verified live that this
  produces exactly one `active` row and a real history trail.
- **Data Transfer moves a user's entire current caseload, not a hand-picked list** —
  every application the `fromUserId` currently holds an active assignment on is
  reassigned to `toUserId` via the same `reassign()` path, and one `activity_logs`
  row records the move (`action: "data_transfer"`, `metadata: {toUserId,
  transferred, skipped}`). Verified live end-to-end, including a bug this surfaced
  in *my own manual test cleanup*, not the feature: transferring **back** moves
  everything the target currently holds, including candidates that were already
  theirs before the test — not just the ones just transferred in. Real, intentional
  behavior (matches "transfer this person's caseload" as a product concept), but it
  means undoing a transfer by re-running it in reverse doesn't recreate the original
  split if the destination user already had other candidates. Restoring the seed
  data after testing needed a direct DB fix rather than a second transfer call.
- **`POST /api/data/transfer` is gated on `view_all_records`, not a new permission
  key.** claude.md marks this route "admin"; there's no dedicated `data_transfer`
  permission in the 18-key catalogue, and `view_all_records` is the established
  admin-bypass marker from Phase 2 (same reasoning Phase 3 used for `/api/recruiters`).
- **CSV parsing is a small hand-rolled client-side parser** (`lib/csvParse.ts`) —
  no dependency existed in the project and the format needed (quoted fields,
  embedded commas, `""`-escaped quotes) is modest. Rows are parsed in the browser
  and sent to `POST /api/import/upload` as JSON, not as a file upload; the server
  side only ever sees already-column-mapped rows.
- **Duplicate matching is phone/email equality, never a name match** — a CSV row
  matching an existing candidate's phone is flagged for review even when the name is
  completely different (claude.md: never auto-merge). Verified live with a 3-row
  batch: an exact phone+name match, a same-phone-different-name row, and a wholly new
  row. Both phone matches were flagged (with both sides of the diff rendered); Skip
  Duplicate on the first correctly created no candidate; Import Anyway on the second
  created a new candidate with `is_duplicate=true` and `duplicate_of` pointing at the
  matched record; the confirm count (`imported: 2, skipped: 1`) matched exactly what
  landed in the DB. Matching is done with one bulk `candidates` fetch plus an
  in-memory normalized-phone/email join, not one query per CSV row — chosen so a
  500-row import stays inside a single request instead of one round-trip per row.
- **Real bug caught by the phase's own checkpoint, not code review — `confirmImport`
  originally inserted one candidate row per CSV row sequentially.** A live 500-row
  confirm took **96.7 seconds**, which would blow past most real deployments'
  request timeout well before the browser ever saw a response (the checkpoint
  explicitly asks for "completes without timeout"). Rewrote it to bulk-insert in
  500-row chunks (candidates first, then a second bulk pass for the applications
  any job-titled rows need, resolving each distinct job title once via a small
  cache rather than per row) — re-ran the same 500-row batch afterward and it
  completed in **3.2 seconds**, all 500 imported, 0 dropped. A whole-chunk insert
  failure is `console.error`'d and its rows counted as skipped rather than silently
  disappearing, since a bulk insert can't isolate which single row inside it failed.
- **The "allocations" upload type (Data Management's other CSV path) bulk-assigns
  by phone rather than creating candidates** — claude.md's schema comment and the
  UI's own card text ("creates or overwrites allocations") describe a different
  action from the Customers path, so it was built as: match each row's phone to an
  existing candidate's application, resolve the named recruiter by email, and
  assign (respecting the same one-active-assignment constraint). No dedup-review
  step applies to this type since nothing new is created — it goes straight from
  upload to confirm.
- **RESOLVED — Bulk Delete now genuinely soft-deletes.** DDL access was unavailable
  for the whole phase (Supabase MCP not connected, no direct DB connection string or
  access token) — the same blocker Phase 3 hit for the `not_eligible` enum value and
  the Manage Table Columns gap. `candidates.deleted_at timestamptz null` (migration
  `0029_add_candidates_deleted_at.sql`) was applied 2026-09-04 by the user pasting it
  into the Supabase Dashboard's SQL Editor, after confirming a `service_role` REST
  key — the only Supabase credential available in-session — architecturally cannot
  run DDL through PostgREST regardless of its privilege level; a publishable/anon
  key offered as an alternative doesn't help either, since it's strictly *less*
  privileged. Once applied: `types/supabase.ts` was updated by hand to add the
  column, the `@ts-expect-error`/`as never` casts in `lib/data-management.ts` came
  out, and `lib/candidates.ts`'s list and detail reads now filter
  `.is("deleted_at", null)`. Verified live end-to-end with a throwaway candidate:
  visible (200/total 1) before delete, `POST /api/data/bulk-delete` returned
  `{deleted: 1}` (not the old `501 migration_pending`), then invisible to both the
  list (total 0) and detail (404) afterward while a direct service-role query
  confirmed the row still exists with `deleted_at` set — then hard-deleted via the
  service-role key since it was purely a test artifact, never seed data.
  **RESOLVED 2026-09-04 — the three views now filter `deleted_at`.** The Supabase
  MCP connector reconnected to this project (`xvcnhfkrjghjxyyftkkm`) with real DDL
  access, unblocking every gap this phase had flagged as needing dashboard/SQL-editor
  access. Read each view's actual `CREATE VIEW` source via
  `pg_get_viewdef(viewname::regclass, true)` (not a blind guess), added
  `WHERE c.deleted_at IS NULL` to `v_allocations`/`v_interactions`/`v_rechurn`
  without touching the existing bucket/join logic, and re-applied
  `security_invoker = true` on all three (migration
  `0029_views_filter_deleted_candidates`). Verified via `pg_get_viewdef` that all
  three now contain the filter.
  - **`not_eligible` — decision: dropped from the UI**, not added to the enum. Removed
    from `ApplicationStatus` (`lib/mock/candidates.ts`), `statusStyles`
    (`lib/mock/styles.ts`), and the `stageForStatus`/`crmStageForStatus` switches
    (`lib/mock/pipeline.ts`); `CandidatesClient.tsx`'s status list now matches the
    live 9-value enum exactly, so nothing is silently dropped from filters anymore.
    Chosen over extending `application_status` because an enum value can't be cleanly
    removed later if this turns out to be unwanted, while dropping UI is fully
    reversible.
  - **Manage Table Columns — decision: trimmed to the 5 DB-backed fields**
    (Email, Notes, Created On, Assign To, Source), removing the 16 fields that read
    `lib/mock/candidateProfiles.ts` (a seed-id-keyed mock with no backing columns on
    `candidates`) and always rendered `--` against real uuids: Address, City, State,
    Country, Pincode, Alternate name/phone, Highest Education, Institute Name, Years
    of Experience, Employment Type, Company name, Current Designation, Last CTC, Age,
    Interview Scheduled On. `ColumnId`/`COLUMN_LABELS`/`ALL_COLUMN_IDS`/
    `renderColumnCell` in `components/ListFilters.tsx` all shrank accordingly — shared
    with the Allocations screen's column picker too, which loses the same fake
    options. Chosen over a 16-column migration since nothing else in the product
    needs that data yet; can be revisited if a real requirement shows up. The
    separate "Filter by Location"/"Filter by Priority" panels (also mock-profile-
    backed, used on Candidates/Calendar/Interactions/Follow-ups) were left alone —
    out of this specific gap's scope, and Interactions/Follow-ups/Calendar are still
    unwired mock screens until Phase 5, the more sensible place to decide their fate
    alongside those screens' real wiring.
  - `npx tsc --noEmit` clean after both changes.
- **Self-audit run against the live dev server**, not just code review, using the
  same real-HTTP-plus-direct-DB-query method as Phase 3's: signed in as Admin
  (Rakshit Verma), exercised `/api/allocations` (both buckets, search, status,
  pool-scope filters — counts cross-checked against the view directly since the
  query *is* a direct view query), `/api/assignment/workload`,
  `/api/assignment/auto-distribute` (both methods, plus the concurrency test above),
  `/api/assignment/manual`, `/api/assignment/reassign`, the full
  upload→duplicates→decide→confirm import flow (including a synthetic 500-row batch,
  twice — once before the bulk-insert fix above to get the real 96.7s number, once
  after to confirm 3.2s and 500/500 imported), `/api/data/bulk-export` (row count
  header matches the applied filter, verified with and without a search term),
  `/api/data/bulk-delete` (confirmed the honest blocked-state response), and
  `/api/data/transfer` (including the activity_logs write). Every test mutation was
  cleaned up afterward via the service-role key so the seed data is byte-for-byte
  back where Phase 3 left it — confirmed with a final `candidates`/`import_batches`/
  `assignments` row-count check.

## Open Questions — resolved 2026-09-04 by explicit delegation ("take the decisions and complete the project")

1. **Disposition mismatch (blocks Phase 5) — RESOLVED: option (a).** Derive
   Connected/Not Connected from `duration_seconds > 0`; keep `call_disposition`
   (`interested | callback_later | not_reachable`) as a separate outcome axis,
   displayed alongside connection state, never merged into it. The enum is
   untouched, per claude.md's own "never redefine call_direction/call_disposition"
   rule.
2. **AI Score column (Phase 6) — RESOLVED: keep as a permanently-disabled placeholder.**
   AI stays out of scope; Call Logs' AI Score column and Analytics' AI Call Analytics
   tab both stay wired exactly as Phase 1 already built them (`aiScoreLabel: '--'`,
   "coming soon"), for consistency across both screens.
3. **Recordings — RESOLVED: confirmed flowing.** Live check of the 3 seeded `calls`
   rows (2026-09-04): 2 of 3 have real `b2_url`/`storage_path` values; the third
   (`disposition='not_reachable'`, `duration_seconds=0`) is genuinely null, which is
   correct — no recording exists for an unanswered call. Play Recording is safe to
   wire against `b2_url`, with the disabled state for the null case.
4. **`calls.callback_due_at` vs `follow_ups` — RESOLVED: `follow_ups` is authoritative.**
   Back-fill a `follow_ups` row from any `calls.callback_due_at` that doesn't already
   have a corresponding follow-up, so `callback_due_at` surfaces as data feeding
   `follow_ups`, never as a second, competing system the UI reads directly.
5. ~~**Multi-job candidates.**~~ Resolved in Phase 3 — see its As-Built Notes: the list row shows the most recent application; the detail page lists all of them.

## Phase 5 — As-Built Notes

Phase 5's backend (migrations, `lib/calls.ts`/`.shared.ts`, `lib/interactions.ts`/`.shared.ts`,
`lib/followups.ts`/`.shared.ts`, and all 10 API routes) was already built and `npx tsc --noEmit`
clean when this pass picked the phase up after a process interruption. This pass's actual work was
the frontend: wiring `/call-logs`, `/interactions`, `/follow-ups`, `/calendar`,
`/recurring-follow-ups`, and Candidate Detail's Call History + Schedule Follow-up to that backend,
then self-auditing the whole phase end-to-end.

- **Screens wired, mocks removed**, following the established server-component-fetches-page-1 /
  client-component-refetches-on-filter-change pattern (`AllocationsClient`'s own convention):
  `app/(app)/call-logs/{page.tsx,CallLogsClient.tsx}`,
  `app/(app)/interactions/{page.tsx,InteractionsClient.tsx}`,
  `app/(app)/follow-ups/{page.tsx,FollowUpsClient.tsx}`,
  `app/(app)/calendar/{page.tsx,CalendarClient.tsx}`,
  `app/(app)/recurring-follow-ups/{page.tsx,RecurringFollowUpsClient.tsx}`, and
  `app/(app)/candidates/[id]/{page.tsx,CandidateDetailClient.tsx}` (Call History table + Schedule
  Follow-up action added to the existing candidate detail screen).
- **Connected/Not Connected (Open Question 1) was implemented as a repurposed existing control,
  not a new column.** The signed-off Call Logs "All" tab has no disposition/connection badge in
  its row template at all — only a "Select Status" filter select that, in the source, listed the
  4 mock-only values (Connected/Not Connected/Busy/Switched Off, none backed by real data). That
  select now offers the two real values (Connected/Not Connected, from `duration_seconds > 0`)
  instead of the four fake ones. The live `disposition` enum (`interested`/`callback_later`/
  `not_reachable`) is shown as its own axis exactly where the signed-off HTML already has a
  column for it: the Unattributed tab's "Disposition" column and Candidate Detail's real Call
  History table (`Date | By | Duration | Disposition | Recording`, verbatim from the source). The
  two axes are displayed alongside each other across the two screens, never merged into one badge
  on either.
- **Play Recording streams the real `b2_url`, fetched lazily.** `GET /api/calls` (the list) never
  returns `b2Url`/`storagePath` — only `GET /api/calls/:id` (the detail route) does, matching
  claude.md's own API table ("detail incl. `b2_url` for playback"). `CallLogsClient` fetches the
  detail record on first Play click per row, caches it, and plays through a single shared
  `<audio>` element; the disabled "no recording" state renders whenever `hasRecording` (computed
  server-side from `b2_url || storage_path`) is false — verified against the one seeded call with
  both null.
- **The CRM-writes-only-notes rule was verified adversarially, not just trusted.** `PATCH
  /api/calls/:id` was hit with a body smuggling `disposition`, `duration_seconds`, and `topic`
  alongside `notes`; the response and a direct service-role read of the row afterward both
  confirmed only `notes` changed — `updateCallNotes`'s own signature has no parameter for
  anything else, so there is no code path that could write them even if the route's body-field
  filter were removed. A request with no `notes` key at all correctly 400s rather than silently
  no-op'ing. No UI element was added for editing notes on Call Logs or Candidate Detail's Call
  History, since the signed-off HTML defines none on either screen (the two circular row-action
  icons that exist are a download-style glyph and the site-wide "Call" icon, neither bound to
  anything in the source either) — adding one would be inventing UI outside this phase's mandate.
  Verified via direct HTTP instead.
- **Call Logs' "Unattributed" tab back-button gap (ui-gaps.md #10) was fixed while wiring the
  screen**, not left as a ported dead end: the same icon now toggles both directions and
  highlights when active. A working attribution queue needs a way back to the main log to be
  usable at all.
- **The "+" quick-action icon — present but unbound on every list row across
  Allocations/Interactions/Follow-ups in the signed-off HTML — was repurposed as "Mark Complete"
  on Follow-Ups and Recurring Follow-Ups rows.** Phase 5 Checkpoint 4 requires a working complete
  action and the source design defines no dedicated control for it anywhere; reusing an existing,
  previously-inert icon reads as the smallest change that makes the checkpoint real rather than
  adding new UI surface.
- **Follow-Ups' "Sourced by" column, static `"--"` in the source markup itself (never bound to
  anything, not even in the prototype), was bound to real data** (`candidates.created_by`,
  resolved the same way Allocations/Interactions already do) instead of preserved as a literal
  dash. The column header already existed and clearly intended real content; every analogous
  column on Allocations/Interactions is genuinely wired, so leaving this one hard-coded would have
  been the odd one out rather than a faithful port.
- **Schedule Follow-up (candidate detail) writes a real `follow_ups` row.** The signed-off HTML's
  input is freeform text (placeholder `"e.g. 3 Sep, 11:00 AM"`); swapped for `<input
  type="datetime-local">` since a working Schedule action needs an actual parseable `due_at`, not
  a string a natural-language date parser would have to guess at — the one deliberate visual
  deviation from a signed-off control in this phase. A "Recurring" checkbox + recurrence-text
  input were added alongside it (not in the source at all) so `POST /api/follow-ups/recurring` has
  a real UI entry point — otherwise nothing in the signed-off design could ever create a recurring
  follow-up.
- **Recurring Follow-Ups did *not* get "View Schedule"/"History" buttons**, despite the phase
  brief's checkpoint text mentioning them. Traced those two buttons in the actual signed-off HTML:
  they belong to the Request Reports screen's header (Phase 6, out of scope), not Recurring
  Follow-Ups — confirmed by reading the source markup directly rather than trusting the phase
  doc's paraphrase. What the source actually defines for this screen is just the Pending/Upcoming
  tab counts and a "No Data to display" empty state, both wired for real (counts from
  `getFollowUpBucketCounts({isRecurring:true})`); a row list was added for the non-empty case since
  the source never anticipated real data existing here (it was permanently empty, 0 seeded rows),
  using the same row visual language as `/follow-ups`.
- **Calendar's empty-state text was corrected to match the signed-off HTML exactly.** The
  Phase 1 mock (`CalendarPage.tsx`) rendered `"No Data to display"` for the side panel's empty
  case; the actual source markup for that exact condition (`calNoEvents`) reads `"No follow-ups
  scheduled for this date."` — a Phase 1 conversion slip, fixed now since Phase 5's own checkpoint
  requires the three empty states to render exactly as in the HTML.
- **Location/Priority filters and the Interactions "Unique/All" toggle were dropped**, not wired,
  on the three newly-live screens (Interactions, Follow-Ups, Calendar keeps only its Status
  filter). Same reasoning Phase 4 already applied to Candidates/Allocations: Location/Priority
  read `lib/mock/candidateProfiles.ts`, a seed-id-keyed mock with no backing columns on
  `candidates`, and would render `--`/match nothing against real uuids. "Unique/All" doesn't map
  onto `v_interactions`'s shape (one row per application, not per call) in any way worth
  preserving. Calendar's "Filter" side panel still offers a Status/Stage radio (shared
  `MoreFiltersPanel` component) for visual consistency with every other screen using it; selecting
  "Stage" mode there won't match anything against Calendar's real `application_status`-only data —
  a known, minor, low-traffic limitation rather than a functional requirement, left undocumented-
  but-real rather than removing a control every other screen keeps.
- **No pager was added to Follow-Ups or Recurring Follow-Ups.** The signed-off HTML defines no
  rows-per-page control on either screen (confirmed by reading the source markup — Interactions'
  pager is real, Follow-Ups' equivalent section simply ends after the row list). Both screens
  instead request the largest supported page size (50) so the full Pending/Upcoming set renders
  without new pager UI; if real usage ever exceeds 50 due follow-ups in one bucket, this becomes a
  real gap requiring either a pager (a new-UI decision, same class as Phase 3's Candidates pager)
  or a decision to leave it.
- **Self-audit run against the live dev server** (port 3001 — 3000 was already occupied by another
  process), signed in as Admin (Rakshit Verma) and recruiter Ayesha Khan via `/api/auth/login`,
  cross-checked against direct service-role REST queries the same way Phase 3/4 did:
  - **Checkpoint 1 (attribution) — all green.** Vikram Singh (1 active application) and Arjun
    Mehta (1 active application) auto-link on the trigger; Ananya Sharma (2 active applications,
    the Phase 0 seed built for exactly this) stays `application_id: null` and appears in
    `/api/calls/unattributed` with both her real applications offered for manual linking. The
    zero-active-application case has no natural seed row, so one was created synthetically (a
    throwaway candidate + a service-role-inserted `calls` row, mimicking how the Android app
    writes) — it appeared in the unattributed queue with `candidateJobs: []`, then both rows were
    deleted after the check. `POST /api/calls/:id/attribute` was verified both ways: rejected a
    mismatched application (`400 application_mismatch`) and accepted Ananya's own application
    (`200`, removed from the queue), then reverted to `null` afterward to restore seed state
    byte-for-byte. Empty-state text ("No unattributed calls — everything is linked to a job.")
    renders once the queue is empty.
  - **Checkpoint 2 (call logs & recording) — all green.** `GET /api/calls` returns Vikram → Ananya
    → Arjun in `call_time` order (matching `2026-09-01 > 2026-08-28 > 2026-08-26`), all
    `direction_normalized: "outbound"`. `connected` matches `duration_seconds > 0` exactly for all
    three (`false`/`0s`, `true`/`284s`, `true`/`142s`). The Play/disabled-state split is a direct
    ternary on `hasRecording` computed server-side — verified via the data (call 1's `b2_url`/
    `storage_path` both null) and code inspection, since RSC-serialized HTML dedupes repeated
    literal strings and isn't reliably `grep`-able for per-row state. `PATCH /api/calls/:id`
    notes-editing and write-protection verified adversarially (above). Candidate Detail's Call
    History renders Ananya's real call (`"Confirmed interview availability"`) and Rohit Verma's
    (no calls) renders the exact `"No calls made yet."` empty state — both confirmed by fetching
    the rendered HTML, not just the API. Recruiter scoping confirmed live: Ayesha Khan sees 2 of
    the 3 real calls (the two `resolved_agent_id`-hers rows), not Arjun's (Suresh Pillai's call).
  - **Checkpoint 3 (interactions) — all green.** `v_interactions` has 4 real rows (Ananya appears
    twice, once per application — the view is one-row-per-application, not per-candidate, and
    `InteractionRow`/`getInteractionRows` already documented that shape); `GET /api/interactions`
    returned exactly those 4 for Admin and correctly narrowed to 2 (Vikram + Ananya's rows only,
    Arjun excluded) for Ayesha. "Interacted on" matches each row's `call_time` exactly, confirmed
    against the raw view data.
  - **Checkpoint 4 (follow-ups & calendar) — all green.** Direct count of the 10 seeded
    `follow_ups` rows against today (2026-09-04, IST) gives 7 pending / 3 upcoming;
    `GET /api/follow-ups?bucket=pending|upcoming` returned exactly `7`/`3` with matching
    `counts`. A real `POST /api/follow-ups` (Arjun's application, due 15 Sep) appeared correctly
    on `GET /api/follow-ups/calendar?year=2026&month=9` under day 15; `PATCH .../:id
    {status:"completed"}` set `completed_at` and flipped `bucket` to `null` (verified both via the
    API response and a direct DB read), dropping it out of both tabs. `POST
    /api/follow-ups/recurring` created a real `is_recurring: true` row that showed up correctly
    under `GET /api/follow-ups/recurring`'s own Pending/Upcoming counts. The `callback_due_at`
    backfill (Q4) was confirmed live: one of the 10 seeded rows carries the note "Backfilled from
    call callback (call #2) — Candidate asked to call back after 4 PM" and is the only follow-up
    referencing that callback — no duplicate. All three test-created rows (one plain, one
    completed, one recurring) were deleted afterward; final row counts (`calls`: 3, `follow_ups`:
    10) and Ananya's call/Arjun's notes were confirmed restored to their exact pre-audit values.
  - Pages were also fetched as rendered HTML (not just API JSON) for all 5 screens plus two
    candidate-detail cases, confirming real seed names/data appear and no Next.js error boundary
    triggered (the one `"This page could not be found"` string every App Router page's RSC
    payload embeds for the shared not-found boundary is present in all of them, including working
    pages — a build artifact, not a signal, and not worth over-indexing on given the point above
    about RSC string deduplication).
- `npx tsc --noEmit` clean after all frontend changes.
- **Still open / deliberately out of scope:** the Calendar "Filter" panel's Stage-mode dead end
  (documented above); no pager on Follow-Ups/Recurring Follow-Ups if a bucket ever exceeds 50 rows
  (documented above); AI Score/AI Call Analytics remain the permanent placeholders Q2 already
  settled. Dashboard, Analytics, Reports, Request Reports, and Rechurn are explicitly Phase 6+ and
  were not touched.

## Phase 6 — As-Built Notes

Wired Dashboard, Analytics, Reports, Request Reports, and Rechurn to live data end to end:
`lib/dateRanges.ts`, `lib/pipeline.ts`, `lib/dashboard.{ts,shared.ts}`, `lib/analytics.{ts,shared.ts}`,
`lib/reports.{ts,shared.ts}`, `lib/reportRequests.{ts,shared.ts}`, `lib/rechurn.{ts,shared.ts}`, the
9 new API routes (`/api/dashboard`, `/api/analytics/{overall,login,top-users}`, `/api/reports`,
`/api/report-requests`, `/api/rechurn/{count,initiate}`), and the 5 screens
(`app/(app)/{dashboard,analytics,reports,request-reports,rechurn}`). No DB access was available
this session beyond the service-role REST fallback (see below), so no migrations were needed or
attempted — `report_requests`, `pipeline_stages`/`pipeline_templates`, and `v_rechurn` already
existed exactly as claude.md's schema describes.

- **DB access this session: MCP unavailable, REST fallback used throughout.** `ToolSearch` found
  zero `mcp__*Supabase*` tools at any point in this session — unlike the pass that finished Phase
  5, which had it reconnected. Every live cross-check in this phase's self-audit (below) and the
  synchronous report-generation fallback both used direct PostgREST calls with the service-role
  key from `.env.local`, the same fallback Phase 5's second pass used successfully.

- **Date ranges are IST calendar days, computed once in `lib/dateRanges.ts`** and shared by
  Dashboard and Analytics rather than each screen inventing its own math. "Last 7 Days"/"Last 30
  Days" are inclusive windows ending **today** (today + 6/29 preceding days) — a decision call,
  since neither claude.md nor the phase spec pins down inclusivity either way. Call Trends/Talk
  Time charts bucket **hourly within Today, daily across Last 7/30 Days** (`buildChartBuckets`);
  Analytics never offered a Y'day tab in the signed-off HTML, so `AnalyticsRangeKey` is a
  deliberately smaller set than `DashboardRangeKey`.

- **Recruiter scoping is enforced explicitly, not left to RLS alone.** RLS already restricts a
  recruiter's reads to rows tied to an assignment they hold or held (claude.md's own rule), but
  that's a *superset* — e.g. `calls` RLS admits any call on a candidate the recruiter is assigned
  to, even one another agent placed. claude.md Phase 6's "Recruiters see only their own numbers" is
  read literally: every call metric additionally filters `resolved_agent_id = self`, and every
  candidate/application metric filters `assigned_recruiter_id = self` (`lib/pipeline.ts`'s
  `recruiterId` option), whenever the caller lacks `view_all_records`. This produced a genuine,
  subtle, live-verified result during the audit: candidate `06c49fe7` (2 applications, one
  assigned to Ayesha Khan, a newer one assigned to Rohan Deshmukh) shows up in **Ayesha's**
  Dashboard/Analytics using *her own* application's status (`interview_scheduled`), not the
  candidate's overall newest application (`contacted`, Rohan's) — each recruiter's view reflects
  their own caseload on a shared candidate, never a colleague's.
  Open Actions is the one exception: unassigned/pending-follow-up counts are **not** date-range
  scoped (they mirror Allocations' "New" bucket and Follow-Ups' "Pending" bucket exactly, as the
  checkpoint requires, and those screens show the current backlog regardless of date tab); Missed
  Calls **is** range-scoped (it's `Not Connected` calls within the selected window, matching what
  Call Logs would show with the same range + Not Connected filter applied). Reports itself has no
  date range at all, matching the signed-off HTML — it's an unscoped, org-wide audit screen, gated
  on `view_all_records` (claude.md's API table marks it "manager+"; no dedicated permission key
  exists for it, so this reuses the established manager-bypass marker from `/api/recruiters` and
  `/api/data/transfer`, Phase 3/4's own precedent).

- **"Personal" call bucket stays permanently 0.** No schema axis distinguishes a personal call from
  a work call (`direction_normalized` is only outbound/inbound; `disposition` carries no such
  concept either) — same as the signed-off HTML, which never derives it from data either.

- **Conversion Funnel (Analytics) and Pipeline Funnel (Reports) share one function**
  (`lib/pipeline.ts`'s `getDefaultPipelineFunnel`) reading real `pipeline_stages` off the org's
  `pipeline_templates` row where `is_default = true` — never a hardcoded stage list, satisfying the
  checkpoint. Two pipeline templates exist (Phase 3): this funnel only covers applications on jobs
  using the **default** template, so the 3 jobs on "Bulk Hiring Pipeline" aren't counted in it —
  same documented, pre-existing limitation as ui-gaps.md item 15 ("Offered" can never have
  candidates), not a new gap. Live-verified both ways: "Offered" genuinely returns `count: 0`;
  "New" returns `count: 3`, matching exactly the 3 seeded applications whose `pipeline_stage_id`
  is that stage's id (the other 2 "new"-status applications use a Bulk Hiring stage id and are
  correctly excluded).

- **Customer Stages (Analytics) and the Dashboard's Candidates panel share one computation too**
  (`lib/pipeline.ts`'s `getCandidateStageSnapshot`), so the two screens can never disagree about
  the same range/scope. It reuses the existing "one row per candidate, carrying the most recent
  application" rule (Phase 3 Open Question 5) rather than inventing a second counting rule — with
  the caveat that "most recent" is evaluated *within* the recruiter's own filtered application set
  when scoped (see above), not the candidate's global newest.

- **Login Analytics: real login/logout instrumentation added, one genuine limitation left as
  `--`.** `POST /api/auth/login` and `/api/auth/logout` (`app/api/auth/{login,logout}/route.ts`)
  now each write a best-effort `activity_logs` row (`action: "login"`/`"logout"`, wrapped in
  try/catch so a logging failure can never block sign-in/out) — added specifically to back this
  widget, since nothing else in the schema records session history. "Login Duration" pairs
  consecutive login/logout events within the selected range and sums the elapsed time (an
  unmatched open login counts up to the range's own upper bound, not "now", so a fixed range's
  answer doesn't grow on repeated polls) — always the **current user's own** duration regardless of
  role, since the source HTML renders it as one personal value, not an org list.
  **Real bug found and fixed during the self-audit**: reading `activity_logs` through the
  request-scoped client returned zero rows for every user, including reading one's own rows —
  `activity_logs`' RLS is insert-own/**admin-only read** (Phase 2 As-Built Notes), which blocks a
  non-admin from reading even their own login history. Fixed by reading through
  `createAdminClient()` in `getLoginAnalytics`, with the query **always** hard-filtered to
  `actor_id = profile.id` before it runs — bypassing RLS here can only ever unblock a user reading
  their own rows, never expose anyone else's. Verified live: logging in and out via curl produced
  a real `loginDurationLabel: "1m"` on the next `GET /api/analytics/login` call. "Wrap up
  Time"/"Break Time"/"Idle Time" stay a genuine `--` — nothing in this schema logs a *history* of
  `live_status` transitions (`users.live_status`/`live_status_since` holds only the current state),
  so there's no real duration to compute for them. Same "honest placeholder, not a fabricated
  number" reasoning as Q2's AI stub — implemented identically for consistency.

- **Request Reports — asynchronous generation is a documented, deliberate simplification.**
  claude.md asks for an Edge Function or pg_cron job to move `queued → ready|failed`. Neither was
  reachable: no Supabase MCP connector (confirmed via `ToolSearch`, see above), and the
  service-role REST fallback can reach PostgREST but cannot deploy an Edge Function or schedule
  pg_cron. Per the phase brief's own fallback instruction, `POST /api/report-requests`
  (`lib/reportRequests.ts`'s `createReportRequest`) instead inserts the `queued` row and then
  generates the report **synchronously in the same request**, transitioning it to `ready` or
  `failed` before returning — not left stuck at `queued` forever, but not genuinely asynchronous
  either.
  **Real bug found and fixed during the self-audit**: the status-transition `UPDATE` 500'd with
  PostgREST's `PGRST116` ("0 rows") — `report_requests`' RLS grants the requester `INSERT` (the
  "own rows + `request_reports` to create" policy from Phase 2) but not `UPDATE`; that transition
  was designed for a trusted background worker, not the requesting user's own session. Fixed by
  routing only that one write through `createAdminClient()` — standing in for the missing
  privileged async worker, the same reasoning `lib/supabase/server.ts` already documents for
  `admin.inviteUserByEmail`. Verified live end-to-end after the fix: a `Customers` request reached
  `ready` with a real downloadable file; a `Whatsapp Messages` request reached `failed` with a
  clear reason.
  **No Storage bucket was provisioned** (no DDL/dashboard access to create one) — the generated CSV
  is embedded directly as a `data:text/csv;base64,...` URI in `report_requests.file_url`, small
  enough for this dataset and genuinely downloadable from a browser with zero extra
  infrastructure.
  **7 of the 10 report types generate a real CSV** (Customers; Call Logs (All/Unique); Interactions
  (All) and (Last/Unique), from `v_interactions`; Allocations (Common Pool/Pending/Completed), from
  `v_allocations` with "Pending"/"Completed" interpreted as attempted-but-not-yet-terminal vs.
  attempted-and-selected/joined — not defined anywhere in the signed-off HTML, so this phase's own
  reasonable call). **The other 3 (Whatsapp Messages, SMS Interactions, Emails) reach `status:
  "failed"` with an honest reason** — no message/SMS/email log table exists anywhere in the schema
  (`whatsapp_templates` holds message *templates*, never sent messages), so fabricating a report
  for them was rejected in favor of a truthful failure. Live-verified that Created Date vs. Last
  Interaction produce genuinely different result sets for the same report type and range (8
  candidates by `created_at` vs. 3 by last real call, for the same 10-day window) — the checkpoint
  claude.md/the phase spec asks for.
  `report_requests` has no error-message column, so a failure's reason is returned only in that
  same POST response, not persisted — a later `GET` sees `status: "failed"`, `file_url: null`,
  without the "why" (documented in `lib/reportRequests.shared.ts`).
  The "History" button (previously unbound) now toggles a real request-history panel reading `GET
  /api/report-requests`; "View Schedule" stays unbound — a "schedule" implies recurring report
  generation, which needs the same deploy access this phase never had. A "Date Basis" selector
  (Created Date/Last Interaction) was added to the form — the signed-off HTML's Request Reports
  screen never actually has one (confirmed by reading the source markup), but the phase spec
  explicitly requires it, so this is new UI, the same class of deliberate addition Phase 5 made for
  Schedule Follow-up's recurrence checkbox.

- **Rechurn's eligible-status set matches the mock's actual (not apparent) behavior.**
  `RECHURN_ELIGIBLE_STATUSES = [no_response, not_interested, rejected]` (`lib/rechurn.shared.ts`)
  reproduces exactly what the Phase 1 mock's `getRechurnCount` computes, even though its "Select
  Status" dropdown lists all 9 statuses — the mock always ANDs the dropdown selection with this
  fixed eligible set regardless of what's picked, a source-HTML quirk rather than a real "any
  status" filter. `v_rechurn` itself is unfiltered (confirmed live: it returns every application
  regardless of status) — narrowing to rechurn-eligible statuses, the date-basis column
  (`created_at` vs. `last_interaction_at`), and the optional status-dropdown intersection all
  happen in `getRechurnMatches`, not in the view.
  **"Assign in Common Pool" reuses a newly-extracted `closeActiveAssignment` helper in
  `lib/assignment.ts`**, factored out of `reassign()`'s own "flip the active row to `reassigned`"
  step rather than a second, hand-rolled closing path (per the phase brief's explicit instruction)
  — it also clears `applications.assigned_recruiter_id`, which `reassign()` normally leaves to its
  own follow-up `insertAssignment` call to do; there's no follow-up insert for the common-pool
  path, so `closeActiveAssignment` does it directly. **"Change owner to Specific Users" calls
  `reassign()` directly**, unmodified, per the same instruction.
  The common-pool action is gated on **both** `manage_rechurn` (the base Rechurn permission) **and**
  `bulk_import`, per the signed-off HTML's own stated requirement on that specific option
  ("Allowed if user has access to bulk import permission") — verified live: a recruiter (lacking
  `manage_rechurn` entirely) gets `403` on `/api/rechurn/initiate` regardless of mode.
  **Live-tested end to end with real mutations, then fully restored**: `POST /api/rechurn/count`
  returned `3`, matching a direct `v_rechurn` query filtered to the 3 eligible statuses exactly.
  "Change owner to Specific Users" (→ Suresh Pillai) produced 3 new `active` assignment rows and
  flipped the 3 old ones to `reassigned` with `unassigned_at` set — a real history trail, not an
  in-place update. "Assign in Common Pool" (run immediately after, on the same 3, now
  Suresh-owned) cleared all 3 `applications.assigned_recruiter_id` to `null` and closed their
  active assignment rows; all 3 then appeared in `v_allocations` with `bucket: "new"`, confirming
  they reappear in Allocations' New bucket. Afterward, all 3 applications' assignment history and
  `assigned_recruiter_id` were restored to their exact original values via the service-role key
  (deleted the test-created `assignments` rows, reinserted one `active` row each pointing at the
  original recruiter) — confirmed with a final direct-DB read matching the pre-test state exactly.

- **`npx tsc --noEmit` clean** throughout (checked after the backend modules, again after the
  RLS-driven fixes above, and once more before committing).

- **Self-audit run against the live dev server** (port 3002 — 3000 and presumably others were
  already occupied), signed in as Admin (Rakshit Verma) and recruiter Ayesha Khan via
  `/api/auth/login`, cross-checked against direct service-role REST queries:
  - ✅ **Dashboard, all four ranges** — `today`/`yesterday` correctly return all-zero (no seed data
    in those windows) without any `NaN`/divide-by-zero; `last7` (`total: 1` call, `candidates.total:
    5`) and `last30` (`total: 3` calls, `connected: 2`, `avgTalkSeconds: 213 = (284+142)/2`,
    `candidates.total: 14`, stage buckets summing to 14) both matched hand-computed values from the
    raw seed data exactly.
  - ✅ **Open Actions match Allocations/Follow-Ups exactly** — Dashboard's `unassigned: 5` /
    `pendingFollowUps: 7` matched `GET /api/allocations?bucket=new` (`total: 5`) and `GET
    /api/follow-ups?bucket=pending` (`total: 7`) byte-for-byte, called directly.
  - ✅ **Recruiter scoping** — Ayesha's `last30` dashboard showed exactly her 2 own-`resolved_agent_id`
    calls (not the 3 org-wide) and her 2 own-assignment candidates (not 14), with the split-status
    candidate behavior documented above confirmed live.
  - ✅ **Analytics** — `callTrends.totalCalls: 3` (admin, `last30`) matched the Dashboard/reports
    call totals; the average reference line (`avgMinutes: 0.2`) is `totalMinutes / points.length`,
    genuinely computed, verified by hand; Top 5 User Performances returned exactly 2 rows (Ayesha:
    2 total/0 inbound, Suresh: 1/0) — fewer than 5 because only 2 real agents have calls, matching
    the checkpoint's "or fewer" clause; scoped to Ayesha it returned exactly her own 1 row.
  - ✅ **Reports** — `pipelineFunnel`/`callOutcomes`/`callsByRecruiter` all matched direct DB
    queries (Ayesha: 2 total/1 connected/284s avg; Suresh: 1 total/1 connected/142s avg);
    `unattributedCallCount: 1` matched the one seeded call with `application_id: null`; a recruiter
    gets `403`, confirming the `view_all_records` gate.
  - ✅ **Request Reports** — queued→ready and queued→failed both verified live after the RLS fix
    above; Created Date vs. Last Interaction produced genuinely different result sets (8 vs. 3
    candidates for the same window).
  - ✅ **Rechurn** — count matched a direct `v_rechurn` query; both initiate modes verified with
    real mutations and fully restored (above); `bulk_import` gating confirmed on the common-pool
    path specifically.
  - All 5 pages were also fetched as rendered HTML for both users: Dashboard/Analytics render
    (with real numbers) for both roles; Reports/Request Reports/Rechurn render their permission-
    gated message for Ayesha and their real content for Rakshit — confirmed via direct string
    matches on real seed names (`Ayesha Khan`, `Suresh Pillai`) and section headers, not just a
    200 status code.
  - No checkpoint from the phase file came back partial or failing after the two bugs above were
    fixed; both bugs were genuine (RLS blocking a write/read the route needed), not design
    ambiguity, and both are now fixed at the root (the query module), not papered over in a route
    handler.

- **Still open / deliberately out of scope**: no Storage bucket or Edge Function/pg_cron (documented
  above, blocked on deploy access this session); Whatsapp Messages/SMS Interactions/Emails reports
  (no backing schema — documented above); Wrap up/Break/Idle Time in Login Analytics (no history
  table — documented above); the pre-existing "Offered" stage gap (ui-gaps.md item 15, now visible
  on Analytics too); "Customers By (Select Field)" stays its static empty state, per the phase
  spec's own instruction to keep it that way; Phase 7 (settings/hardening) untouched.

## Phase 7 — As-Built Notes (read before Phase 8)

- **Step 0 finding: the "leaked service_role key" premise was false.** The phase brief's
  as-found audit claimed `.env.example` was committed with a real key. Direct verification
  (full local `git log`, the pushed GitHub history at `AbhinandanJain7788/highdive-crm` via
  its raw content API, and a repo-wide `git grep` for `service_role`/`eyJhbGci`) found the
  placeholder (`your-service-role-key-here`) present since the very first commit, on both
  local and remote. Per your explicit call, the key was **not** rotated — there is nothing to
  remediate, and rotating it anyway would only have cost a Vercel env-var update for no
  security benefit.
- **WhatsApp Templates, Notification Settings, and Settings (General/Company/Activity Logs/
  Password) are all wired to live data**, closing the gap the phase brief found (all three
  pages were pure `lib/mock` `useState` with zero backing routes). New modules:
  `lib/whatsappTemplates.ts`, `lib/notificationSettings.ts`, `lib/settings.ts` (+ their
  `.shared.ts` client-safe counterparts, same split convention as `lib/allocations.ts`), and
  the 7 route files claude.md's table names for this surface (`/api/whatsapp-templates`
  [+`/:id`], `/api/notification-settings`, `/api/settings/general`, `/company`,
  `/activity-logs`, `/password`).
- **`notification_settings`'s RLS needed a real fix, not just a route guard.** Phase 2's
  original policy (`user_id = auth.uid()`) makes every org-default row (`user_id IS NULL`)
  invisible and unwritable to *everyone*, since no session's `auth.uid()` is ever null — the
  Notifications screen (a single org-wide config form, no per-user selector in the HTML)
  could never have worked against it. Fixed in migration `0030_notification_settings_org_defaults`:
  a partial unique index (`key WHERE user_id IS NULL`, since a plain `UNIQUE(user_id, key)`
  treats every NULL as distinct) plus new `select`/`write` policies that let any signed-in
  user *read* their own row or the org default, and let a `view_all_records` holder *write*
  the org default. The app-level upsert (`lib/notificationSettings.ts`) does its own
  select-then-insert/update rather than `.upsert({onConflict})`, since PostgREST can't target
  a partial index as an upsert conflict source.
- **Company Details has no real form anywhere in the signed-off HTML** (`adminOtherLabels`
  only ever renders it as "coming soon," same as API Configuration/Account & Billing/Usage —
  confirmed by reading the source markup, same finding Phase 2 made for Activity Logs before
  adding its tab). This phase explicitly requires wiring it, so a minimal 5-field form
  (Company Name/Address/Phone/Email/Website) was added — new UI, the same class of deliberate
  addition Phase 4 made for Data Management's "Upload Data" step. Stored in `company_settings`
  under `key='company'`; General under `key='general'` — both are `jsonb` blobs merged over
  hardcoded defaults on read, so adding a field later needs no migration.
- **Password reset verifies the old password by re-running `signInWithPassword`** on the same
  session-bound client before calling `updateUser` — there's no dedicated "verify current
  password" Auth endpoint, so this is the only way to confirm it without a second stored
  credential. A stolen session cookie alone still can't change the password without knowing
  the old one.
- **Activity logging added for the 5 of 6 action types that weren't writing rows** (audited via
  `grep -r activity_logs lib/ app/api/` before touching anything): assignment (`insertAssignment`,
  now the single write path every auto-distribute/manual/reassign call goes through) and
  reassignment (same call, `logAction: "reassignment"`, so the two are distinguishable in the
  log even though they share one code path); bulk delete (`softDeleteCandidates`, one summary
  row per batch — same shape as the pre-existing `data_transfer` row, which was refactored to
  use the same new `lib/activityLog.ts` helper for consistency); role/permission changes
  (`role_created`/`role_updated`/`role_deleted`, added directly in the three `/api/roles*`
  route handlers since that's where the logic already lives); imports (`import_confirmed`,
  end of `confirmImport`); rechurn initiation (`rechurn_initiate`, one summary row per
  `/api/rechurn/initiate` call, on top of — not instead of — the per-application
  `reassignment` rows `initiateSpecificOwner`'s own `reassign()` calls already write). Data
  transfer and login/logout already wrote rows (Phase 4 and Phase 2 respectively) and were
  left as-is beyond the `data_transfer` refactor above. Retention: **not implemented** — no
  window was confirmed with Vivek this session, and the checkpoint explicitly says not to
  invent a number; `calls`/B2 recordings were never touched (only ever read from, same as
  every prior phase).
- **Login rate limiting**: 5 attempts / 60s per `(client IP, email)` pair, in-memory
  (`lib/rateLimit.ts`, same "single Next.js instance, no Redis in the stack" reasoning
  `lib/permissions.ts`'s profile cache already used) — keyed on the pair rather than IP alone
  so one shared office IP can't lock out every user from one attacker targeting a single
  account, and rather than email alone so an attacker can't fan a credential-stuffing attempt
  out across many guessed emails from one IP to dodge the limit. Verified live: 6 rapid wrong-
  password attempts against the same email returned 401×5 then `429 rate_limited` with a
  `Retry-After` header.
- **Full permissions audit (Step 5), swept against the live dev server, not just read from
  code** — every route in claude.md's API Structure table checked against its actual
  `requirePermission`/`getCurrentUserProfile` gate, then live-tested signed out / as recruiter
  Ayesha Khan / as admin Rakshit Verma:
  - **Real gap found and fixed**: `GET /api/permissions` only checked authentication, not the
    `admin` claude.md's table specifies — not a documented decision anywhere (unlike the two
    below), and nothing in the app calls this route today (the Roles & Permissions page reads
    `permissions` directly via its own server component), so gating it on `view_all_records`
    broke nothing. Verified live: 403 for Ayesha, 200 with data for Rakshit, 307-redirect
    signed out.
  - **Documentation drift found and reconciled the other direction**: `GET /api/team/live-status`
    claude.md's table says `manager+`, but the route has been intentionally open to any signed-in
    user since Phase 2 ("not sensitive per-user data... any authenticated user can read it," and
    Phase 2's own As-Built Notes list Team Live Status among the nav items deliberately left
    ungated). Since this was an explicit, already-documented decision — not drift — claude.md's
    table was corrected to say "any (see Phase 2 notes)" rather than changing working code to
    match a table entry that was never actually the intent.
  - **The other 9 flagged routes** (`follow-ups/calendar`, `auth/logout`, `auth/me`,
    `auth/login`, `calls`, `candidates/:id/calls`, `recruiters/:id`, `interactions`,
    `dashboard`) were each individually confirmed to already match claude.md's own stated
    "any"/"any (scoped)"/"public"/"self, or view_all_records" designation, gated correctly via
    `getCurrentUserProfile()` (auth-only) with RLS doing the actual per-row scoping, or (for
    `recruiters/:id`) an explicit self-or-view_all_records check in the route itself. None
    needed a code change.
  - **Two routes claude.md documents but the codebase never built**: `GET /api/health`
    (flagged as missing since Phase 0/1 — "add the actual route as part of Phase 1's
    scaffold" — and apparently just never done; already allowlisted in
    `lib/supabase/middleware.ts`'s `PUBLIC_PATHS`, confirming it was anticipated) was added
    now, since it's trivial and zero-risk — verified live, 200 unauthenticated. `GET/POST
    /api/applications` (list/create) was **not** added: application creation already happens
    inline inside `POST /api/candidates` (candidate + its first application in one insert,
    Phase 3), no UI anywhere calls for a second, standalone application-creation surface for
    an existing candidate, and building unused API surface during a security-hardening phase
    is scope creep claude.md's own conventions warn against. Flagged for Phase 8's
    reconciliation pass rather than silently left as an unexplained table/code mismatch.
  - **No hardcoded role-name check found** anywhere in `app/api` (`grep` for
    `roleName ===`/`role ===`/literal role-name string comparisons returned nothing) —
    every gate goes through `requirePermission`/`profile.permissions.includes`.
  - **RLS re-verified independently**, not just re-read: signed in as Ayesha Khan and queried
    `/api/candidates` directly — 3 rows, versus 14 as Rakshit (Admin), consistent with the
    scoping Phase 3's own self-audit established (the exact count has shifted from Phase 3's
    "2" as seed data changed across phases; the *scoping*, not the absolute number, is what
    this checkpoint verifies).
  - **`calls` table confirmed unaltered**: still exactly 3 rows, same as Phase 0's original
    count — no test in this phase wrote to it (nothing in this phase had a reason to; it's
    read-only for the CRM per claude.md).
- **`npx tsc --noEmit` clean** throughout; targeted `eslint` runs on every touched file clean
  (a whole-repo `eslint .` invocation reports thousands of pre-existing errors, but all of them
  are in `.next/`'s generated build output, not source — confirmed by grepping the output for
  real file paths).
- **Self-audit run against the live dev server** (ports 3001 then 3002, after the first
  instance silently wedged mid-session and had to be restarted — a dev-server/tooling issue,
  not a code bug, caught by every route suddenly returning an empty 200 body instead of JSON
  and a clean restart fixing it immediately), signed in as both Rakshit Verma (Admin) and
  Ayesha Khan (recruiter): every WhatsApp Templates CRUD operation (create/edit/duplicate-via-
  create/delete/visibility-filter) round-tripped correctly; Notification Settings and
  General/Company/Activity Logs persisted across GET after PATCH and were confirmed 403 for
  Ayesha; Password reset was tested end-to-end on a real account (Rakshit: wrong-old-password
  rejected, weak-new-password rejected per rule, correct change accepted, new password
  confirmed to log in, then reverted to the original — verified via a second real login) rather
  than mocked; a real manual-assign→reassign→revert cycle confirmed both `assignment` and
  `reassignment` rows land with correct actor/entity/metadata; a real role create→delete cycle
  confirmed `role_created`/`role_deleted` rows. All test mutations (general/company/notification
  values, the throwaway WhatsApp template, the throwaway role, the manual-assign/reassign
  cycle) were reverted or deleted afterward, confirmed via a final `GET` matching the pre-test
  state — same discipline Phase 4's As-Built Notes established for cleanup.
- **Still open / deliberately out of scope**: activity-log retention window (no number
  confirmed with Vivek — checkpoint 4 explicitly says mark this blocked rather than invent
  one); `GET/POST /api/applications` (see above, flagged for Phase 8); Phase 8
  (navigation gap + full re-verification) and Phase 9 (per-page filter audit) untouched.

## Phase 8 — As-Built Notes (read before Phase 9)

- **Step 1 — navigation gap fixed.** Per your explicit choice (adding a new sidebar group
  over candidate-detail-only links, since the latter leaves Clients/Assignment/Reports
  with no click path at all), `components/Sidebar.tsx` gained a new **RECRUITMENT** group
  (Jobs/Clients/Recruiters/Assignment/Reports) between the main nav and TEMPLATES — the 4
  pre-existing groups (TEMPLATES/CONFIGURATION/ADMINISTRATION plus the un-grouped main
  list) are untouched, same order, same items. Permission-gated the same way every other
  item is (`manage_jobs`/`manage_clients`/`view_all_records`/`manage_assignment`/
  `view_all_records`, matching each route's actual guard) — the whole group hides itself
  for a caller with none of those five, rather than rendering an orphaned header. Verified
  live: Admin's rendered sidebar HTML contains all 5 links plus the header in the correct
  position; recruiter Ayesha Khan's contains neither the header nor any of the 5 links.
- **Step 2 — claude.md reconciled against live reality**, each item verified via direct
  query rather than assumed:
  - `pipeline_templates`: confirmed still 2 rows (Default Pipeline/8 stages, Bulk Hiring
    Pipeline/5 stages) — Phase 3 already fixed this; the Phase 0 as-built note claiming it
    "unsatisfiable" was stale (never updated after Phase 3 landed) and now has a resolution
    pointer.
  - **5 Open Questions**: already fully resolved with recorded answers (not just
    recommendations) from a prior pass — verified each of the 5 entries under "Open
    Questions" above states a concrete `RESOLVED` decision, not a deferred one. Nothing to
    do here beyond confirming it.
  - **`calls` table status — per your explicit answer: test/staging only**, not connected
    to real Android production traffic. This means every Phase 5/6 checkpoint that read
    `calls` was validated against synthetic seed data (3 rows), not real call volume — a
    narrower claim than "verified in production," now recorded here rather than left
    ambiguous.
  - **Schema spot-check**: compared claude.md's Data Schema block against a live
    `list_tables` (verbose) call for `candidates`, `users`, `clients`, `jobs`,
    `notification_settings`, `company_settings`, `activity_logs`, `whatsapp_templates`.
    One real drift found and fixed: `candidates.deleted_at` (added by migration 0029 in
    Phase 4) was never added to the schema block itself, only mentioned in Phase 4's
    as-built prose — now listed on `candidates` directly. The other 7 tables matched
    exactly.
  - **API Structure table precision pass**: while sweeping permissions (Step 4 below),
    found several table rows using a single blanket label (`admin`/`manager+`) for a route
    whose GET and POST/PATCH actually have different, intentionally different gates — not
    bugs, just a table that predates the granular permission-key system being fully used.
    Corrected: `/api/team` (GET: any, RLS read-all · POST: `manage_team`), `/api/roles` and
    `/api/roles/:id` (GET: any · write: `manage_roles_permissions`), and the three
    `/api/analytics/*` routes (all actually gated on `view_analytics`, which both seeded
    roles hold, with per-caller scoping inside the query — not `manager+`-only as written).
    `/api/team/live-status` was already corrected to "any" in Phase 7 Step 5; left as-is.
- **Step 3 — re-verification against the live app, not re-read code**, time-boxed to the
  brief's own highest-priority items rather than mechanically re-running every phase's
  entire checklist a second time (which Phase 7's own Step 5 and this phase's Step 4
  already substantially re-cover for permissions specifically):
  - ✅ **Request Reports**: submitted a real report (`Customers`, 2026-08-01→2026-09-04)
    as Admin — `report_requests` had 0 rows at last audit; this call landed with
    `status: "ready"` and a real generated CSV `file_url` (base64 data URI, decoded and
    spot-checked: real candidate rows, correct columns). First genuine end-to-end proof
    this path works, left in place as real usage data (not a throwaway test artifact).
  - ✅ **Team Live Status / null `live_status`**: `abhi@gmail.com` (`liveStatus: null`,
    `liveStatusSince: null`) returns cleanly from `GET /api/team/live-status` and the
    `/team-live-status` page renders "Abhi" with no application error — confirmed this
    specific edge case doesn't break the board.
  - ✅ **Dashboard/Analytics sanity vs. direct DB query**: `GET /api/dashboard?range=last30`
    reproduced Phase 6's own recorded self-audit numbers exactly (3 calls, 2 connected,
    `avgTalkSeconds: 213`, 14 candidates-with-an-application, `unassigned: 5`,
    `pendingFollowUps: 7`) — no drift since Phase 6.
  - **Not re-run**: a full second click-through of every phase's entire Final Checklist as
    both roles. Given the volume of already-verified, unchanged screens (Phases 3-6 each
    already ran their own live self-audit against real HTTP + direct DB queries, documented
    above), re-doing all of it here would mostly re-prove things that haven't changed since
    those phases landed, rather than surface new information — flagged explicitly rather
    than silently claimed as done.
- **Step 4 — independent second-pass permission sweep**, genuinely re-run (not copied from
  Phase 7's results), covering routes Phase 7 Step 5's sweep didn't individually hit:
  `/api/jobs`, `/api/clients`, `/api/team`, `/api/data/bulk-delete`, `/api/analytics/overall`,
  `/api/roles`, `/api/recruiters` in all 3 states (signed out → 307 via the documented
  middleware redirect, same standing-in-for-401 behavior noted since Phase 3; wrong
  permission → 403; correct permission → 200), plus two POST routes
  (`/api/data/bulk-delete`, `/api/jobs`) specifically to confirm a permission failure never
  falls through to a 500. Every result matched claude.md's (now-corrected) table with no
  disagreement against Phase 7's own findings.
- **Step 5 — data volume stress test**, synthetic (real Android volume isn't available —
  Step 2's "test/staging only" answer): bulk-inserted 60 throwaway candidates (77 total,
  74 visible through `deleted_at is null` filtering — the other 3 are pre-existing
  soft-deleted rows from Phase 4/7 testing, correctly still excluded at this volume too),
  re-ran Candidates pagination at `pageSize=50`: page 1 returned exactly 50 rows, page 2
  returned exactly 24, zero id overlap between the two pages, `50+24=74` matching `total`
  exactly. Dashboard's stage-bucket/status percentages were unaffected (correctly — they're
  computed over `applications`, and the synthetic rows had none), confirming they don't
  silently double-count bare candidates. All 60 synthetic rows deleted afterward
  (`candidates` back to 17, confirmed). **Not re-run**: the concurrent auto-distribute
  race-condition test — Phase 4 already proved it with genuinely concurrent (backgrounded,
  not sequential) requests and nothing in `lib/assignment.ts`'s concurrency-safety path
  (the partial unique index + always-attempt-insert pattern) has changed since, so
  re-running it would exercise identical code against an identical guarantee.
- **`npx tsc --noEmit` clean** after the Sidebar change.
- **Still open / deliberately out of scope**: a full second click-through of every phase's
  checklist as multiple roles (see Step 3 above — narrowed to the brief's own priority
  items instead); real Android call volume (blocked on Step 2's "test/staging" answer, not
  something this session can produce); Phase 9 (per-page filter audit) untouched.

## Phase 9 — As-Built Notes

Full results in `filter-audit-findings.md`, per this phase's own instruction to compile a
findings file rather than fix issues inline. Method: real HTTP requests against the live
dev server, cross-checked against direct Supabase queries wherever a number could be
independently verified — not a browser click-through (no browser tool available this
session), but functionally equivalent for every filter that's a URL/query parameter, which
is all of them except a handful of pure client-state controls (noted individually as
code-reviewed-only in the findings file).

**7 non-✅ items found, none fixed inline** (this phase's own rule): Allocations'
"Selected Users" filter is mislabeled (no real per-user picker exists behind it); Jobs/
Clients/Recruiters have no search or sort at all; Reports has no filter controls at all;
Analytics' Conversion Funnel only covers the Default Pipeline template, silently excluding
the 3 jobs on Bulk Hiring Pipeline (pre-existing, already flagged in `lib/pipeline.ts`'s own
comment and `ui-gaps.md` item 15 — not new); "Customers By (Select Field)" and the User
Performance tab are intentional placeholders (prior explicit sign-off); Team Live Status'
Call Tracking/Call Recording/Version filters are decorative (no backing schema, single
"Any" option, no handler).

Everything else tested — Dashboard's 4 tabs, Candidates, Allocations' other 4 filters,
Interactions, Assignment (including a live round_robin-vs-load_balanced distinctness
re-test, reverted after), Call Logs, Follow-Ups/Calendar/Recurring, Rechurn, Team, and the
Phase-7-wired Settings/Notifications/WhatsApp/Request Reports surface — came back ✅,
matching direct DB queries everywhere a number was checkable.
