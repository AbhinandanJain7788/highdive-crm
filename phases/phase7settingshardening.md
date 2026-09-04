# Phase 7 — Templates, Settings, Notifications & Hardening

## Objective
Wire the remaining configuration surface — WhatsApp templates, notification settings, general and account settings, company details, activity logs — then close out production readiness with a full permissions audit across every route.

## Context
Phases 2–6 built and wired every operational screen. This phase finishes the configuration modules and hardens the system before launch. It is last because the permissions audit needs every route to exist first.

## ⚠️ As-Found State (code audit, 2026-09-04) — read this before starting

A direct audit of the live repo (github.com/AbhinandanJain7788/highdive-crm) and the live Supabase project confirmed **this phase has not been started**, despite Phases 2–6 all having real commits and real Supabase wiring:

- `app/(app)/settings/page.tsx`, `app/(app)/notifications/page.tsx`, and `app/(app)/whatsapp-templates/page.tsx` are all still pure `useState` over `lib/mock/*` seed data — no `fetch`, no Supabase import, in any of the three.
- There is no `app/api/notification-settings`, no `app/api/settings/*` (general, password, company, activity-logs), and no `app/api/whatsapp-templates` route anywhere in the codebase.
- The live DB confirms it: `notification_settings`, `company_settings` both have **0 rows** — nothing has ever written to them.
- **Security issue found and must be fixed as part of this phase, not skipped**: `.env.example` was committed with a real, live Supabase `service_role` key (bypasses RLS) instead of a placeholder, in a now-public repo. If not already rotated, rotate it in Supabase (Project Settings → API) before doing anything else, update `.env.local`/Vercel, and fix `.env.example` to use a placeholder value. This is now folded into Step 0 below so it isn't missed.
- Separately (tracked for Phase 8, not this phase): Jobs/Clients/Recruiters/Assignment/Reports are fully built and wired but have no sidebar entry — `ui-gaps.md` item #7. Not fixed here to keep this phase scoped to the configuration surface, but flagged so it isn't mistaken for part of this phase's job.

## Step 0 — Security Cleanup (do this first, blocks everything else)

### What to do
Confirm the `service_role` key has been rotated in Supabase. If not, rotate it now, update `.env.local` and the Vercel project's environment variables with the new value, redeploy, and replace the real values in `.env.example` with placeholders (`your-service-role-key-here` etc). Commit the placeholder fix.

### Checkpoint 0
- [ ] `service_role` key rotated (confirm the old key no longer works)
- [ ] `.env.local` and Vercel env vars updated with the new key; app still boots and can query Supabase
- [ ] `.env.example` contains no real secret values, only placeholders, committed
- [ ] `git log` confirms no other file in the repo contains a real key (`grep -r "service_role\|eyJhbGci" .` across tracked files, excluding `.env.local`)

## Step 1 — WhatsApp Templates

### What to do
Wire `/whatsapp-templates` to `GET/POST /api/whatsapp-templates` and `PATCH`/`DELETE /api/whatsapp-templates/:id`: the card grid with name, visibility badge, truncated preview, and Created By; the Process and Visibility filters; Create New; and the detail panel with Edit, Duplicate, Delete and the full template preview. Visibility uses the `template_visibility` enum (all / process / private) with process scoping.

Templates contain placeholders such as `[Candidate Name]` and `[Your Name]` — store them literally. Do not implement substitution or WhatsApp sending unless Vivek confirms an integration, which is out of scope here.

Follow the pattern already established correctly in Phases 3–6: a typed query file in `/lib` (e.g. `lib/whatsappTemplates.ts` + a `.shared.ts` if client-side filtering logic is needed, matching `lib/allocations.ts`/`lib/allocations.shared.ts`), `requirePermission` in the route handler, and the client component doing a real `fetch` instead of importing from `lib/mock`.

### Checkpoint 1
- [ ] Template cards render real rows with correct visibility badges
- [ ] The preview truncates in the card and shows in full in the detail panel
- [ ] Create, Edit, Duplicate, and Delete all persist correctly
- [ ] A `process`-scoped template is invisible to users in a different process
- [ ] Placeholder tokens are stored and displayed literally, unsubstituted
- [ ] `lib/mock/waTemplatesSeed` import is removed from the page component entirely

## Step 2 — Notification Settings

### What to do
Wire `/notifications` to `GET/PATCH /api/notification-settings`, backed by `notification_settings`. Two groups from the HTML: **User Status** alerts (e.g. Break Time Alert with a numeric value and an Hours/Minutes unit) and **Allocation Assignment** toggles (e.g. notify when an allocation is assigned through APIs). Values persist per key, with org defaults where `user_id` is null.

