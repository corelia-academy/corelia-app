import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const raw = execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const env = Object.fromEntries(raw.trim().split('\n').map(line => { const match = line.match(/^(\w+)="(.*)"$/); assert(match); return [match[1], match[2]]; }));
assert(['127.0.0.1', 'localhost'].includes(new URL(env.API_URL).hostname));
const client = key => createClient(env.API_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(env.SERVICE_ROLE_KEY);
const actors = [];
const course = `storage-learning-${randomUUID()}`;
let path;
try {
  for (const [name, role] of [['owner', 'instructor'], ['learner', 'student'], ['content', 'instructor'], ['reviewer', 'instructor'], ['attribution', 'instructor'], ['support', 'support_staff'], ['admin', 'admin']]) {
    const email = `${name}-${randomUUID()}@corelia.local`, password = randomUUID();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
    const actor = { name, id: created.data.user.id, client: client(env.ANON_KEY) }; actors.push(actor);
    assert.ifError((await admin.from('profiles').update({ role }).eq('id', actor.id)).error);
    assert.ifError((await actor.client.auth.signInWithPassword({ email, password })).error);
  }
  assert.ifError((await admin.from('courses').insert({ id: course, slug: course, instructor_id: actors[0].id, published: false, data: { title: 'Disposable storage matrix', has_certificate: false, co_instructor_permissions: { [actors[2].id]: { content: true }, [actors[3].id]: { submissions: true } }, instructors: [{ profile_id: actors[4].id }] } })).error);
  assert.ifError((await admin.from('course_sections').insert({ course_id: course, id: 's', data: { title: 'Section' } })).error);
  assert.ifError((await admin.from('course_lessons').insert({ course_id: course, id: 'l', section_id: 's', published: true, data: { title: 'Article', lesson_format: 'article', description_markdown: 'Fixture' } })).error);
  assert.ifError((await admin.from('courses').update({ published: true }).eq('id', course)).error);
  path = `final-assignment-submissions/${course}/${actors[1].id}/${randomUUID()}.txt`;
  assert.ifError((await actors[1].client.storage.from('app').upload(path, new Blob(['immutable QA evidence']), { upsert: false })).error);
  for (const actor of [{ name: 'anonymous', client: client(env.ANON_KEY) }, ...actors]) {
    const storage = actor.client.storage.from('app');
    const readable = ['owner', 'learner', 'reviewer', 'support', 'admin'].includes(actor.name);
    const read = await storage.download(path);
    assert.equal(!read.error, readable, `${actor.name} read`);
    if (readable) assert.equal(await read.data.text(), 'immutable QA evidence');
    assert((await storage.update(path, new Blob(['must not replace']))).error, `${actor.name} overwrite`);
    assert((await storage.upload(path, new Blob(['must not upsert']), { upsert: true })).error, `${actor.name} upsert`);
    const removed = await storage.remove([path]);
    assert(removed.error || !removed.data?.length, `${actor.name} delete`);
    const preserved = await admin.storage.from('app').download(path); assert.ifError(preserved.error);
    assert.equal(await preserved.data.text(), 'immutable QA evidence', `${actor.name} preserved history`);
  }
  assert.ifError((await admin.from('courses').update({ published: false }).eq('id', course)).error);
  const denied = await actors[1].client.storage.from('app').upload(path.replace('.txt', '-draft.txt'), new Blob(['unavailable course']));
  assert(denied.error, 'unpublished course upload denied');
  console.log('PASS: Storage API 8 actors read/overwrite/upsert/delete; immutable bytes preserved; draft course upload denied.');
} finally {
  if (path) assert.ifError((await admin.storage.from('app').remove([path])).error);
  // Only this disposable fixture; no enrollments, submissions or issued credentials.
  await admin.from('course_lessons').update({ published: false }).eq('course_id', course);
  await admin.from('courses').update({ published: false }).eq('id', course);
  assert.ifError((await admin.from('courses').delete().eq('id', course)).error);
  for (const actor of actors) assert.ifError((await admin.auth.admin.deleteUser(actor.id)).error);
}
