# Phase 7 — Templates, Settings, Notifications & Hardening

## Objective
Wire the remaining configuration surface — WhatsApp templates, notification settings, general and account settings, company details, activity logs — then close out production readiness with a full permissions audit across every route.

## Context
Phases 2–6 built and wired every operational screen. This phase finishes the configuration modules and hardens the system before launch. It is last because the permissions audit needs every route to exist first.

## Step 1 — WhatsApp Templates

### What to do
Wire `/whatsapp-templates` to `GET/POST /api/whatsapp-templates` and `PATCH`/`DELETE /api/whatsapp-templates/:id`: the card grid with name, visibility badge, truncated preview, and Created By; the Process and Visibility filters; Create New; and the detail panel with Edit, Duplicate, Delete and the full template preview. Visibility uses the `template_visibility` enum (all / process / private) with process scoping.

Templates contain placeholders such as `[Candidate Name]` and `[Your Name]` — store them literally. Do not implement substitution or WhatsApp sending unless Vivek confirms an integration, which is out of scope here.

### Checkpoint 1
- [ ] Template cards render real rows with correct visibility badges
- [ ] The preview truncates in the card and shows in full in the detail panel
- [ ] Create, Edit, Duplicate, and Delete all persist correctly
- [ ] A `process`-scoped template is invisible to users in a different process
- [ ] Placeholder tokens are stored and displayed literally, unsubstituted

## Step 2 — Notification Settings

### What to do
Wire `/notifications` to `GET/PATCH /api/notification-settings`, backed by `notification_settings`. Two groups from the HTML: **User Status** alerts (e.g. Break Time Alert with a numeric value and an Hours/Minutes unit) and **Allocation Assignment** toggles (e.g. notify when an allocation is assigned through APIs). Values persist per key, with org defaults where `user_id` is null.

### Checkpoint 2
- [ ] Every alert in the HTML has a corresponding `notification_settings` row
- [ ] Changing a threshold value and its Hours/Minutes unit persists and survives reload
- [ ] Toggling an allocation assignment setting persists
- [ ] Org defaults apply to users with no personal override

## Step 3 — Settings & Company Configuration

### What to do
Wire `/settings`: **General** (Limit Assign To option in CRM, WhatsApp Notifications, Manual Log out Settings with Allow Log out on Mobile / Web) to `GET/PATCH /api/settings/general` backed by `company_settings`. **Account** password reset to `POST /api/settings/password` via Supabase Auth, enforcing the four rules the HTML lists: 8–15 characters, an uppercase character, a number, a special character.

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

Confirm a data retention window with Vivek before implementing any retention job, and explicitly exclude the `calls` table and B2 recordings from it unless he says otherwise — that data belongs to the existing Android pipeline.

### Checkpoint 4
- [ ] Each of the six action types above writes an `activity_logs` row with correct actor and entity
- [ ] Login rate limiting rejects rapid repeated attempts from one source
- [ ] Retention is implemented against a confirmed window, or this checkpoint is explicitly marked blocked — do not invent a number
- [ ] Retention explicitly excludes `calls` and B2 recordings

## Step 5 — Full Permissions Audit

### What to do
Sweep every route in claude.md's API Structure and verify its stated permission is actually enforced. This is a complete pass, not a spot check — permissions were built incrementally since Phase 2 and need one confirmation that nothing drifted. Check both directions: every documented route is enforced, and no undocumented route exists.

Re-verify RLS independently: sign in as a recruiter, query Supabase directly, and confirm only their own rows return.

### Checkpoint 5
- [ ] Every route in claude.md has a passing test for its stated permission
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
- [ ] WhatsApp templates fully functional with process and visibility scoping
- [ ] Notification settings, General, Account, Company Details, and Activity Logs all live
- [ ] Activity logging covering every consequential action; login rate limited
- [ ] Full permissions audit swept in both directions with no drift
- [ ] Self-audit passed with all green
- [ ] Manual verification done by architect
