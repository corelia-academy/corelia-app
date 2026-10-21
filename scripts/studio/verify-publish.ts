// Publishes sample lessons (no model call) through publishRun against the local database and checks
// what the app tables hold: published course, sections, lessons, quiz questions, copied diagram image,
// idempotent repeat, and a refusal by the database guards leaving nothing behind. Cleans up after itself.
//   eval "$(npx supabase status -o env)" && SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
//     deno run -A --no-config scripts/studio/verify-publish.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

import { renderDiagramPng, draftPath, diagramFile, appImagePath } from "../../supabase/functions/corelia-api/studio/diagram_render.ts";
import { article, base, curriculum, editCode, question } from "../../supabase/functions/corelia-api/studio/lesson_fixtures.ts";
import { lessonRefs, toLessonDraft } from "../../supabase/functions/corelia-api/studio/lessons.ts";
import { publishRun, PublishRejected } from "../../supabase/functions/corelia-api/studio/publish.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, key, { auth: { persistSession: false } });
const must = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
  if (!ok) failed = true;
};
let failed = false;

const outputs: Record<string, object> = {
  "l-art": { ...base, article },
  "l-quiz": { ...base, quiz: { questions: [question(), question()] } },
  "l-code": { ...base, code: editCode, source_ids: ["s1", "s2"] },
  "l-prac": { ...base, practice: { description_markdown: "Làm.", mode: "instruction", checklist_items: [] } },
  "l-vid": { ...base, source_ids: ["s2"], video: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", start_seconds: 0, end_seconds: 0 } },
};
const brief = { topic: "Rust cơ bản", audience: "Người mới học lập trình", level: "beginner", locale: "vi" };
const prov = { model_id: "gpt-6-luna", prompt_version: "a5-lesson@v6" };
const records = (over: Record<string, object> = {}) =>
  Object.fromEntries(lessonRefs(curriculum).map((r) => [r.lesson.id, { draft: toLessonDraft(r, (over[r.lesson.id] ?? outputs[r.lesson.id]) as never, "vi"), written: prov, reviewed: prov }]));

const admin = must(await db.from("profiles").select("id").eq("role", "admin").limit(1).single(), "admin profile").id as string;
const created: { course: string; run: string; images: string[] }[] = [];

async function setup(title: string) {
  const course = crypto.randomUUID(), run = crypto.randomUUID();
  must(await db.from("studio_courses").insert({ id: course, title, level: "beginner", status: "generating" }), "studio course");
  must(await db.from("studio_runs").insert({ id: run, course_id: course, started_by: admin }), "studio run");
  created.push({ course, run, images: [] });
  return { course, run };
}
async function putDraftImages(run: string, recs: ReturnType<typeof records>) {
  for (const [lessonId, r] of Object.entries(recs)) {
    for (const d of r.draft.diagrams) {
      const png = await renderDiagramPng(d);
      must(await db.storage.from("studio-drafts").upload(draftPath(run, lessonId, d.id), png, { contentType: "image/png", upsert: true }), "draft image");
    }
  }
}

try {
  // --- success -------------------------------------------------------------------------------
  const ok = await setup("Khóa kiểm thử publish");
  const recs = records();
  await putDraftImages(ok.run, recs);
  const input = { runId: ok.run, courseId: ok.course, title: "Khóa kiểm thử publish", brief, curriculum, records: recs };
  const id = await publishRun(db, input);
  check(id === ok.course, "returns the app course id (= Studio course id)");

  const course = must(await db.from("courses").select("*").eq("id", id).single(), "course");
  check(course.published === true && course.instructor_id === admin, "course published, instructor_id = run.started_by");
  check(course.data.course_type === "ai_generated" && course.data.owner_type === "corelia", "course_type ai_generated, owner_type corelia");
  check(course.slug === "khoa-kiem-thu-publish", `slug from title (${course.slug})`);
  const sections = must(await db.from("course_sections").select("id,sort_order,data").eq("course_id", id).order("sort_order"), "sections");
  check(sections.length === 2 && sections[0].id === "m1", "two sections in module order");
  const lessons = must(await db.from("course_lessons").select("id,section_id,sort_order,published,data").eq("course_id", id).order("sort_order"), "lessons");
  check(lessons.length === 5 && lessons.every((l) => l.published) && lessons.map((l) => l.sort_order).join() === "0,1,2,3,4", "five published lessons in order");
  check(lessons[0].section_id === "m1" && lessons[2].section_id === "m2", "lessons sit in their module's section");
  const file = diagramFile("l-art", "d1");
  check(lessons[0].data.description_markdown.includes(`(/lesson-image/${id}/${file})`) && !lessons[0].data.description_markdown.includes("diagram:"), "markdown points at /lesson-image/<course>/<file>");
  check(lessons[1].data.quiz_config.passing_ratio === 0.7, "quiz_config.passing_ratio = threshold / 100");
  const questions = must(await db.from("course_section_questions").select("lesson_id,section_id,sort_order,data").eq("course_id", id).order("sort_order"), "questions");
  check(questions.length === 2 && questions.every((q) => q.lesson_id === "l-quiz" && q.section_id === null), "questions attach to the quiz lesson by lesson_id");
  const image = await db.storage.from("app").download(appImagePath(id, file));
  check(!image.error && (image.data?.size ?? 0) > 1000, "diagram PNG copied to app/course-thumbnails/<course>/lessons/");
  created[0].images.push(appImagePath(id, file));
  check(must(await db.from("studio_runs").select("app_course_id").eq("id", ok.run).single(), "run").app_course_id === id, "run.app_course_id recorded");

  const again = await publishRun(db, input);
  const count = must(await db.from("courses").select("id").eq("id", id), "count").length;
  check(again === id && count === 1, "publishing the same run again returns the same course, no duplicate");

  // --- the database refuses -------------------------------------------------------------------
  const bad = await setup("Khóa bị từ chối");
  const badRecs = records();
  badRecs["l-quiz"].draft.questions = []; // a quiz lesson without questions is not publishable
  await putDraftImages(bad.run, badRecs);
  let rejected = "";
  try {
    await publishRun(db, { runId: bad.run, courseId: bad.course, title: "Khóa bị từ chối", brief, curriculum, records: badRecs });
  } catch (e) {
    rejected = e instanceof PublishRejected ? e.message : `unexpected ${e}`;
  }
  console.log(`     reason: ${rejected.slice(0, 200)}`);
  check(rejected.includes("LESSON_NOT_PUBLISHABLE") && rejected.includes("l-quiz"), "guard refusal becomes PublishRejected naming the lesson");
  check(must(await db.from("courses").select("id").eq("id", bad.course), "bad course").length === 0, "nothing was written for the refused course");
  const left = await db.storage.from("app").list(`course-thumbnails/${bad.course}/lessons`);
  check((left.data ?? []).length === 0, "copied images of the refused course were removed");
  check(must(await db.from("studio_runs").select("app_course_id").eq("id", bad.run).single(), "run").app_course_id === null, "refused run has no app_course_id");

  // --- locale the app does not support --------------------------------------------------------
  let localeError = "";
  try {
    await publishRun(db, { runId: bad.run, courseId: bad.course, title: "x", brief: { ...brief, locale: "fr" }, curriculum, records: records() });
  } catch (e) {
    localeError = e instanceof PublishRejected ? e.message : "unexpected";
  }
  check(localeError.includes("chưa được app hỗ trợ"), "unsupported content locale is refused before anything is written");
} finally {
  for (const c of created) {
    // Published content cannot be deleted; retire it first, like the app does.
    await db.from("course_lessons").update({ published: false }).eq("course_id", c.course);
    await db.from("courses").update({ published: false }).eq("id", c.course);
    await db.from("courses").delete().eq("id", c.course);
    await db.from("studio_courses").delete().eq("id", c.course);
    if (c.images.length) await db.storage.from("app").remove(c.images);
    const drafts = await db.storage.from("studio-drafts").list(`${c.run}/l-art`);
    await db.storage.from("studio-drafts").remove((drafts.data ?? []).map((o) => `${c.run}/l-art/${o.name}`));
  }
}
console.log(failed ? "FAILED" : "ALL PASS");
Deno.exit(failed ? 1 : 0);
