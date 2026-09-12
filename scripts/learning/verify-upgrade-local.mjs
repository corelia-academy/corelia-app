import { createCutoverRehearsal } from "./cutover-local.mjs";
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compareImpact } from './compare-impact.mjs';

// Uses its own project, ports, containers and volumes. Never resets the app QA DB.
const container = 'supabase_db_corelia-learning-upgrade';
const running = execFileSync('docker', ['ps','-a','--format','{{.Names}}'], {encoding:'utf8'}).trim().split('\n');
assert(!running.includes(container), 'Upgrade fixture stack already exists. Stop that isolated stack before rerunning.');
const workspace = mkdtempSync(join(tmpdir(),'corelia-learning-upgrade-'));
const cutoverMode = process.argv.includes('--cutover');
const output = resolve(process.argv.slice(2).find(arg=>arg!=='--cutover') ?? join(workspace,'evidence'));
mkdirSync(join(workspace,'supabase','migrations'),{recursive:true});
// A patched local image is required for reserved-role permission-denial probes.
// Keep this explicit so evidence never silently substitutes a different backend.
const postgresVersion = process.env.LEARNING_QA_POSTGRES_VERSION;
if (postgresVersion) {
 assert(/^17\.\d+\.\d+\.\d+$/.test(postgresVersion),'Expected an explicit PostgreSQL 17 image tag');
 mkdirSync(join(workspace,'supabase','.temp'),{recursive:true});
 writeFileSync(join(workspace,'supabase','.temp','postgres-version'),postgresVersion);
}
mkdirSync(output,{recursive:true});
const config = readFileSync('supabase/config.toml','utf8').replace('project_id = "corelia-app"','project_id = "corelia-learning-upgrade"').replaceAll('543','553').replace('sql_paths = ["./seed.sql"]','sql_paths = []');
writeFileSync(join(workspace,'supabase/config.toml'),config);
cpSync('supabase/templates',join(workspace,'supabase/templates'),{recursive:true});
const migrations = readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).sort();
const copy = name => cpSync(join('supabase/migrations',name),join(workspace,'supabase/migrations',name));
for(const name of migrations.filter(name=>name<'20260910040432')) copy(name);
const cli = (...args) => execFileSync('pnpm',['exec','supabase',...args,'--workdir',workspace],{stdio:'inherit'});
const sql = input => execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8'}).trim();
const report = () => JSON.parse(execFileSync(process.execPath,['scripts/learning/impact-local.mjs'],{encoding:'utf8',env:{...process.env,LEARNING_IMPACT_CONTAINER:container}}));
const history = () => sql(`BEGIN READ ONLY; SELECT jsonb_build_object(
 'enrollments',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.enrollments e),
 'progress',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.lesson_progress p),
 'attempts',(SELECT jsonb_agg(to_jsonb(a)-ARRAY['attempt_group_id','group_total','group_correct','passing_ratio'] ORDER BY id) FROM public.section_question_attempts a),
 'submissions',(SELECT jsonb_agg(to_jsonb(f)-'artifacts' ORDER BY id) FROM public.final_assignment_submissions f),
 'lesson_data',(SELECT jsonb_agg(jsonb_build_object('id',id,'data',data) ORDER BY id) FROM public.course_lessons),
 'questions',(SELECT jsonb_agg(to_jsonb(q)-'archived_at' ORDER BY id) FROM public.course_section_questions q),
 'locale_data',(SELECT jsonb_agg(to_jsonb(l) ORDER BY course_id,lesson_id,locale) FROM public.course_lesson_locales l)); ROLLBACK;`);
