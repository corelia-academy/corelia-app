// Drives one run through structure_check, journey_test and publish against the local database with
// sample lessons already accepted (no model call): renders the diagram to studio-drafts, checks links,
// plays the journey, publishes the course and finishes the run. Only this run is advanced.
//   eval "$(npx supabase status -o env)" && SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
//     deno run -A --no-config scripts/studio/verify-tick.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

import { advanceRun } from "../../supabase/functions/corelia-api/studio/handlers.ts";
import { appImagePath, diagramFile, draftPath } from "../../supabase/functions/corelia-api/studio/diagram_render.ts";
import { article, base, ctx, curriculum, editCode, question } from "../../supabase/functions/corelia-api/studio/lesson_fixtures.ts";
import { STEP_ORDER } from "../../supabase/functions/corelia-api/studio/steps.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
let failed = false;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}`);
  if (!ok) failed = true;
};
const must = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

const admin = must(await db.from("profiles").select("id").eq("role", "admin").limit(1).single(), "admin").id as string;
const courseId = crypto.randomUUID(), runId = crypto.randomUUID();
const title = "Khóa kiểm thử tick";
const journeyCurriculum = { ...curriculum, status: "draft", missing: [], outcomes: [{ id: "o1", text: "Làm được X", check_lesson_ids: ["l-quiz"] }] };
const brief = { status: "ready", topic: "Rust cơ bản", audience: "Người mới", level: "beginner", locale: "vi" };
const outputs: Record<string, object> = {
  "l-art": { ...base, article },
  "l-quiz": { ...base, quiz: { questions: [question(), question()] } },
  "l-code": { ...base, code: editCode, source_ids: ["s1", "s2"] },
  "l-prac": { ...base, practice: { description_markdown: "Làm.", mode: "instruction", checklist_items: [] } },
  "l-vid": { ...base, source_ids: ["s2"], video: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", start_seconds: 0, end_seconds: 0 } },
};
let request = 0;
const generation = (step: string, agent: string, output: unknown, lessonId?: string) => ({
  run_id: runId,
  step_key: step,
  lesson_id: lessonId ?? null,
  attempt: 0,
  agent_role: agent,
  kind: "text",
  provider: "openai",
  requested_model_id: "gpt-6-luna",
  model_id: "gpt-6-luna",
  prompt_version: `${step}@fixture`,
  input: {},
  status: "completed",
  provider_request_id: `verify-${runId}-${request++}`,
  output,
  completed_at: new Date().toISOString(),
});

try {
  must(await db.from("studio_courses").insert({ id: courseId, title, level: "beginner", status: "generating" }), "studio course");
  must(await db.from("studio_runs").insert({ id: runId, course_id: courseId, started_by: admin }), "run");
  must(await db.from("studio_run_steps").insert(STEP_ORDER.map((k) => ({ run_id: runId, step_key: k }))), "steps");
  const rows = [
    generation("brief", "A2", brief),
    generation("research", "A2", ctx.outputs.research),
    generation("curriculum", "A3", journeyCurriculum),
    generation("curriculum_review", "A4", { verdict: "pass", issues: [], needs_research: [], summary: "ok" }),
    ...Object.entries(outputs).flatMap(([id, out]) => [
      generation("lessons", "A5", out, id),
      generation("lesson_review", "A6", { verdict: "pass", issues: [], unverified: [], summary: "ok" }, id),
    ]),
  ];
  must(await db.from("studio_generations").insert(rows), "generations");
  must(await db.from("studio_run_steps").update({ state: "done" }).eq("run_id", runId).in("step_key", ["brief", "research", "curriculum", "curriculum_review", "lessons", "lesson_review"]), "steps done");

  const run = must(await db.from("studio_runs").select("id,course_id,started_at").eq("id", runId).single(), "run row");
  const seen: string[] = [];
  for (let i = 0; i < 8; i++) {
    const status = must(await db.from("studio_runs").select("status").eq("id", runId).single(), "status").status;
    if (status !== "running") break;
    const r = await advanceRun(db, run);
    seen.push(`${r.step}:${r.action}`);
  }
  console.log(`     ticks: ${seen.join(" -> ")}`);

  const finished = must(await db.from("studio_runs").select("status,app_course_id,hold_reason").eq("id", runId).single(), "finished");
  const steps = must(await db.from("studio_run_steps").select("step_key,state").eq("run_id", runId), "steps state");
  check(steps.every((s) => s.state === "done"), "every step done");
  check(finished.status === "published" && finished.app_course_id === courseId, `run published (${finished.status}${finished.hold_reason ? `: ${finished.hold_reason}` : ""})`);
  check(must(await db.from("studio_courses").select("status").eq("id", courseId).single(), "studio course").status === "published", "Studio catalog course is published");

  const course = must(await db.from("courses").select("published,instructor_id,data").eq("id", courseId).single(), "course");
  check(course.published && course.instructor_id === admin && course.data.course_type === "ai_generated", "app course published for the run's starter, course_type ai_generated");
  check(must(await db.from("course_lessons").select("id").eq("course_id", courseId).eq("published", true), "lessons").length === 5, "five published lessons");
  const file = diagramFile("l-art", "d1");
  check(!(await db.storage.from("studio-drafts").download(draftPath(runId, "l-art", "d1"))).error, "draft PNG rendered into studio-drafts");
  check(!(await db.storage.from("app").download(appImagePath(courseId, file))).error, "diagram PNG copied into app/course-thumbnails");
  const events = must(await db.from("studio_run_events").select("step_key,kind,message").eq("run_id", runId).order("created_at"), "events");
  for (const e of events) console.log(`     event ${e.step_key} ${e.kind}: ${e.message}`);
} finally {
  await db.from("course_lessons").update({ published: false }).eq("course_id", courseId);
  await db.from("courses").update({ published: false }).eq("id", courseId);
  await db.from("courses").delete().eq("id", courseId);
  await db.from("studio_courses").delete().eq("id", courseId);
  await db.storage.from("app").remove([appImagePath(courseId, diagramFile("l-art", "d1"))]);
  await db.storage.from("studio-drafts").remove([draftPath(runId, "l-art", "d1")]);
}
console.log(failed ? "FAILED" : "ALL PASS");
Deno.exit(failed ? 1 : 0);
