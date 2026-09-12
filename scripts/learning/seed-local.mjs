import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Deliberately uses only the repository's disposable Docker database, never a URL.
const fixture = JSON.parse(readFileSync(new URL("../../docs/learning/pilot/course.json", import.meta.url), "utf8"));
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => `${quote(JSON.stringify(value))}::jsonb`;
const course = fixture.course;
const admin = "eeee9999-0000-4000-8000-000000000001";
const statements = [
  "BEGIN;",
  `INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(${quote(admin)},'pilot-admin@corelia.local','{"full_name":"Local Learning Pilot"}') ON CONFLICT(id) DO NOTHING;`,
  `UPDATE public.profiles SET role='admin' WHERE id=${quote(admin)};`,
  `INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES(${quote(course.id)},${quote(admin)},${quote(course.slug)},false,${json(course.data)}) ON CONFLICT(id) DO NOTHING;`,
  `SELECT set_config('request.jwt.claim.sub',${quote(admin)},true);`,
  "SELECT set_config('request.jwt.claim.role','authenticated',true);",
  "SET LOCAL ROLE authenticated;",
];
for (const section of fixture.sections) {
  statements.push(`INSERT INTO public.course_sections(course_id,id,sort_order,data) VALUES(${quote(course.id)},${quote(section.id)},${section.order},${json({title: section.title})}) ON CONFLICT(course_id,id) DO UPDATE SET sort_order=EXCLUDED.sort_order,data=EXCLUDED.data;`);
  for (const [locale,title] of [["vi",section.title],["en",section.en_title]]) statements.push(`INSERT INTO public.course_section_locales(course_id,section_id,locale,data) VALUES(${quote(course.id)},${quote(section.id)},${quote(locale)},${json({title})}) ON CONFLICT(course_id,section_id,locale) DO UPDATE SET data=EXCLUDED.data;`);
}
for (const row of fixture.lessons) statements.push(`SELECT public.learning_save_lesson(${quote(course.id)},${json(row.lesson)},${row.lesson.lesson_format === "quiz" ? json(row.questions) : "NULL"},${json(row.locales)});`);
statements.push(`SELECT public.learning_save_course(${quote(course.id)},${json(course.data)},${quote(course.slug)},true,${json(fixture.course_locales)});`, "SET CONSTRAINTS ALL IMMEDIATE;", "COMMIT;");
try {
  execFileSync("docker", ["exec", "-i", "supabase_db_corelia-app", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], {input: statements.join("\n"), stdio: ["pipe","pipe","pipe"]});
  console.log(`Local pilot seeded: ${course.id}, ${fixture.sections.length} sections, ${fixture.lessons.length} lessons. No email or credential issued.`);
} catch (error) {
  console.error(error.stderr?.toString() ?? error.message);
  process.exitCode = 1;
}