const anonymousLessons = () => JSON.parse(sql("BEGIN READ ONLY; SET LOCAL ROLE anon; SELECT COALESCE(jsonb_agg(id ORDER BY id),'[]') FROM public.course_lessons; ROLLBACK;"));
const save = (name,data) => writeFileSync(join(output,name),JSON.stringify(data,null,2)+'\n');
const cutover = cutoverMode ? createCutoverRehearsal({workspace,output,sql,history,cli,save}) : null;
try {
 cli('start','-x',cutoverMode ? 'realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor' : 'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor');
 sql(readFileSync('scripts/learning/legacy-fixture.sql','utf8'));
 const before=report(), oldHistory=history();
 sql(readFileSync('scripts/learning/compatibility-local.sql','utf8'));
 assert.equal(history(),oldHistory,'Baseline compatibility probe leaked writes');
 assert.deepEqual(anonymousLessons(),['legacy-article','legacy-empty','legacy-malformed-quiz','legacy-quiz','legacy-video']); save('before.json',before);
 if(cutover){
  await cutover.prepare();
  const pending=migrations.filter(name=>name>='20260910040432');
  for(const name of pending.slice(0,Math.max(1,Math.floor(pending.length/2)))) copy(name);
  cli('migration','up','--local');
  await cutover.interruptAndRestore();
 }
 for(const name of migrations.filter(name=>name>='20260910040432')) copy(name);
 cli('migration','up','--local');
 const after=report();
 assert.deepEqual(anonymousLessons(),['legacy-article','legacy-malformed-quiz','legacy-quiz','legacy-video']); save('after.json',after);
 sql(readFileSync('scripts/learning/compatibility-local.sql','utf8'));
 const comparison=compareImpact(before,after); save('comparison.json',comparison);
 assert.equal(before.scope,'local_pre_migration_snapshot');
 assert.equal(after.scope,'local_post_migration_snapshot');
 assert.equal(history(),oldHistory,'Migration changed historical rows or legacy content');
 assert.deepEqual(comparison.history_changes,[]);
 assert.deepEqual(comparison.changes.permissions,[]);
 assert.equal(before.completion[0].required_lessons,5);
 assert.equal(after.completion[0].required_lessons,4);
 assert.equal(after.lessons.find(l=>l.lesson_id==='legacy-empty').public_visible,false);
 assert(after.lessons.find(l=>l.lesson_id==='legacy-video').issues.includes('invalid_locale_copy'));
 assert(after.lessons.find(l=>l.lesson_id==='legacy-malformed-quiz').issues.includes('invalid_questions'));
 sql(`BEGIN; SELECT set_config('request.jwt.claim.sub','dddd0000-0000-4000-8000-000000000003',true); SET LOCAL ROLE authenticated; DO $$ DECLARE denied boolean:=false; BEGIN BEGIN PERFORM public.learning_quiz_submit('learning-upgrade-fixture','legacy-malformed-quiz','dddd9999-0000-4000-8000-000000000002','{"legacy-malformed-question":0}'); EXCEPTION WHEN raise_exception THEN denied:=true; END; IF NOT denied THEN RAISE EXCEPTION 'Malformed historical quiz was graded'; END IF; END $$; ROLLBACK;`);
 assert.deepEqual(after.attribution[0].instructors,[{order:0,profile_id:'dddd0000-0000-4000-8000-000000000001'},{order:1,profile_id:'dddd0000-0000-4000-8000-000000000002'}]);
 assert.equal(sql('SELECT count(*) FROM public.section_question_attempts WHERE attempt_group_id IS NOT NULL OR group_total IS NOT NULL OR group_correct IS NOT NULL OR passing_ratio IS NOT NULL;'),'0');
 save('verification.json',{postgres_image:execFileSync('docker',['inspect',container,'--format','{{.Config.Image}}'],{encoding:'utf8'}).trim(),passed:true,history_sha256:createHash('sha256').update(oldHistory).digest('hex'),history_unchanged:true,permissions_unchanged:true,compatibility_probes_passed:true,migrations:migrations.length,invalid_lessons:after.lessons.filter(l=>l.issues.length)});
 if(cutover) await cutover.finish(report);
 console.log(`PASS: pre-Learning fixture upgraded with preserved history/permissions. Evidence: ${output}`);
} catch(error) {
 if(cutover) cutover.fail(error);
 throw error;
} finally {
 cli('stop','--no-backup');
}
