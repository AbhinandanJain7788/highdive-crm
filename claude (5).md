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
GET  /api/analytics/overall             call trends, talk time, stages, funnel          manager+
GET  /api/analytics/login               login duration analytics                        manager+
GET  /api/analytics/top-users           top 5 user performances                         manager+

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
GET/POST  /api/team                     list (active|inactive|invited) / add user       admin
PATCH     /api/team/:id                 update user                                     admin
GET       /api/team/live-status         live status board                               manager+
PATCH     /api/users/me/live-status     set own status                                  any
GET/POST  /api/roles                    list / create role                              admin
GET/PATCH /api/roles/:id                role detail / edit permissions                  admin
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
