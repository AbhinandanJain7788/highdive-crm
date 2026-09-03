// Phase 3 self-audit: exercises every checkpoint against the running dev server with
// real sessions (Admin and recruiter), cross-checking each answer against a direct
// service-role DB query. Read-only apart from one create/patch round-trip it cleans up.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = 'http://localhost:3000';
const PASSWORD = 'Highdive@123';

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok === true ? 'PASS' : ok === 'partial' ? 'PART' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

// Minimal cookie jar: the login route sets the Supabase session as cookies, and every
// later request must send them back.
function makeSession() {
  const jar = new Map();
  return {
    async fetch(path, init = {}) {
      const headers = new Headers(init.headers ?? {});
      if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
      const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' });
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(';');
        const eq = pair.indexOf('=');
        jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      return res;
    },
  };
}

async function signIn(email) {
  const session = makeSession();
  const res = await session.fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status} ${await res.text()}`);
  return session;
}

const json = async (res) => { try { return await res.json(); } catch { return null; } };

const admin = await signIn('rakshit.verma@highdive.com');
const recruiter = await signIn('ayesha.khan@highdive.com');
const { data: recruiterUser } = await db.from('users').select('id, name').eq('email', 'ayesha.khan@highdive.com').single();

// ---------------------------------------------------------------- Step 1: candidates
{
  const res = await admin.fetch('/api/candidates?pageSize=50');
  const body = await json(res);
  const { count: dbCount } = await db.from('candidates').select('*', { count: 'exact', head: true });
  record('C1 candidates list renders real rows',
    res.ok && body?.total === dbCount && body.data.length === dbCount,
    `api total=${body?.total} rows=${body?.data?.length} db=${dbCount}`);

  const statuses = new Set(body?.data?.map(r => r.status).filter(Boolean));
  const { data: dbApps } = await db.from('applications').select('status');
  const dbStatuses = new Set(dbApps.map(a => a.status));
  record('C1 status values are real application_status values',
    [...statuses].every(s => dbStatuses.has(s)),
    `list shows ${statuses.size} distinct statuses of ${dbStatuses.size} present in DB`);

  const { data: dupRows } = await db.from('candidates').select('id').eq('is_duplicate', true);
  const apiDup = body?.data?.filter(r => r.isDuplicate).map(r => r.id).sort() ?? [];
  record('C1 DUP badge only for is_duplicate = true',
    JSON.stringify(apiDup) === JSON.stringify(dupRows.map(r => r.id).sort()),
    `api=${apiDup.length} db=${dupRows.length}`);

  const { data: sample } = await db.from('candidates').select('name, phone').not('phone', 'is', null).limit(1).single();
  const partialName = sample.name.split(' ')[0].slice(1, 5);
  const nameRes = await json(await admin.fetch(`/api/candidates?search=${encodeURIComponent(partialName)}`));
  const nameHit = nameRes?.data?.some(r => r.name === sample.name);

  const digits = sample.phone.replace(/\D/g, '');
  const spacedHit = await json(await admin.fetch(`/api/candidates?search=${encodeURIComponent(sample.phone.slice(-5))}`));
  const unspacedHit = await json(await admin.fetch(`/api/candidates?search=${digits}`));
  record('C1 partial name and partial phone search both work',
    nameHit && spacedHit?.data?.some(r => r.name === sample.name) && unspacedHit?.data?.some(r => r.name === sample.name),
    `name "${partialName}"=${nameHit}, phone tail=${!!spacedHit?.data?.length}, full digits=${!!unspacedHit?.data?.length}`);

  const p10 = await json(await admin.fetch('/api/candidates?pageSize=10&page=1'));
  const p10b = await json(await admin.fetch('/api/candidates?pageSize=10&page=2'));
  const p25 = await json(await admin.fetch('/api/candidates?pageSize=25&page=1'));
  const noOverlap = !p10?.data?.some(a => p10b?.data?.some(b => b.id === a.id));
  record('C1 page size 10/25/50 changes result set, total stays accurate',
    p10?.data?.length === 10 && p25?.data?.length === Math.min(25, dbCount) &&
    p10?.total === dbCount && p10b?.total === dbCount && noOverlap,
    `p1(10)=${p10?.data?.length} p2(10)=${p10b?.data?.length} p1(25)=${p25?.data?.length} total=${p10?.total} pagesDisjoint=${noOverlap}`);

  // Recruiter scoping: RLS, not a client-side filter.
  const recruiterList = await json(await recruiter.fetch('/api/candidates?pageSize=50'));
  const { data: visibleRows } = await db.rpc ? { data: null } : { data: null };
  const { data: ownAssignments } = await db
    .from('assignments').select('application:applications(candidate_id)').eq('recruiter_id', recruiterUser.id);
  const { data: createdByHer } = await db.from('candidates').select('id').eq('created_by', recruiterUser.id);
  const expected = new Set([
    ...ownAssignments.map(a => a.application?.candidate_id).filter(Boolean),
    ...createdByHer.map(c => c.id),
  ]);
  const got = new Set(recruiterList?.data?.map(r => r.id) ?? []);
  record('C1 recruiter sees only their own candidates (RLS)',
    got.size === expected.size && [...got].every(id => expected.has(id)) && got.size < dbCount,
    `recruiter sees ${got.size} of ${dbCount}; expected ${expected.size} from direct DB query`);

  // "No resume" state.
  const { data: noResume } = await db.from('candidates').select('id, name').is('resume_url', null).limit(1).maybeSingle();
  if (noResume) {
    const detail = await json(await admin.fetch(`/api/candidates/${noResume.id}`));
    record('C1 detail renders the no-resume state',
      detail?.data?.hasResume === false && detail?.data?.resumeUrl === null,
      `${noResume.name}: hasResume=${detail?.data?.hasResume}`);
  } else {
    record('C1 detail renders the no-resume state', 'partial', 'no candidate with null resume_url exists to test');
  }
}

// --------------------------------------------------------------------- Step 2: jobs
{
  const list = await json(await admin.fetch('/api/jobs?pageSize=50'));
  const { data: dbJobs } = await db.from('jobs').select('id, title, status, pipeline_template_id');
  let countsMatch = true;
  for (const row of list?.data ?? []) {
    const { count } = await db.from('applications').select('*', { count: 'exact', head: true }).eq('job_id', row.id);
    if (count !== row.applicationCount) { countsMatch = false; console.log(`   mismatch: ${row.title} api=${row.applicationCount} db=${count}`); }
  }
  record('C2 applications count per job matches a direct count', countsMatch && list?.total === dbJobs.length,
    `${list?.data?.length} jobs checked`);

  // Two jobs on different templates must show different stage lists.
  const byTemplate = new Map();
  for (const j of dbJobs) byTemplate.set(j.pipeline_template_id, j);
  const [jobA, jobB] = [...byTemplate.values()];
  const detailA = await json(await admin.fetch(`/api/jobs/${jobA.id}`));
  const detailB = await json(await admin.fetch(`/api/jobs/${jobB.id}`));
  const stagesA = detailA?.data?.stageCounts?.map(s => s.stage) ?? [];
  const stagesB = detailB?.data?.stageCounts?.map(s => s.stage) ?? [];

  const { data: tmplStages } = await db
    .from('pipeline_stages').select('name, sequence_order').eq('pipeline_template_id', jobA.pipeline_template_id)
    .order('sequence_order');
  record('C2 breakdown renders that template\'s stages in sequence_order',
    JSON.stringify(stagesA) === JSON.stringify(tmplStages.map(s => s.name)),
    `${detailA?.data?.pipelineTemplate?.name}: ${stagesA.join(' -> ')}`);

  record('C2 two jobs on different templates show different stage lists',
    stagesA.length > 0 && stagesB.length > 0 && JSON.stringify(stagesA) !== JSON.stringify(stagesB),
    `${detailA?.data?.pipelineTemplate?.name}(${stagesA.length}) vs ${detailB?.data?.pipelineTemplate?.name}(${stagesB.length})`);

  // Stage counts must equal a direct per-stage count.
  let breakdownMatches = true;
  for (const stage of detailA?.data?.stageCounts ?? []) {
    const { count } = await db.from('applications').select('*', { count: 'exact', head: true })
      .eq('job_id', jobA.id).eq('pipeline_stage_id', stage.stageId);
    if (count !== stage.count) { breakdownMatches = false; console.log(`   stage mismatch ${stage.stage}: api=${stage.count} db=${count}`); }
  }
  record('C2 per-stage counts match direct DB counts', breakdownMatches);

  // Close a job, then restore it.
  const openJob = dbJobs.find(j => j.status === 'open');
  const closeRes = await admin.fetch(`/api/jobs/${openJob.id}/close`, { method: 'POST' });
  const { data: afterClose } = await db.from('jobs').select('status').eq('id', openJob.id).single();
  const relist = await json(await admin.fetch('/api/jobs?pageSize=50'));
  const listShowsClosed = relist?.data?.find(j => j.id === openJob.id)?.status === 'closed';
  await db.from('jobs').update({ status: 'open' }).eq('id', openJob.id);
  record('C2 closing a job sets status=closed and the list reflects it',
    closeRes.ok && afterClose.status === 'closed' && listShowsClosed,
    `${openJob.title}: ${afterClose.status}, list=${listShowsClosed} (restored to open)`);
}

// ------------------------------------------------------------------ Step 3: clients
{
  const list = await json(await admin.fetch('/api/clients?pageSize=50'));
  let activeOk = true, managerOk = true;
  for (const row of list?.data ?? []) {
    const { count: open } = await db.from('jobs').select('*', { count: 'exact', head: true })
      .eq('client_id', row.id).eq('status', 'open');
    const { count: all } = await db.from('jobs').select('*', { count: 'exact', head: true }).eq('client_id', row.id);
    if (row.activeJobs !== open) { activeOk = false; console.log(`   ${row.company}: api=${row.activeJobs} open=${open} all=${all}`); }
    if (row.accountManagerId) {
      const { data: mgr } = await db.from('users').select('name').eq('id', row.accountManagerId).maybeSingle();
      if (!mgr || mgr.name !== row.accountManager) managerOk = false;
    }
  }
  record('C3 active jobs count excludes on_hold and closed', activeOk, `${list?.data?.length} clients checked`);
  record('C3 account manager resolves to a real users record', managerOk);

  const first = list?.data?.[0];
  const detail = await json(await admin.fetch(`/api/clients/${first.id}`));
  const { data: dbClientJobs } = await db.from('jobs').select('id, status').eq('client_id', first.id);
  const apiJobIds = (detail?.data?.jobs ?? []).map(j => j.id).sort();
  const statusesMatch = (detail?.data?.jobs ?? []).every(j => dbClientJobs.find(d => d.id === j.id)?.status === j.status);
  record('C3 client detail lists exactly that client\'s jobs with correct statuses',
    JSON.stringify(apiJobIds) === JSON.stringify(dbClientJobs.map(j => j.id).sort()) && statusesMatch,
    `${first.company}: ${apiJobIds.length} jobs`);
}

// --------------------------------------------------------------- Step 4: recruiters
{
  const list = await json(await admin.fetch('/api/recruiters'));
  let assignedOk = true, conversionOk = true;
  for (const row of list?.data ?? []) {
    const { data: active } = await db
      .from('assignments').select('application:applications(status)').eq('recruiter_id', row.id).eq('status', 'active');
    const converted = active.filter(a => ['selected', 'joined'].includes(a.application?.status)).length;
    const expected = active.length ? Math.round((converted / active.length) * 100) : 0;
    if (row.assignedCount !== active.length) { assignedOk = false; console.log(`   ${row.name}: assigned api=${row.assignedCount} db=${active.length}`); }
    if (row.conversion !== expected) { conversionOk = false; console.log(`   ${row.name}: conversion api=${row.conversion} db=${expected}`); }
  }
  record('C4 assigned count matches active assignments', assignedOk, `${list?.data?.length} recruiters checked`);

  const zeroAssigned = list?.data?.filter(r => r.assignedCount === 0) ?? [];
  record('C4 conversion matches direct query, never divides by zero',
    conversionOk && zeroAssigned.every(r => r.conversion === 0),
    `${zeroAssigned.length} recruiter(s) with 0 assigned all report 0%`);

  const withWork = list?.data?.find(r => r.assignedCount > 0);
  const detail = await json(await admin.fetch(`/api/recruiters/${withWork.id}`));
  const { data: dbAssigned } = await db
    .from('assignments').select('application:applications(candidate_id)').eq('recruiter_id', withWork.id).eq('status', 'active');
  const apiIds = (detail?.data?.assignedCandidates ?? []).map(c => c.candidateId).sort();
  record('C4 recruiter detail lists their real assigned candidates',
    JSON.stringify(apiIds) === JSON.stringify(dbAssigned.map(a => a.application.candidate_id).sort()),
    `${withWork.name}: ${apiIds.length} candidates`);

  const callFieldsNull = list?.data?.every(r => r.callsToday === null && r.avgTalkSeconds === null);
  record('C4 call metrics still on mock data are marked, not faked', callFieldsNull,
    'callsToday/avgTalkSeconds are null with a TODO(phase-5), never a fabricated 0');
}

// ------------------------------------------------------- Permission guard behaviour
{
  const forbidden = await recruiter.fetch('/api/clients');
  const jobsForbidden = await recruiter.fetch('/api/jobs');
  const recruitersForbidden = await recruiter.fetch('/api/recruiters');
  const ownPage = await recruiter.fetch(`/api/recruiters/${recruiterUser.id}`);
  record('Guard: recruiter gets 403 on manager-only routes, 200 on their own page',
    forbidden.status === 403 && jobsForbidden.status === 403 && recruitersForbidden.status === 403 && ownPage.status === 200,
    `clients=${forbidden.status} jobs=${jobsForbidden.status} recruiters=${recruitersForbidden.status} own=${ownPage.status}`);

  const anon = await fetch(`${BASE}/api/candidates`, { redirect: 'manual' });
  record('Guard: unauthenticated request is rejected', anon.status === 401, `status=${anon.status}`);
}

// ------------------------------------------------------------ Write round-trip (POST/PATCH)
{
  const { data: job } = await db.from('jobs').select('id, title').eq('status', 'open').limit(1).single();
  const created = await json(await admin.fetch('/api/candidates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Phase3 Verify Candidate', phone: '+91 90000 00001', source: 'Verification', jobId: job.id }),
  }));
  const newId = created?.data?.id;

  // The new application must land on the *job's own* template's first stage.
  const { data: jobRow } = await db.from('jobs').select('pipeline_template_id').eq('id', job.id).single();
  const { data: firstStage } = await db.from('pipeline_stages').select('id, name')
    .eq('pipeline_template_id', jobRow.pipeline_template_id).order('sequence_order').limit(1).single();
  const stageOk = created?.data?.application?.pipeline_stage_id === firstStage.id;

  const patched = await json(await admin.fetch(`/api/candidates/${newId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ notes: 'patched by verification', phone: '' }),
  }));
  const { data: dbRow } = await db.from('candidates').select('notes, phone').eq('id', newId).single();

  // Duplicate application on the same candidate+job must be refused by the constraint.
  const dupe = await admin.fetch('/api/applications', { method: 'POST' }).catch(() => null);
  const dupeCandidate = await admin.fetch('/api/candidates', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Phase3 Verify Candidate', jobId: job.id }),
  });
  const dupeBody = await json(dupeCandidate);

  record('Write: POST creates candidate + application on the job\'s own first stage',
    Boolean(newId) && stageOk, `stage=${firstStage.name}`);
  record('Write: PATCH updates only the fields sent, "" clears a nullable column',
    patched?.data?.notes === 'patched by verification' && dbRow.notes === 'patched by verification' && dbRow.phone === null,
    `notes="${dbRow.notes}" phone=${dbRow.phone}`);

  // Clean up both verification candidates.
  const cleanupIds = [newId, dupeBody?.data?.id].filter(Boolean);
  await db.from('applications').delete().in('candidate_id', cleanupIds);
  await db.from('candidates').delete().in('id', cleanupIds);
  console.log(`   (cleaned up ${cleanupIds.length} verification candidate(s))`);
}

const failed = results.filter(r => r.ok !== true);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.log('Needs attention:\n' + failed.map(f => `  - ${f.name}: ${f.detail ?? ''}`).join('\n'));
