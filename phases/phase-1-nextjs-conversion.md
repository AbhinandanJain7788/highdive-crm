# Phase 1 — HTML → Next.js Conversion

## Objective
Convert the signed-off `Recruitment_CRM__standalone__.html` into a Next.js App Router project, screen for screen, pixel for pixel. **No Supabase wiring in this phase.** The seed arrays from the HTML move into local mock files and keep driving the UI, so the app looks and behaves exactly as approved before any data is connected.

## Context
Phase 0 built the database. The HTML UI is final and signed off — it is the source of truth for every screen, label, colour, and interaction. This phase is a *translation*, not a redesign.

**The single rule for this phase: do not change the design.** No "improvements," no restyling, no re-ordering nav, no renaming labels. If something looks wrong, list it in Step 5 instead of fixing it unilaterally.

## Step 1 — Project Setup & Design System

### What to do
Scaffold Next.js (App Router, TypeScript) with the folder structure from claude.md. Extract the global styles from the HTML: primary `#FF5C35`, app background `#FFF5F2`, the font stack, and the bundled woff2 fonts. Build the shared shell — sidebar, topbar with search ("Search by Name/Phone"), user avatar/initial, and the "Signed in as / role label" block.

Sidebar structure exactly as in the HTML, in this order and grouping:
- (ungrouped) Dashboard, Allocations, Customers, Interactions, Follow-Ups, Calendar, Call Logs, Recurring Follow-Ups, Request Reports, Rechurn Customers, Team Live Status, Analytics
- **TEMPLATES** — Whatsapp
- **CONFIGURATION** — Notifications, Data Management
- **ADMINISTRATION** — Team, Roles & Permissions, Settings

### Checkpoint 1
- [ ] Next.js project runs with the folder structure from claude.md
- [ ] Sidebar renders all 18 items in the exact order and grouping above, with the three section headers
- [ ] Primary `#FF5C35` and background `#FFF5F2` match the HTML exactly
- [ ] Topbar search, user initial, and role label render as in the HTML

## Step 2 — Mock Data Layer

### What to do
Move every seed array out of the HTML into `/lib/mock/*.ts` with typed exports, using the types generated in Phase 0 so the shapes already match the real schema: `candidatesSeed`, `callLogsSeed`, `jobsSeed`, `clientsSeed`, `usersSeed`, `teamRowsSeed`, `teamLiveSeed`, `followUpsSeed`, `waTemplatesSeed`, `importDedupSeed`, `rolesSeed`, `userStatusAlertsSeed`, `allocationAssignmentSeed`.

Keep the derived logic as pure functions, mirroring the HTML: allocations `new` = candidate with no recruiter; `attempted` = has recruiter and ≥1 call excluding terminal statuses; interactions = candidates with ≥1 call.

### Checkpoint 2
- [ ] All 13 seed arrays live in `/lib/mock` with types matching the Phase 0 schema
- [ ] Allocation and interaction derivation functions return the same counts the HTML shows
- [ ] No component holds inline seed data

## Step 3 — Recruitment Screens

### What to do
Convert these routes, each matching its HTML view exactly:

| Route | HTML view | Must include |
|---|---|---|
| `/candidates` | `candidates` | Table with avatar, name, phone, DUP badge, status, recruiter, created on, source; Import CSV + Add Customer buttons |
| `/candidates/[id]` | candidate detail | Header, Assigned Recruiter, Applied For, Source, Resume, Notes, Call History table (Date/By/Duration/Disposition/Recording), Schedule Follow-up |
| `/jobs` | `jobs` | Job title, client, status, openings, applications, created on |
| `/jobs/[id]` | job detail | Pipeline Breakdown by stage + Candidates in this Job |
| `/clients` | `clients` | Company, contact, industry, active jobs, account manager |
| `/clients/[id]` | client detail | Contact block + Jobs with this Client |
| `/recruiters` | `recruiters` | Live status, assigned, calls today, conversion % |
| `/recruiters/[id]` | recruiter detail | Stats + Assigned Candidates + Recent Call Activity |
| `/assignment` | `assignment` | Auto-Distribute / Manual Assign tabs, Round Robin / Load Balanced, candidate checkboxes, Distribute Selected (n), Recruiter Workload bars |
| `/import` | `importFlow` | Upload CSV → Review Possible Duplicates (New Entry vs Existing Match, Skip/Import Anyway) → Confirm Import → Import Complete |
| `/reports` | `reports` | Pipeline Funnel, Call Outcomes, Calls by Recruiter |

### Checkpoint 3
- [ ] All 11 routes render with mock data and match the HTML visually
- [ ] Candidate detail Call History renders the disabled state for calls with no recording
- [ ] Import flow steps through all 4 stages with the dedup comparison rendering both sides
- [ ] Assignment screen's "Distribute Selected (n)" count updates as rows are checked

## Step 4 — Runo-Derived Screens

### What to do
Convert the remaining views:

