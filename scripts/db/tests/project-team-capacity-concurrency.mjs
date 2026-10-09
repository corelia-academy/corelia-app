import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// This test only connects to the isolated local Docker database.
const args = ['exec', '-i', 'supabase_db_corelia-app', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'];
const sql = input => execFileSync('docker', args, { input, encoding: 'utf8', timeout: 20_000 }).trim();
const project = randomUUID();
const owner = randomUUID();
const members = Array.from({ length: 6 }, randomUUID);
const sessions = [];
function session(input) {
  const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  sessions.push(child);
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => resolve({ code, output }));
  });
  child.stdin.write(input);
  return { child, done, output: () => output };
}
async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await delay(50);
  }
  throw new Error('Timed out waiting for concurrent capacity test');
}
let created = false;
try {
  sql(`INSERT INTO auth.users(id) VALUES ${[owner, ...members].map(id => `('${id}')`).join(',')};
    INSERT INTO public.projects(id,owner_id,slug,title,source_type,visibility) VALUES('${project}','${owner}','team-race-${project}','Capacity race','standalone','private');
    INSERT INTO public.project_collaborators(project_id,user_id) VALUES ${members.slice(0, 4).map(id => `('${project}','${id}')`).join(',')};`);
  created = true;
  const invites = members.slice(4).map(member => JSON.parse(sql(`BEGIN; SELECT set_config('request.jwt.claim.sub','${owner}',true); SET LOCAL ROLE authenticated; SELECT public.create_project_collaboration_invite('${project}','${member}'); COMMIT;`).split('\n').at(-1)).invite_id);
  const accept = i => `SELECT set_config('request.jwt.claim.sub','${members[i + 4]}',true); SET LOCAL ROLE authenticated; SELECT public.accept_project_collaboration_invite_by_id('${invites[i]}');`;
  const first = session(`BEGIN; ${accept(0)} SELECT 'seat-held';\n`);
  await until(() => first.output().includes('seat-held'));
  const appName = `capacity-race-${project}`;
  const second = session(`SET application_name='${appName}'; BEGIN; ${accept(1)} COMMIT;\n`);
  second.child.stdin.end();
  await until(() => sql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${appName}' AND wait_event_type='Lock';`) === '1');
  first.child.stdin.end('COMMIT;\n');
  assert.equal((await first.done).code, 0);
  const rejected = await second.done;
  assert.notEqual(rejected.code, 0);
  assert.match(rejected.output, /project_team_full/);
  assert.equal(sql(`SELECT count(*) FROM public.project_collaborators WHERE project_id='${project}';`), '5');
  assert.equal(sql(`SELECT count(*) FROM public.project_collaboration_invites WHERE project_id='${project}' AND status='accepted';`), '1');
  console.log('PASS: concurrent last-seat acceptances serialize; only one joins the six-person team');
} finally {
  for (const child of sessions) if (child.exitCode === null) child.kill('SIGTERM');
  if (created) sql(`DELETE FROM public.email_outbox_events WHERE idempotency_key IN (SELECT id::text FROM public.project_collaboration_invites WHERE project_id='${project}'); DELETE FROM public.projects WHERE id='${project}'; DELETE FROM auth.users WHERE id IN (${[owner, ...members].map(id => `'${id}'`).join(',')});`);
}
