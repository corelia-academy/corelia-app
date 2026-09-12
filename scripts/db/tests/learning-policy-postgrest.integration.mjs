import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(execFileSync('pnpm',['exec','supabase','status','--output','env'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split(/\r?\n/).map(line=>{const m=line.match(/^([A-Z0-9_]+)="(.*)"$/); assert(m,'Unexpected local status format'); return [m[1],m[2]];}));
assert(['127.0.0.1','localhost'].includes(new URL(env.API_URL).hostname),'Local API only');
const sql = input => execFileSync('docker',['exec','-i','supabase_db_corelia-app','psql','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8'}).trim();
const fixture=readFileSync(new URL('./learning-policy-scope.integration.sql',import.meta.url),'utf8').split('DO $$ DECLARE actor')[0]+'COMMIT;';
const token = actor => {
 if(actor===0) return env.ANON_KEY;
 const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const body=Buffer.from(JSON.stringify({role:'authenticated',sub:`cccc2222-0000-4000-8000-${String(actor).padStart(12,'0')}`,aud:'authenticated',exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
 return `${header}.${body}.${createHmac('sha256',env.JWT_SECRET).update(`${header}.${body}`).digest('base64url')}`;
};
const request = async (actor,table,method='GET',body) => {
 const res=await fetch(`${env.API_URL}/rest/v1/${table}?course_id=eq.policy-scope`,{method,headers:{apikey:env.ANON_KEY,Authorization:`Bearer ${token(actor)}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,rows:await res.json()};
};
let seeded=false;
try {
 sql(fixture); seeded=true;
 for(let actor=0;actor<=7;actor++) {
  const res=await fetch(`${env.API_URL}/rest/v1/rpc/learning_save_course_info`,{method:'POST',headers:{apikey:env.ANON_KEY,Authorization:`Bearer ${token(actor)}`,'Content-Type':'application/json'},body:JSON.stringify({p_course:'policy-scope',p_patch:{short_description:'Atomic save'},p_locale:'en',p_copy:{short_description:'Atomic save'}})});
  assert.equal(res.status,[1,6,7].includes(actor)?204:actor===0?401:403,`course Save actor ${actor}: ${await res.text()}`);
 }
 for(let actor=0;actor<=7;actor++) {
  for(const representation of [false,true]) {
   const id=`policy-create-${actor}-${representation}`;
   const owner=actor===0?'cccc2222-0000-4000-8000-000000000002':`cccc2222-0000-4000-8000-${String(actor).padStart(12,'0')}`;
   const res=await fetch(`${env.API_URL}/rest/v1/courses`,{method:'POST',headers:{apikey:env.ANON_KEY,Authorization:`Bearer ${token(actor)}`,'Content-Type':'application/json',Prefer:representation?'return=representation':'return=minimal'},body:JSON.stringify({id,instructor_id:owner,slug:id,published:false,data:{title:'Creation scope fixture'}})});
   const allowed=![0,2].includes(actor);
   assert.equal(res.status,allowed?201:actor===0?401:403,`create ${actor} representation=${representation}: ${await res.text()}`);
   assert.equal(sql(`SELECT count(*) FROM public.courses WHERE id='${id}'`),allowed?'1':'0');
  }
 }
 const foreign=await fetch(`${env.API_URL}/rest/v1/courses`,{method:'POST',headers:{apikey:env.ANON_KEY,Authorization:`Bearer ${token(1)}`,'Content-Type':'application/json'},body:JSON.stringify({id:'policy-create-foreign',instructor_id:'cccc2222-0000-4000-8000-000000000002',published:false,data:{title:'Not my course'}})});
 assert.equal(foreign.status,403,'Instructor cannot create a course for another owner');
 for(let actor=0;actor<=7;actor++) {
  const allowed=[1,3,6,7].includes(actor);
  for(const table of ['course_locales','course_section_locales','course_lesson_locales','course_sections','course_lessons']) {
   const read=await request(actor,table); assert.equal(read.status,200,`actor ${actor}: read ${table}`); assert.equal(read.rows.length,1);
   const update=await request(actor,table,'PATCH',{data:read.rows[0].data});
   assert.equal(update.status,200,`actor ${actor}: update ${table}`); assert.equal(update.rows.length,allowed?1:0,`actor ${actor}: mutation scope ${table}`);
   if(!allowed && table.endsWith('locales')) {
    const removal=await request(actor,table,'DELETE'); assert.equal(removal.status,200); assert.equal(removal.rows.length,0,`actor ${actor}: delete bypass ${table}`);
   }
  }
 }
 assert.equal(sql("SELECT count(*) FROM public.course_lesson_locales WHERE course_id='policy-scope'"),'1');
 // Exercise publication through the actual REST relations, including locale resources/questions.
 sql(`BEGIN;
  SELECT set_config('request.jwt.claim.sub','cccc2222-0000-4000-8000-000000000001',true);
  SELECT public.learning_save_lesson('policy-scope',
   '{"id":"visibility-quiz","section_id":"section","published":false,"title":"Visibility quiz","lesson_format":"quiz","resources":[{"title":"Private resource","url":"https://example.com/private-resource"}]}',
   '[{"id":"visibility-question","type":"mcq","question":"Hidden question","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}]',
   '{"en":{"title":"Hidden English","resources":[{"title":"Private English resource","url":"https://example.com/private-english"}],"question_copy":{"visibility-question":{"question":"Hidden English question"}}}}');
  COMMIT;`);
 for(const state of ['draft-lesson','archived-lesson','published','draft-course','archived-course']) {
  sql(`BEGIN;
   UPDATE public.course_lessons SET published=${state!=='draft-lesson'},archived_at=${state==='archived-lesson'?"now()":"NULL"} WHERE course_id='policy-scope' AND id='visibility-quiz';
   UPDATE public.courses SET published=${state!=='draft-course'},archived_at=${state==='archived-course'?"now()":"NULL"} WHERE id='policy-scope';
   COMMIT;`);
  for(let actor=0;actor<=7;actor++) {
   const visible=state==='published'||[1,3,6,7].includes(actor);
   for(const [table,identity] of [['course_lessons','id'],['course_lesson_locales','lesson_id'],['course_section_questions','lesson_id']]) {
    const result=await request(actor,table);
    assert.equal(result.status,200,`${state} actor ${actor} ${table}`);
    const matches=result.rows.filter(row=>row[identity]==='visibility-quiz');
    assert.equal(matches.length,visible?(table==='course_lesson_locales'?2:1):0,`${state} actor ${actor} ${table} visibility`);
    if(visible && table!=='course_section_questions') assert((table==='course_lesson_locales'?matches.find(row=>row.locale==='en'):matches[0]).data.resources?.[0]?.url,'Resource fixture must be present');
   }
   if(state.endsWith('course')) for(const table of ['course_locales','course_sections','course_section_locales']) {
    const result=await request(actor,table);
    assert.equal(result.status,200);
    assert.equal(result.rows.length,[1,3,6,7].includes(actor)?1:0,`${state} actor ${actor} ${table}`);
   }
  }
 }
 console.log('PASS: 8 actors × 5 publication states × lesson/question/locale-resource REST reads, plus course/section locale visibility.');
 console.log('PASS: REST read/update/delete matrix for anonymous, learner, owner, content co-instructor, submission co-instructor, attribution-only instructor, support and admin.');
} finally {
 if(seeded) sql("BEGIN; UPDATE public.courses SET published=false,archived_at=NULL WHERE id='policy-scope'; UPDATE public.course_lessons SET published=false,archived_at=NULL WHERE course_id='policy-scope'; DELETE FROM public.courses WHERE id='policy-scope'; DELETE FROM public.courses WHERE id LIKE 'policy-create-%'; DELETE FROM auth.users WHERE id::text LIKE 'cccc2222%'; COMMIT;");
}
