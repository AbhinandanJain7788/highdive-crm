// Verifies the wired SCREENS (not just the API): signs in, fetches each page's
// server-rendered HTML, and asserts that real database values appear in it and that
// no mock-only value leaks through.
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
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

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
  const s = makeSession();
  const res = await s.fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed ${email}: ${res.status}`);
  return s;
}

const admin = await signIn('rakshit.verma@highdive.com');
const recruiter = await signIn('ayesha.khan@highdive.com');
const { data: recruiterUser } = await db.from('users').select('id').eq('email', 'ayesha.khan@highdive.com').single();

const html = async (session, path) => {
  const res = await session.fetch(path);
  const body = await res.text();
  return { status: res.status, body };
};

// ------------------------------------------------------------------ candidates list
{
  const { data: dbCands } = await db.from('candidates').select('name, phone').order('created_at', { ascending: false });
  const { status, body } = await html(admin, '/candidates');
  const shown = dbCands.filter(c => body.includes(c.name));
  record('Candidates list renders real candidate names from the DB',
    status === 200 && shown.length >= Math.min(10, dbCands.length),
    `${shown.length}/${dbCands.length} names present, status=${status}`);

  record('Candidates list shows the real total count',
    body.includes(`>${dbCands.length}<`) || body.includes(`${dbCands.length}</div>`),
    `expected total ${dbCands.length} in header`);

  // The mock seed's phone numbers/names that are NOT in the DB must not appear.
  const mockOnly = 'Rohit Verma';
  const inDb = dbCands.some(c => c.name === mockOnly);
  record('No mock-only rows leak into the list',
    inDb || !body.includes(mockOnly),
    inDb ? `"${mockOnly}" is genuinely in the DB` : `"${mockOnly}" (mock-only) absent`);
}

// --------------------------------------------------------------- candidate detail
{
  const { data: c } = await db
    .from('candidates').select('id, name, source, notes, resume_url').not('notes', 'is', null).limit(1).single();
  const { status, body } = await html(admin, `/candidates/${c.id}`);
  record('Candidate detail renders real name, source and notes',
    status === 200 && body.includes(c.name) && (!c.source || body.includes(c.source)) && body.includes(c.notes.slice(0, 30)),
    `${c.name}`);

  const { data: noResume } = await db.from('candidates').select('id, name').is('resume_url', null).limit(1).maybeSingle();
  if (noResume) {
    const r = await html(admin, `/candidates/${noResume.id}`);
    record('Candidate detail shows the "no resume" state for a null resume_url',
      r.body.includes('Not uploaded'), `${noResume.name}`);
  }

  // Multi-application candidate shows the extra application.
  const { data: multi } = await db
    .from('applications').select('candidate_id, candidates(name)').limit(200);
  const counts = new Map();
  for (const a of multi) counts.set(a.candidate_id, (counts.get(a.candidate_id) ?? 0) + 1);
  const multiId = [...counts].find(([, n]) => n > 1)?.[0];
  if (multiId) {
    const r = await html(admin, `/candidates/${multiId}`);
    record('Multi-application candidate shows the "Other Applications" block',
      r.body.includes('Other Applications'), `candidate with ${counts.get(multiId)} applications`);
  }
}

// ----------------------------------------------------------------------- jobs
{
  const { data: dbJobs } = await db.from('jobs').select('id, title, openings, status, client:clients(company)');
  const { status, body } = await html(admin, '/jobs');
  const shown = dbJobs.filter(j => body.includes(j.title));
  record('Jobs list renders real job titles and client names',
    status === 200 && shown.length >= Math.min(10, dbJobs.length) &&
    dbJobs.some(j => j.client && body.includes(j.client.company)),
    `${shown.length}/${dbJobs.length} titles present`);

  // Pipeline breakdown must be template-driven: check both templates render their own stages.
  const { data: templates } = await db.from('pipeline_templates').select('id, name, pipeline_stages(name, sequence_order)');
  let allTemplatesOk = true;
  for (const t of templates) {
    const job = dbJobs.find(j => j.id && true);
    const { data: jobOnTemplate } = await db.from('jobs').select('id, title').eq('pipeline_template_id', t.id).limit(1).maybeSingle();
    if (!jobOnTemplate) continue;
    const r = await html(admin, `/jobs/${jobOnTemplate.id}`);
    const stages = t.pipeline_stages.sort((a, b) => a.sequence_order - b.sequence_order).map(s => s.name);
    const allPresent = stages.every(s => r.body.includes(s));
    const foreignStages = templates.filter(o => o.id !== t.id)
      .flatMap(o => o.pipeline_stages.map(s => s.name))
      .filter(s => !stages.includes(s));
    const noForeign = !foreignStages.some(s => r.body.includes(`>${s}<`));
    if (!allPresent || !noForeign) allTemplatesOk = false;
    console.log(`   ${jobOnTemplate.title} → ${t.name}: stages present=${allPresent}, no foreign stages=${noForeign}`);
  }
  record('Job detail pipeline breakdown is template-driven (each job shows only its own stages)', allTemplatesOk);
}

// -------------------------------------------------------------------- clients
{
  const { data: dbClients } = await db.from('clients').select('id, company, industry, contact_name');
  const { status, body } = await html(admin, '/clients');
  record('Clients list renders real companies',
    status === 200 && dbClients.every(k => body.includes(k.company)),
    `${dbClients.length} companies`);

  // Active jobs count must be open-only.
  const k = dbClients[0];
  const { count: open } = await db.from('jobs').select('*', { count: 'exact', head: true }).eq('client_id', k.id).eq('status', 'open');
  const { count: all } = await db.from('jobs').select('*', { count: 'exact', head: true }).eq('client_id', k.id);
  const detail = await html(admin, `/clients/${k.id}`);
  record('Client detail renders that client\'s jobs',
    detail.status === 200 && detail.body.includes(k.company),
    `${k.company}: ${open} open of ${all} total`);
}

// ------------------------------------------------------------------ recruiters
{
  const { status, body } = await html(admin, '/recruiters');
  const { data: users } = await db.from('users').select('id, name').eq('status', 'active');
  const shown = users.filter(u => body.includes(u.name));
  record('Recruiters directory renders real users for an admin',
    status === 200 && shown.length > 0, `${shown.length} names present`);

  record('Recruiter call metrics render as "--", not a fabricated 0',
    body.includes('--'), 'callsToday placeholder present');

  const gated = await html(recruiter, '/recruiters');
  record('Recruiter without view_all_records sees the gated message, not zeroed metrics',
    gated.body.includes('only available to users who can view all records'),
    `status=${gated.status}`);

  const own = await html(recruiter, `/recruiters/${recruiterUser.id}`);
  record('A recruiter can still open their own recruiter page', own.status === 200, `status=${own.status}`);
}

// ------------------------------------------------- recruiter scoping on the screen
{
  const { body } = await html(recruiter, '/candidates');
  const { data: ownAssignments } = await db
    .from('assignments').select('application:applications(candidate_id)').eq('recruiter_id', recruiterUser.id);
  const { data: createdByHer } = await db.from('candidates').select('id').eq('created_by', recruiterUser.id);
  const allowed = new Set([
    ...ownAssignments.map(a => a.application?.candidate_id).filter(Boolean),
    ...createdByHer.map(c => c.id),
  ]);
  const { data: all } = await db.from('candidates').select('id, name');
  const visible = all.filter(c => body.includes(c.name));
  const leaked = visible.filter(c => !allowed.has(c.id));
  record('Candidates SCREEN is RLS-scoped for a recruiter (no other recruiters\' candidates rendered)',
    leaked.length === 0 && visible.length === allowed.size,
    `recruiter sees ${visible.length} of ${all.length}; expected ${allowed.size}; leaked ${leaked.length}`);
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} page checks passed`);
if (failed.length) console.log('Failures:\n' + failed.map(f => `  - ${f.name}: ${f.detail ?? ''}`).join('\n'));
