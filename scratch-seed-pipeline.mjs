// Seeds a second pipeline template so Phase 3 Checkpoint 2 ("two jobs using
// different pipeline templates show different stage lists") is actually testable.
// Idempotent: re-running makes no further changes.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');

const TEMPLATE_NAME = 'Bulk Hiring Pipeline';
// Deliberately shorter and differently named than the 8-stage Default Pipeline:
// a high-volume flow for field/support roles. Different length AND different names
// is what makes the "not hardcoded" checkpoint meaningful.
const STAGES = [
  { name: 'Sourced', sequence_order: 1, is_terminal: false },
  { name: 'Screened', sequence_order: 2, is_terminal: false },
  { name: 'Interview', sequence_order: 3, is_terminal: false },
  { name: 'Offer', sequence_order: 4, is_terminal: false },
  { name: 'Joined', sequence_order: 5, is_terminal: true },
];
const JOB_TITLES = ['Field Sales Executive', 'Customer Support Associate', 'Warehouse Supervisor'];

// Same status -> stage inference Phase 0 used, expressed against the new stage set.
const STAGE_FOR_STATUS = {
  new: 'Sourced',
  contacted: 'Screened',
  not_interested: 'Screened',
  no_response: 'Screened',
  rejected: 'Screened',
  interview_scheduled: 'Interview',
  interview_done: 'Interview',
  selected: 'Offer',
  joined: 'Joined',
};

const die = (label, error) => { if (error) { console.error(label, error); process.exit(1); } };

let { data: template, error } = await sb
  .from('pipeline_templates').select('id, name').eq('name', TEMPLATE_NAME).maybeSingle();
die('lookup template', error);

if (template) {
  console.log(`Template "${TEMPLATE_NAME}" already exists (${template.id}) — no insert.`);
} else if (DRY_RUN) {
  console.log(`[dry-run] would create template "${TEMPLATE_NAME}" with ${STAGES.length} stages`);
} else {
  const inserted = await sb
    .from('pipeline_templates').insert({ name: TEMPLATE_NAME, is_default: false }).select('id, name').single();
  die('insert template', inserted.error);
  template = inserted.data;
  console.log(`Created template "${TEMPLATE_NAME}" (${template.id})`);

  const stageRows = STAGES.map(s => ({ ...s, pipeline_template_id: template.id }));
  const stagesInserted = await sb.from('pipeline_stages').insert(stageRows).select('id, name');
  die('insert stages', stagesInserted.error);
  console.log(`Created ${stagesInserted.data.length} stages: ${stagesInserted.data.map(s => s.name).join(' -> ')}`);
}

if (DRY_RUN && !template) {
  console.log('[dry-run] stopping — later steps need the real template id');
  process.exit(0);
}

const { data: stages, error: stagesError } = await sb
  .from('pipeline_stages').select('id, name').eq('pipeline_template_id', template.id);
die('load stages', stagesError);
const stageIdByName = new Map(stages.map(s => [s.name, s.id]));

const { data: jobs, error: jobsError } = await sb
  .from('jobs').select('id, title, pipeline_template_id').in('title', JOB_TITLES);
die('load jobs', jobsError);

for (const job of jobs) {
  if (job.pipeline_template_id === template.id) {
    console.log(`"${job.title}" already on ${TEMPLATE_NAME} — skipped.`);
    continue;
  }
  if (DRY_RUN) { console.log(`[dry-run] would move "${job.title}" to ${TEMPLATE_NAME}`); continue; }

  const moved = await sb.from('jobs').update({ pipeline_template_id: template.id }).eq('id', job.id);
  die(`move job ${job.title}`, moved.error);

  // An application's stage must belong to its job's template, or the breakdown
  // silently drops it. Re-point every application on this job at the equivalent
  // stage in the new template.
  const { data: apps, error: appsError } = await sb
    .from('applications').select('id, status').eq('job_id', job.id);
  die('load applications', appsError);

  for (const app of apps) {
    const stageId = stageIdByName.get(STAGE_FOR_STATUS[app.status]);
    const updated = await sb.from('applications').update({ pipeline_stage_id: stageId }).eq('id', app.id);
    die('remap application stage', updated.error);
  }
  console.log(`Moved "${job.title}" to ${TEMPLATE_NAME} and remapped ${apps.length} application(s).`);
}

const { data: summary } = await sb
  .from('pipeline_templates').select('name, is_default, pipeline_stages(name), jobs(title)');
console.log('\nFinal state:');
for (const t of summary) {
  console.log(`  ${t.name}${t.is_default ? ' (default)' : ''}: ${t.pipeline_stages.length} stages, ${t.jobs.length} jobs`);
}
