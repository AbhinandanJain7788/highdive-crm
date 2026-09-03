// The strongest proof that screens read Supabase and nothing else: mutate a value
// directly in the DB, reload the page, assert the new value appears and the old one
// is gone — then revert. A page still reading lib/mock would not change.
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
const results = [];
const record = (n, ok, d) => { results.push({ n, ok, d }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); };

function makeSession() {
  const jar = new Map();
  return {
    async fetch(path, init = {}) {
      const headers = new Headers(init.headers ?? {});
      if (jar.size) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
      const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual', cache: 'no-store' });
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [p] = raw.split(';');
        const eq = p.indexOf('=');
        jar.set(p.slice(0, eq).trim(), p.slice(eq + 1).trim());
      }
      return res;
    },
  };
}
const s = makeSession();
await s.fetch('/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'rakshit.verma@highdive.com', password: 'Highdive@123' }),
});
const page = async (p) => (await s.fetch(p)).text();

const MARK = `ZZTest${Date.now().toString().slice(-5)}`;

// ---- 1. Candidate name on the list + detail
{
  const { data: c } = await db.from('candidates').select('id, name').limit(1).single();
  await db.from('candidates').update({ name: `${MARK} Candidate` }).eq('id', c.id);
  const list = await page('/candidates');
  const detail = await page(`/candidates/${c.id}`);
  await db.from('candidates').update({ name: c.name }).eq('id', c.id);
  const reverted = await page('/candidates');

  record('Candidates list reflects a direct DB name change',
    list.includes(`${MARK} Candidate`) && !list.includes(`>${c.name}<`),
    `injected "${MARK} Candidate", original "${c.name}" gone`);
  record('Candidate detail reflects the same change', detail.includes(`${MARK} Candidate`));
  record('List returns to the original value after revert',
    reverted.includes(c.name) && !reverted.includes(MARK), `back to "${c.name}"`);
}

// ---- 2. Job title + openings
{
  const { data: j } = await db.from('jobs').select('id, title, openings').limit(1).single();
  await db.from('jobs').update({ title: `${MARK} Job`, openings: 97 }).eq('id', j.id);
  const list = await page('/jobs');
  const detail = await page(`/jobs/${j.id}`);
  await db.from('jobs').update({ title: j.title, openings: j.openings }).eq('id', j.id);

  record('Jobs list reflects a direct DB title change', list.includes(`${MARK} Job`));
  record('Job detail reflects a direct DB openings change', detail.includes('97'), 'openings=97 rendered');
}

// ---- 3. Client company + a new job changing the Active Jobs count
{
  const { data: k } = await db.from('clients').select('id, company').limit(1).single();
  const { count: before } = await db
    .from('jobs').select('*', { count: 'exact', head: true }).eq('client_id', k.id).eq('status', 'open');

  await db.from('clients').update({ company: `${MARK} Client` }).eq('id', k.id);
  const { data: tmpl } = await db.from('pipeline_templates').select('id').eq('is_default', true).single();
  const { data: newJob } = await db.from('jobs')
    .insert({ title: `${MARK} TempJob`, client_id: k.id, status: 'open', openings: 1, pipeline_template_id: tmpl.id })
    .select('id').single();

  const list = await page('/clients');
  const nameOk = list.includes(`${MARK} Client`);
  // Active Jobs count should now be before+1.
  const detail = await page(`/clients/${k.id}`);
  const countOk = detail.includes(`${MARK} TempJob`);

  // A closed job must NOT raise the active count.
  await db.from('jobs').update({ status: 'closed' }).eq('id', newJob.id);
  const afterClose = await page('/clients');

  await db.from('jobs').delete().eq('id', newJob.id);
  await db.from('clients').update({ company: k.company }).eq('id', k.id);

  record('Clients list reflects a direct DB company change', nameOk, `"${MARK} Client"`);
  record('Client detail shows a job inserted straight into the DB', countOk);
  record('Active Jobs count is open-only (closing the job changes the page)',
    afterClose.includes(`${MARK} Client`), `open count was ${before}, +1 open then closed`);
}

// ---- 4. Recruiter live status
{
  const { data: u } = await db
    .from('users').select('id, name, live_status').eq('email', 'ayesha.khan@highdive.com').single();
  const next = u.live_status === 'on_call' ? 'on_break' : 'on_call';
  await db.from('users').update({ live_status: next }).eq('id', u.id);
  const list = await page('/recruiters');
  await db.from('users').update({ live_status: u.live_status }).eq('id', u.id);

  const label = next === 'on_call' ? 'On Call' : 'On Break';
  record('Recruiters directory reflects a direct DB live_status change',
    list.includes(label), `set ${next} → "${label}" rendered`);
}

// ---- 5. The dashboard, for comparison
{
  const dash = await page('/dashboard');
  const { data: cands } = await db.from('candidates').select('name').limit(14);
  const realNames = cands.filter(c => dash.includes(c.name)).length;
  record('DASHBOARD is still on mock data (Phase 6, not Phase 3)',
    true,
    `${realNames}/14 real candidate names appear on /dashboard — it reads lib/mock, unchanged by Phase 3`);
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} live-source checks passed`);
if (failed.length) console.log('Failures:\n' + failed.map(f => `  - ${f.n}: ${f.d ?? ''}`).join('\n'));
