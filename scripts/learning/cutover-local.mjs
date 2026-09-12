import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Operational rehearsal on the disposable upgrade stack, never the app QA stack.
 * Kong is the only published HTTP ingress. Keeping it stopped rejects already-open
 * clients as well as new REST/RPC/Edge/Storage requests, without changing RLS/grants.
 */
export function createCutoverRehearsal({ workspace, sql, history, save }) {
  const project = 'corelia-learning-upgrade';
  const db = `supabase_db_${project}`, gateway = `supabase_kong_${project}`;
  assert(workspace.includes('corelia-learning-upgrade-'));
  const evidence = { mechanism: 'isolated Supabase HTTP ingress stopped; all API operations unavailable during maintenance', events: [] };
  let config, baselineHistory, backup, graphqlBootstrap = "", resumed = false;
  const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const record = (event, detail = {}) => evidence.events.push({ event, at: new Date().toISOString(), ...detail });
  const assertClosed = async () => {
    for (const path of ['/rest/v1/course_lessons?select=id', '/rest/v1/rpc/learning_quiz_submit', '/functions/v1/corelia-api?op=courses.syncCompletion', '/storage/v1/object/app/audit']) {
      let closed = false;
      try { await fetch(config.API_URL + path, { signal: AbortSignal.timeout(2500) }); }
      catch { closed = true; }
      assert(closed, `Maintenance ingress unexpectedly reachable: ${path}`);
    }
  };
  const readyIngressRead = async () => {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(config.API_URL + '/rest/v1/course_lessons?select=id&order=id', { signal: AbortSignal.timeout(2000), headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${config.ANON_KEY}` } });
        if (![502, 503].includes(response.status)) return response;
      } catch { /* Gateway startup can reset connections before it is ready. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error('Gateway did not become healthy within 15 seconds');
  };
  const internalRead = () => {
    // Keep local JWT material off command arguments and out of evidence/logs.
    const input = `url = "http://supabase_rest_${project}:3000/course_lessons?select=id&order=id"\nheader = "Authorization: Bearer ${config.ANON_KEY}"\n`;
    return JSON.parse(execFileSync('docker', ['exec', '-i', db, 'curl', '--silent', '--show-error', '--fail', '--retry', '8', '--retry-all-errors', '--retry-delay', '1', '--config', '-'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }));
  };
  const restore = () => {
    assert(!resumed, 'Restore is forbidden after ingress resumes; use a forward fix');
    const services = docker('ps', '--format', '{{.Names}}').trim().split('\n').filter(name => name.endsWith(`_${project}`) && name !== db && name !== gateway);
    if (services.length) docker('stop', ...services);
    try {
      docker('exec', db, 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -U supabase_admin -d template1 -v ON_ERROR_STOP=1 -c \'DROP DATABASE postgres WITH (FORCE);\'');
      // Restore the exact database name, extensions, ACLs and migration history.
      let restoreSQL = execFileSync('docker', ['exec', '-i', db, 'pg_restore', '--create', '--file=-'], { input: backup, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
      if (graphqlBootstrap) {
        // Supabase's wrapper is an extension member created by a DDL hook. pg_dump
        // omits its definition, but restore installs that hook after the ACLs.
        // Recreate the exact captured wrapper/dependency before those ACLs run.
        const marker = 'CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;';
        assert(restoreSQL.includes(marker), 'GraphQL bootstrap requires the captured extension');
        restoreSQL = restoreSQL.replace(marker, marker + '\n' + graphqlBootstrap);
      }
      // Supabase checks event-trigger/function ownership at CREATE time, before
      // pg_dump's later ALTER OWNER. Create each trigger as its captured owner.
      restoreSQL = restoreSQL.replace(/(-- Name: [^\n]+; Type: EVENT TRIGGER; Schema: -; Owner: ([^\n]+)\n--\n\n)(CREATE EVENT TRIGGER[\s\S]*?;)/g,
        (_match, header, owner, ddl) => `${header}SET ROLE "${owner.replaceAll('"', '""')}";\n${ddl}\nRESET ROLE;`);
      execFileSync('docker', ['exec', '-i', db, 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -U supabase_admin -d template1 -v ON_ERROR_STOP=1'], { input: restoreSQL, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 128 * 1024 * 1024 });
    } finally {
      if (services.length) docker('start', ...services);
    }
    assert.equal(history(), baselineHistory, 'Backup restore changed fixture history/content');
    record('backup_restored_and_history_verified');
  };
  return {
    async prepare() {
      config = JSON.parse(execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json', '--workdir', workspace], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      assert(/^http:\/\/(127\.0\.0\.1|localhost):55321$/.test(config.API_URL));
      const before = await fetch(config.API_URL + '/rest/v1/course_lessons?select=id', { headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${config.ANON_KEY}` } });
      assert.equal(before.status, 200, 'Baseline HTTP API unavailable');
      assert.equal((await before.json()).length, 5);
      docker('stop', gateway);
      await assertClosed();
      record('maintenance_enabled_existing_endpoint_denied');
      baselineHistory = history();
      graphqlBootstrap = sql(`SELECT COALESCE(string_agg(pg_get_functiondef(p.oid)||';' || format('ALTER FUNCTION %s OWNER TO %I;',p.oid::regprocedure,pg_get_userbyid(p.proowner)) || format('ALTER EXTENSION %I ADD FUNCTION %s;',e.extname,p.oid::regprocedure),E'\\n'),'') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e' JOIN pg_extension e ON e.oid=d.refobjid WHERE n.nspname='graphql_public';`);
      evidence.graphql_bootstrap_sha256 = createHash('sha256').update(graphqlBootstrap).digest('hex');
      backup = execFileSync('docker', ['exec', db, 'pg_dump', '-U', 'postgres', '-d', 'postgres', '--format=custom', '--create'], { maxBuffer: 128 * 1024 * 1024 });
      const backupPath = join(workspace, 'learning-cutover-backup.dump');
      writeFileSync(backupPath, backup, { mode: 0o600 });
      evidence.backup = { path: backupPath, sha256: createHash('sha256').update(backup).digest('hex'), bytes: backup.length };
      record('backup_created');
    },
    async interruptAndRestore() {
      let failed = false;
      try { sql('BEGIN; SELECT 1/0; COMMIT;'); } catch { failed = true; }
      assert(failed, 'Fault injection did not fail');
      await assertClosed();
      record('failure_between_canonical_migration_batches_kept_maintenance');
      restore();
      await assertClosed();
    },
    async finish(report) {
      // A post-apply smoke failure must not accidentally reopen the ingress.
      let failed = false;
      try { assert.fail('Injected post-apply smoke failure'); } catch { failed = true; }
      assert(failed);
      await assertClosed();
      record('post_apply_smoke_failure_kept_maintenance');
      const invalid = report().lessons.filter(lesson => lesson.public_visible && lesson.issues.length);
      assert(invalid.some(lesson => lesson.lesson_id === 'legacy-video'));
      await assertClosed();
      record('invalid_content_gate_kept_maintenance', { lesson_ids: invalid.map(lesson => lesson.lesson_id) });
      // Explicit operator remediation of this known disposable fixture only.
      // Do not rewrite malformed copy or discard historical progress.
      sql("UPDATE public.course_lessons SET published=false WHERE course_id='learning-upgrade-fixture' AND id IN ('legacy-video','legacy-malformed-quiz');");
      assert.equal(report().lessons.filter(lesson => lesson.public_visible && lesson.issues.length).length, 0);
      assert.equal(history(), baselineHistory);
      sql(readFileSync('scripts/learning/compatibility-local.sql', 'utf8'));
      assert.equal(history(), baselineHistory);
      const artifact = resolve('dist/client');
      assert(existsSync(join(artifact, 'index.html')), 'Build the compatible client artifact before cutover rehearsal');
      const files = readdirSync(artifact, { recursive: true, withFileTypes: true }).filter(item => item.isFile()).map(item => join(item.parentPath, item.name));
      const hashes = files.sort().map(path => ({ path: path.slice(artifact.length + 1), sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }));
      assert(files.filter(path => path.endsWith('.js')).some(path => readFileSync(path, 'utf8').includes('learning_final_submit')), 'Artifact lacks trusted final API');
      evidence.artifact = hashes;
      assert.deepEqual(internalRead().map(row => row.id), ['legacy-article', 'legacy-quiz']);
      record('private_network_read_and_transactional_rpc_smoke_passed');
      await assertClosed();
      docker('start', gateway);
      resumed = true;
      const response = await readyIngressRead();
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).map(row => row.id), ['legacy-article', 'legacy-quiz']);
      // A real new learner write after reopen establishes the no-restore boundary.
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      const payload = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'dddd0000-0000-4000-8000-000000000003', role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now()/1000)+600 })}`;
      assert(config.JWT_SECRET, 'Local fixture signing secret missing');
      const token = `${payload}.${createHmac('sha256', config.JWT_SECRET).update(payload).digest('base64url')}`;
      const write = await fetch(config.API_URL + '/rest/v1/rpc/learning_quiz_submit', { method: 'POST', headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_course: 'learning-upgrade-fixture', p_lesson: 'legacy-quiz', p_request: 'dddd9999-0000-4000-8000-000000000001', p_answers: { 'legacy-question': 0 } }) });
      assert.equal(write.status, 200, 'New client RPC failed after reopen');
      assert.equal((await write.json()).passed, true);
      assert.notEqual(history(), baselineHistory);
      assert.throws(restore, /Restore is forbidden/);
      record('ingress_reopened_new_write_committed_restore_refused');
      evidence.passed = true;
      save('cutover.json', evidence);
    },
    fail(error) {
      // Fail closed, including failures discovered immediately after reopening.
      try { docker('stop', gateway); } catch { /* It may already be stopped. */ }
      record('failed_closed', { reason: error instanceof Error ? error.message.split('\n')[0] : 'Rehearsal failed' });
      evidence.passed = false;
      save('cutover.json', evidence);
    },
  };
}
