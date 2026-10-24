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
const course = `cdn-media-${randomUUID()}`, hackathon = `cdn-media-${randomUUID()}`;
const paths = [];
const png = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
try {
  for (const [name, role] of [['owner', 'instructor'], ['stranger', 'instructor'], ['admin', 'admin']]) {
    const email = `${name}-${randomUUID()}@corelia.local`, password = randomUUID();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(created.error);
    const actor = { name, id: created.data.user.id, client: client(env.ANON_KEY) }; actors.push(actor);
    assert.ifError((await admin.from('profiles').update({ role }).eq('id', actor.id)).error);
    assert.ifError((await actor.client.auth.signInWithPassword({ email, password })).error);
  }
  const [owner, stranger, adminActor] = actors;
  assert.ifError((await admin.from('courses').insert({ id: course, slug: course, instructor_id: owner.id, published: false, data: { title: 'CDN media fixture' } })).error);
  assert.ifError((await admin.from('hackathons').insert({ id: hackathon, status: 'draft', document: { title: 'CDN media fixture' } })).error);
  const cases = [
    { path: `course-thumbnails/${course}/${randomUUID()}.png`, manager: owner },
    { path: `contest-banners/${hackathon}/${Date.now()}.png`, manager: adminActor },
    { path: `contest-thumbnails/${hackathon}/${Date.now()}.png`, manager: adminActor },
    { path: `contest-org-partner-logos/${hackathon}/host/${Date.now()}.png`, manager: adminActor },
  ];
  const anonymous = client(env.ANON_KEY);
  for (const { path, manager } of cases) {
    paths.push(path);
    assert((await stranger.client.storage.from('cdn').upload(path, png())).error, `stranger upload ${path}`);
    assert((await anonymous.storage.from('cdn').upload(path, png())).error, `anonymous upload ${path}`);
    assert.ifError((await manager.client.storage.from('cdn').upload(path, png(), { contentType: 'image/png' })).error);
    const publicUrl = anonymous.storage.from('cdn').getPublicUrl(path).data.publicUrl;
    assert.equal((await fetch(publicUrl)).status, 200, `public read ${path}`);
    const listed = await anonymous.storage.from('cdn').list(path.split('/').slice(0, 2).join('/'));
    assert.equal(listed.data?.length ?? 0, 0, `anonymous listing ${path}`);
    const strangerRemove = await stranger.client.storage.from('cdn').remove([path]);
    assert(strangerRemove.error || !strangerRemove.data?.length, `stranger delete ${path}`);
    const removed = await manager.client.storage.from('cdn').remove([path]);
    assert.ifError(removed.error);
    assert.equal(removed.data?.length, 1, `${manager.name} delete ${path}`);
  }
  // Organizational partner logos are not part of the cdn host-logo policy.
  const partnerPath = `contest-org-partner-logos/${hackathon}/partner-1/${Date.now()}.png`;
  paths.push(partnerPath);
  assert((await adminActor.client.storage.from('cdn').upload(partnerPath, png())).error, 'partner logo upload to cdn denied');
  console.log('PASS: cdn course/hackathon artwork and host logos — manager upload/delete, partner logos stay out of cdn, stranger/anonymous denied, public read, no anonymous listing.');
} finally {
  if (paths.length) await admin.storage.from('cdn').remove(paths);
  await admin.from('hackathons').delete().eq('id', hackathon);
  await admin.from('courses').delete().eq('id', course);
  for (const actor of actors) assert.ifError((await admin.auth.admin.deleteUser(actor.id)).error);
}
