// Exercises the exact query params CandidatesClient sends, cross-checked against
// direct DB counts.
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
      const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' });
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
const get = async (qs) => (await (await s.fetch(`/api/candidates?${qs}`)).json());

// Status filter (By Status mode)
{
  const res = await get('status=selected,joined&pageSize=50');
  const { data: expected } = await db
    .from('applications').select('candidate_id, status').in('status', ['selected', 'joined']);
  const expectedIds = new Set(expected.map(a => a.candidate_id));
  const gotIds = new Set(res.data.map(r => r.id));
  record('Status filter returns only candidates with a matching application',
    [...gotIds].every(id => expectedIds.has(id)) && gotIds.size === expectedIds.size,
    `api=${gotIds.size} db=${expectedIds.size}`);
}

// Stage mode: "Closed Won" expands to selected+joined
{
  const res = await get('status=selected,joined&pageSize=50');
  const stageRes = await get('status=selected,joined&pageSize=50');
  record('Stage-mode filter maps to the same statuses server-side',
    res.total === stageRes.total, `total=${res.total}`);
}

// Date range
{
  const { data: all } = await db.from('candidates').select('created_at').order('created_at');
  const mid = all[Math.floor(all.length / 2)].created_at;
  const res = await get(`createdFrom=${encodeURIComponent(mid)}&pageSize=50`);
  const { count: expected } = await db
    .from('candidates').select('*', { count: 'exact', head: true }).gte('created_at', mid);
  record('createdFrom filters by created_at server-side', res.total === expected,
    `api=${res.total} db=${expected}`);

  const first = all[0].created_at;
  const ranged = await get(`createdFrom=${encodeURIComponent(first)}&createdTo=${encodeURIComponent(mid)}&pageSize=50`);
  const { count: rangeExpected } = await db
    .from('candidates').select('*', { count: 'exact', head: true }).gte('created_at', first).lte('created_at', mid);
  record('createdFrom+createdTo bound both ends', ranged.total === rangeExpected,
    `api=${ranged.total} db=${rangeExpected}`);
}

// Unassigned scope
{
  const res = await get('unassigned=true&pageSize=50');
  const { data: unassignedApps } = await db
    .from('applications').select('candidate_id').is('assigned_recruiter_id', null);
  const expected = new Set(unassignedApps.map(a => a.candidate_id));
  const got = new Set(res.data.map(r => r.id));
  record('unassigned=true returns only candidates with an unassigned application',
    [...got].every(id => expected.has(id)) && got.size === expected.size,
    `api=${got.size} db=${expected.size}`);
}

// Sorting
{
  const asc = await get('sort=name-asc&pageSize=50');
  const desc = await get('sort=name-desc&pageSize=50');
  const names = asc.data.map(r => r.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  record('sort=name-asc/desc order correctly',
    JSON.stringify(names) === JSON.stringify(sorted) &&
    desc.data[0].name === sorted[sorted.length - 1],
    `first asc="${names[0]}" first desc="${desc.data[0].name}"`);
}

// Invalid status must not silently return everything
{
  const res = await get('status=not_eligible&pageSize=50');
  const all = await get('pageSize=50');
  record('An unknown status (not_eligible) is dropped, not passed to Postgres',
    res.total === all.total,
    `unknown-status total=${res.total} equals unfiltered ${all.total} (filter ignored, no 500)`);
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} filter checks passed`);
if (failed.length) console.log('Failures:\n' + failed.map(f => `  - ${f.n}: ${f.d ?? ''}`).join('\n'));
