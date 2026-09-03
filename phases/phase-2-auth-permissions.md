# Phase 2 — Auth, Roles, Permissions & Team

## Objective
Replace the mock user with real Supabase Auth, implement the granular role/permission model the Roles & Permissions screen requires, enforce it in both RLS and the app layer, and wire the Team and Team Live Status screens to real data.

## Context
Phase 0 created `users`, `roles`, `permissions`, `role_permissions`, `processes`. Phase 1 built every screen against mocks. This is the first phase that connects Next.js to Supabase — the pattern established here (server-side Supabase client, permission guard, typed query file per module) is the pattern every later phase follows.

Permissions come first because every subsequent phase depends on scoping being correct. Retrofitting access control later is the single most expensive mistake available on this build.

## Step 1 — Supabase Auth

### What to do
Wire `/login` to Supabase Auth. Do not hand-roll password hashing or JWT issuance. Implement `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` — where `me` returns the user profile joined to their role **and the flattened list of permission keys** from `role_permissions`. Set up the server-side Supabase client in `/lib/supabase` and protect the `(app)` route group with middleware that redirects unauthenticated users to `/login`. Wire the login error slot the HTML already defines.

### Checkpoint 1
- [ ] Login works for a seeded Super Admin, Recruitment Manager, and Recruiter
- [ ] `GET /api/auth/me` returns the resolved permission key list, not just a role name
- [ ] Visiting any `(app)` route while signed out redirects to `/login`
- [ ] A wrong password renders the HTML's existing error slot, not a crash or a new UI element
- [ ] No custom password hashing or JWT signing exists anywhere in the codebase

## Step 2 — Permission Guard & RLS

### What to do
Two layers, both required.

**RLS:** enable Row Level Security on every table from Phase 0, following the convention of the 6 policies already on `calls` (documented in Phase 0 Step 1). Recruiters may read only rows tied to an assignment they hold or held; managers and admins read all.

**App guard:** a `requirePermission(key)` helper used by every route handler, reading the permission keys from the session. Never check a role name — always a permission key, since roles are editable data.

Also wire the sidebar to hide items the user lacks permission for, and the "Signed in as / role label" block to the real role.

### Checkpoint 2
- [ ] A recruiter calling an admin-only route (e.g. `POST /api/roles`) gets 403, not 500 or silent success
- [ ] A recruiter querying Supabase directly, bypassing the app layer, still sees only their own assigned rows — proving RLS works independently of the guard
- [ ] Removing a permission from a role in the DB immediately changes what that user can call, with no code change and no redeploy
- [ ] Sidebar items the user lacks permission for are hidden
- [ ] No route handler anywhere checks a hardcoded role name

## Step 3 — Roles & Permissions Screen

### What to do
Wire `/roles-permissions` to real data: `GET/POST /api/roles`, `GET/PATCH /api/roles/:id`, `GET /api/permissions`. The table shows role name with its colour dot, permission chips with the "+n More" overflow, user count, and created on — exactly as the HTML renders it. "Add a Role" creates a role and assigns permissions.

### Checkpoint 3
- [ ] Roles table shows real roles with correct user counts computed from `users.role_id`
- [ ] Permission chips render from `role_permissions` with a correct "+n More" overflow count
- [ ] Creating a role with a subset of permissions persists, and a user assigned that role gets exactly those permissions
- [ ] A system role cannot be deleted if `is_system = true`

## Step 4 — Team & Live Status

### What to do
Wire `/team` to `GET/POST /api/team` and `PATCH /api/team/:id`: Active / Inactive / Invited tabs driven by `users.status`, with mobile, email, processes, reports to, role, add-ons, and created on. "Add User" invites via Supabase Auth and creates the `users` row with `status='invited'`.

Wire `/team-live-status` to `GET /api/team/live-status`, reading `users.live_status` and `live_status_since`, with the Call Tracking / Call Recording / Version filters and A-Z / Z-A sort the HTML defines. Add `PATCH /api/users/me/live-status` so a user can set their own status.

### Checkpoint 4
- [ ] Team tab counts (Active / Inactive / Invited) match direct DB counts by `users.status`
- [ ] Inviting a user creates both an `auth.users` entry and a `users` row with `status='invited'`
- [ ] Live Status board shows all four states (on_call / idle / on_break / offline) with the "Since:" duration computed from `live_status_since`
- [ ] Changing own live status updates the board for other users on refresh

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
5. Only say "Phase 2 Complete" when every checkbox is green.

## Final Phase 2 Checklist
- [ ] Supabase Auth live, with permissions resolved from `role_permissions` rather than role names
- [ ] RLS enforced independently of the app guard, verified by direct query
- [ ] Roles & Permissions screen fully functional with real create/edit
- [ ] Team and Team Live Status wired to real users
- [ ] Self-audit passed with all green
- [ ] Manual verification done by architect