| Route | HTML view | Must include |
|---|---|---|
| `/dashboard` | `dashboard` | Today/Y'day/Last 7/Last 30 tabs; Overall/Outbound/Inbound totals; Connected/Not Connected/Personal with %; Avg + Total Talk Time; Open Actions (unassigned, followups, missed calls); Total Candidates with status buckets |
| `/allocations` | `allocations` | New / Attempted tabs, filters, table, row count |
| `/interactions` | `interactions` | Table with status, interacted on, sourced by, assigned by, assign to; rows per page 10/25/50 |
| `/follow-ups` | `followUps` | Pending / Upcoming tabs, empty state "No follow-ups to display" |
| `/calendar` | `calendar` | Month grid with per-day counts, side panel of that day's follow-ups, empty state |
| `/call-logs` | `callLogs` | Outgoing/Incoming, caller, called at, duration, disposition, AI Score column, Play Recording, **Attribute to Job** with job select + Link, and "No unattributed calls" empty state |
| `/recurring-follow-ups` | `recurringFollowUps` | Pending/Upcoming counts, View Schedule, History, "No Data to display" |
| `/request-reports` | `requestReports` | Basic/Advanced tabs, report type list, date+time range with AM/PM, Request Report |
| `/rechurn` | `rechurn` | Filters, Get Count, Matched Customers, Assign in Common Pool / Change owner, Initiate |
| `/team-live-status` | `teamLiveStatus` | Live status board with Call Tracking / Call Recording / Version filters and sort |
| `/analytics` | `analytics` | Overall / AI Call Analytics / User Performance tabs; Call Trends chart, Total Talk time chart, Login Analytics, Top 5 User Performances, Customer Stages, Conversion Funnel, Customers By |
| `/whatsapp-templates` | `whatsappTemplates` | Template cards, Create New, detail panel with Edit/Duplicate/Delete and preview |
| `/notifications` | `notifications` | User Status alerts (with value + Hours/Minutes) and Allocation Assignment toggles |
| `/data-management` | `dataManagement` | Bulk Import/Export/Delete/Clean-up/Transfer tabs; 2-step Configure Upload → Upload Data with process and upload type (Allocations max 20k / Customers max 20k) |
| `/team` | `team` | Active/Inactive/Invited tabs, Add User, table with mobile, email, processes, reports to, role, add-ons, created on |
| `/roles-permissions` | `rolesPermissions` | Add a Role, role table with permission chips + "+n More", users, created on |
| `/settings` | `settings` + sub-views | General (Limit Assign To, WhatsApp Notifications, Manual Log out), Account (password reset with the 4 rules), plus Company Details / API Configuration / Account & Billing / Usage / Activity Logs |
| `/login` | login | Email, password, forgot password, error slot, "Super Admin · Recruitment Manager · Recruiter access" |

### Checkpoint 4
- [ ] All 18 routes render with mock data and match the HTML
- [ ] Every "coming soon" placeholder in the HTML is preserved as-is, not implemented
- [ ] Analytics charts render with the mock values, including the avg(39.3) reference line
- [ ] Calendar day cells show follow-up counts and clicking a date updates the side panel
- [ ] All empty states from the HTML are reproduced verbatim

## Step 5 — Gap List (do not fix, just report)

### What to do
Produce `ui-gaps.md` listing anything the UI implies but does not yet cover, for Vivek to decide on. Start from these known items, then add anything found during conversion:
1. **AI Score / AI Call Analytics** — present but stubbed (`aiScoreLabel: '--'`, "coming soon"), while AI is out of scope. Remove or leave disabled?
2. **"Customers" vs "Candidates"** — same entity, two labels across screens. Unify the wording or keep both?
3. **Disposition vocabulary** — UI shows Connected / Not Connected / Busy / Switched Off; the live DB enum is interested / callback_later / not_reachable. Needs a decision before Phase 5.
4. **Multi-job candidates** — the UI shows one job per candidate row; what displays when a candidate has several applications?
5. **Recruiters vs Team** — two user-facing screens over the same `users` table; confirm both are wanted.
6. No screens exist for creating/editing a Job or Client — only lists and details. Confirm whether create/edit modals are needed.

### Checkpoint 5
- [ ] `ui-gaps.md` exists with all 6 items above plus anything else found
- [ ] No gap was silently "fixed" in the UI during conversion
- [ ] Each item states which phase it blocks

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
5. Only say "Phase 1 Complete" when every checkbox is green.

## Final Phase 1 Checklist
- [ ] All 29 routes converted and visually matching the signed-off HTML
- [ ] Shared shell, sidebar grouping, and brand colours identical to the HTML
- [ ] All seed data moved to `/lib/mock` with Phase 0 types
- [ ] Zero Supabase calls anywhere in the codebase
- [ ] `ui-gaps.md` delivered for client decisions
- [ ] Self-audit passed with all green
- [ ] Manual verification done by architect
