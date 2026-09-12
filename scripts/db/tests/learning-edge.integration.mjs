import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const raw=execFileSync('pnpm',['exec','supabase','status','--output','env'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
const env=Object.fromEntries(raw.trim().split('\n').map(line=>{const m=line.match(/^(\w+)="(.*)"$/);assert(m);return [m[1],m[2]];}));
assert(['127.0.0.1','localhost'].includes(new URL(env.API_URL).hostname));
const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const actors=[];const courseId=`edge-policy-${randomUUID()}`;let courseCreated=false;
try {
 for(const [name,role] of [['owner','instructor'],['learner','student'],['content','instructor'],['reviewer','instructor'],['attribution','instructor'],['support','support_staff'],['admin','admin']]) {
  const email=`${name}-${randomUUID()}@corelia.local`,password=randomUUID();
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);
  const actor={name,id:created.data.user.id};actors.push(actor);
  const profile=await admin.from('profiles').update({role}).eq('id',actor.id);assert.ifError(profile.error);
  const auth=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed=await auth.auth.signInWithPassword({email,password});assert.ifError(signed.error);actor.token=signed.data.session.access_token;
 }
 const permissions={[actors[2].id]:{content:true},[actors[3].id]:{submissions:true}};
 const created=await admin.from('courses').insert({id:courseId,slug:courseId,instructor_id:actors[0].id,published:false,data:{title:'Edge policy fixture',co_instructor_permissions:permissions,instructors:[{profile_id:actors[4].id}],has_certificate:false}});assert.ifError(created.error);courseCreated=true;
 for(const actor of [{name:'anonymous'},...actors]) {
  const headers={apikey:env.ANON_KEY,'Content-Type':'application/json'};if(actor.token)headers.Authorization=`Bearer ${actor.token}`;
  const res=await fetch(`${env.API_URL}/functions/v1/corelia-api?op=courses.syncCompletion`,{method:'POST',headers,body:JSON.stringify({courseId,userId:actors[1].id})});
  const body=await res.json();
  assert.equal(res.status,actor.name==='anonymous'?401:['owner','learner','reviewer','support','admin'].includes(actor.name)?400:403,`Edge completion ${actor.name}: ${body.message??body.reason}`);
  if(res.status===400){assert.equal(body.completed,false);assert.equal(body.reason,'no_enrollment');}
 }
 for(const op of ['courses.blastEmail','courses.coInstructorInvite.sendEmail','courses.sendLearningReminders']) {
  const res=await fetch(`${env.API_URL}/functions/v1/corelia-api?op=${op}`,{method:'POST',headers:{apikey:env.ANON_KEY,'Content-Type':'application/json'},body:'{}'});assert.equal(res.status,401,op);
 }
 console.log('PASS: Edge completion 8-actor authorization, unauthenticated mail/reminder denied; no enrollment, email or credential generated.');
} finally {
 if(courseCreated){const result=await admin.from('courses').delete().eq('id',courseId);assert.ifError(result.error);}
 for(const actor of actors){const result=await admin.auth.admin.deleteUser(actor.id);assert.ifError(result.error);}
}
