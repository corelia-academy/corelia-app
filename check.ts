import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: c } = await db.from('courses').select('id, title').ilike('title', '%test ocb%').single();
  console.log('Course:', c);
  if (!c) return;

  const { data: e } = await db.from('enrollments').select('*').eq('course_id', c.id);
  console.log('Enrollments:', e);
  if (!e || !e.length) return;

  const { data: r } = await db.rpc('corelia_certificate_readiness', { p_course_id: c.id, p_user_id: e[0].user_id });
  console.log('Readiness:', r);

  const { data: tpl } = await db.from('credential_templates').select('*').eq('course_id', c.id).eq('is_active', true);
  console.log('Templates:', tpl);

  const { data: iss } = await db.from('credential_issuances').select('*').eq('course_id', c.id);
  console.log('Issuances:', iss);
}
run();