### Checkpoint 2
- [ ] Every alert in the HTML has a corresponding `notification_settings` row
- [ ] Changing a threshold value and its Hours/Minutes unit persists and survives reload
- [ ] Toggling an allocation assignment setting persists
- [ ] Org defaults apply to users with no personal override
- [ ] `lib/mock/notifications` (`userStatusAlertsSeed`/`allocationAssignmentSeed`) import is removed from the page component entirely

## Step 3 — Settings & Company Configuration

### What to do
Wire `/settings`: **General** (Limit Assign To option in CRM, WhatsApp Notifications, Manual Log out Settings with Allow Log out on Mobile / Web) to `GET/PATCH /api/settings/general` backed by `company_settings`. **Account** password reset to `POST /api/settings/password` via Supabase Auth, enforcing the four rules the HTML lists: 8–15 characters, an uppercase character, a number, a special character (the client-side validation already exists in `app/(app)/settings/page.tsx` — reuse it, just wire the submit to a real endpoint instead of nothing).

Wire Company Details to `GET/PATCH /api/settings/company` and Activity Logs to `GET /api/settings/activity-logs` reading `activity_logs`. Keep API Configuration, Account & Billing, and Usage as the "coming soon" placeholders the HTML defines.

### Checkpoint 3
- [ ] Each General toggle persists to `company_settings` and survives reload
- [ ] Password reset enforces all four rules client-side and is executed through Supabase Auth
- [ ] A password failing any rule is rejected with the HTML's existing validation display
- [ ] Activity Logs shows real entries with actor, action, and timestamp
- [ ] Placeholder sub-views remain placeholders

## Step 4 — Activity Logging & Rate Limiting

### What to do
Write `activity_logs` entries for every consequential action across the app: assignment and reassignment, bulk delete, data transfer, role and permission changes, imports, and rechurn initiation. Add rate limiting to `/api/auth/login`. There are no call-ingestion endpoints to protect — the CRM never accepts call writes.

The live DB currently shows only 10 `activity_logs` rows against 11 assignments + 3 import batches + more — audit which of the six action types are actually writing entries today (Phases 4–6 may have partially done this already) versus which need to be added here.

Confirm a data retention window with Vivek before implementing any retention job, and explicitly exclude the `calls` table and B2 recordings from it unless he says otherwise — that data belongs to the existing Android pipeline.

### Checkpoint 4
- [ ] Each of the six action types above writes an `activity_logs` row with correct actor and entity — verified individually, not assumed from a partial existing count
- [ ] Login rate limiting rejects rapid repeated attempts from one source
- [ ] Retention is implemented against a confirmed window, or this checkpoint is explicitly marked blocked — do not invent a number
- [ ] Retention explicitly excludes `calls` and B2 recordings

## Step 5 — Full Permissions Audit

### What to do
Sweep every route in claude.md's API Structure and verify its stated permission is actually enforced. This is a complete pass, not a spot check — permissions were built incrementally since Phase 2 and need one confirmation that nothing drifted. Check both directions: every documented route is enforced, and no undocumented route exists.

The code audit found 11 of 50 existing API routes with no `requirePermission` call: `permissions`, `follow-ups/calendar`, `auth/logout`, `auth/me`, `auth/login`, `team/live-status`, `calls`, `candidates/[id]/calls`, `recruiters/[id]`, `interactions`, `dashboard`. Some of these are intentionally ungated per claude.md's own Phase 2 notes (Dashboard, Team Live Status) and rely on `getCurrentUserProfile()` + RLS instead — confirm each one individually against claude.md's API table rather than assuming the whole list is a bug.

Re-verify RLS independently: sign in as a recruiter, query Supabase directly, and confirm only their own rows return.

### Checkpoint 5
- [ ] Every route in claude.md has a passing test for its stated permission
- [ ] Each of the 11 routes listed above has been individually confirmed as intentionally-ungated (with the claude.md citation) or fixed with a `requirePermission` call
- [ ] No route exists in the codebase that is absent from claude.md's API Structure
- [ ] A recruiter querying Supabase directly sees only their own candidates, applications, calls, and follow-ups
- [ ] No route handler anywhere checks a hardcoded role name instead of a permission key
- [ ] The live `calls` table remains unaltered — final structure and row-count check against Phase 0 Step 1

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
5. Only say "Phase 7 Complete" when every checkbox is green.

## Final Phase 7 Checklist
- [ ] Service-role key rotated and no real secrets remain in the repo
- [ ] WhatsApp templates fully functional with process and visibility scoping
- [ ] Notification settings, General, Account, Company Details, and Activity Logs all live
- [ ] Activity logging covering every consequential action; login rate limited
- [ ] Full permissions audit swept in both directions with no drift
- [ ] Self-audit passed with all green
- [ ] Manual verification done by architect
