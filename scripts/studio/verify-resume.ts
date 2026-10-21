// Checks studio_start_run(p_resume_from) against the local database on synthetic runs (no model call,
// nothing else touched): which generations are copied, which lessons are redone, and when resuming is
// refused. Everything it creates is deleted at the end.
//   eval "$(npx supabase status -o env)" && SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
//     deno run -A --no-config scripts/studio/verify-resume.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

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
const path = must(await db.from("studio_paths").select("id").limit(1).single(), "path").id as string;
const courses: string[] = [];
let request = 0;

async function course(title: string): Promise<string> {
  const id = crypto.randomUUID();
  must(await db.from("studio_courses").insert({ id, title, level: "beginner", status: "not_passed" }), "course");
  must(await db.from("studio_course_paths").insert({ course_id: id, path_id: path }), "course path");
  courses.push(id);
  return id;
}

const curriculum = {
  modules: [{ id: "m1", lessons: ["a", "b", "c", "d", "e"].map((id) => ({ id })) }],
};
let clock = Date.parse("2026-10-20T10:00:00Z");

/** A failed run with the given steps done and lesson generations: [lesson, step, attempt, blocking?]. */
async function failedRun(courseId: string, doneSteps: string[], lessons: [string, "lessons" | "lesson_review", number, boolean?][], status = "draft_failed") {
  const id = crypto.randomUUID();
  clock += 60_000;
  must(await db.from("studio_runs").insert({ id, course_id: courseId, started_by: admin, status, started_at: new Date(clock).toISOString(), finished_at: new Date(clock + 30_000).toISOString(), hold_reason: status === "draft_failed" ? "fixture" : null }), "run");
  must(await db.from("studio_run_steps").insert(STEP_ORDER.map((k) => ({ run_id: id, step_key: k, state: doneSteps.includes(k) ? "done" : "pending" }))), "steps");
  const row = (step: string, attempt: number, output: object, lessonId: string | null) => ({
    run_id: id,
    step_key: step,
    lesson_id: lessonId,
    attempt,
    agent_role: { brief: "A2", research: "A2", curriculum: "A3", curriculum_review: "A4", lessons: "A5", lesson_review: "A6" }[step],
    kind: "text",
    provider: "openai",
    requested_model_id: "gpt-6-luna",
    model_id: "gpt-6-luna",
    prompt_version: `${step}@fixture`,
    input: {},
    status: "completed",
    provider_request_id: `verify-resume-${id}-${request++}`,
    output,
    usage: { total_tokens: 100 },
    completed_at: new Date().toISOString(),
  });
  const rows = [
    ...(doneSteps.includes("brief") ? [row("brief", 0, { topic: "t" }, null)] : []),
    ...(doneSteps.includes("research") ? [row("research", 0, { sources: [] }, null)] : []),
    ...(doneSteps.includes("curriculum") ? [row("curriculum", 0, curriculum, null)] : []),
    ...(doneSteps.includes("curriculum_review") ? [row("curriculum_review", 0, { verdict: "pass", issues: [] }, null)] : []),
    ...lessons.map(([lesson, step, attempt, blocking]) =>
      row(step, attempt, step === "lessons" ? { marker: `${lesson}-draft-${attempt}` } : { verdict: blocking ? "needs_fix" : "pass", issues: blocking ? [{ severity: "blocking", location: "lesson.title", problem: "x" }] : [{ severity: "minor", location: "lesson.title", problem: "y" }] }, lesson)
    ),
  ];
  must(await db.from("studio_generations").insert(rows), "generations");
  return id;
}

const upTo = ["brief", "research", "curriculum", "curriculum_review"];
const start = async (courseId: string, from: string | null) => {
  const r = await db.rpc("studio_start_run", { p_course_id: courseId, p_run_id: crypto.randomUUID(), p_started_by: admin, p_resume_from: from });
  return must(r, "start") as { run_id: string; created: boolean; resume?: Record<string, number | string>; resume_skipped?: string };
};
const generations = async (runId: string) =>
  must(await db.from("studio_generations").select("id,step_key,lesson_id,attempt,origin,parent_generation_id,provider_request_id,output,usage,model_id,prompt_version").eq("run_id", runId), "generations");

try {
  // a: done. b: out of reviews (blocking twice). c: draft never reviewed. d: nothing. e: rewritten once, last review passes.
  const c1 = await course("Resume 1");
  const old = await failedRun(c1, upTo, [
    ["a", "lessons", 0], ["a", "lesson_review", 0],
    ["b", "lessons", 0], ["b", "lesson_review", 0, true], ["b", "lessons", 1], ["b", "lesson_review", 1, true],
    ["c", "lessons", 0],
    ["e", "lessons", 0], ["e", "lesson_review", 0, true], ["e", "lessons", 1], ["e", "lesson_review", 1],
  ]);
  const started = await start(c1, old);
  check(started.created && started.resume?.steps === 4 && started.resume.lessons_copied === 2 && started.resume.drafts_copied === 1 && started.resume.lessons_total === 5, `resume summary ${JSON.stringify(started.resume)}`);
  const rows = await generations(started.run_id);
  const by = (step: string, lesson: string | null) => rows.filter((r) => r.step_key === step && r.lesson_id === lesson);
  check(rows.length === 4 + 2 * 2 + 1, `copied 4 steps + 2 done lessons x (draft, review) + 1 unreviewed draft (${rows.length})`);
  check(by("lessons", "a").length === 1 && by("lesson_review", "a").length === 1, "done lesson a: draft and review copied");
  check((by("lessons", "e")[0]?.output as { marker: string })?.marker === "e-draft-1" && by("lesson_review", "e").length === 1, "done lesson e: the newest draft (after a rewrite) and its review");
  check(by("lessons", "c").length === 1 && by("lesson_review", "c").length === 0, "lesson c: draft kept, review still to do");
  check(by("lessons", "b").length === 0 && by("lesson_review", "b").length === 0, "lesson b (out of reviews) is redone from the start");
  check(by("lessons", "d").length === 0, "lesson d (never started) has nothing copied");
  check(rows.every((r) => r.origin === "resumed" && r.parent_generation_id && r.provider_request_id?.startsWith("resume:") && r.attempt === 0), "copies: origin resumed, parent = original, marked request id, attempt 0");
  check(rows.every((r) => r.model_id === "gpt-6-luna" && r.prompt_version.endsWith("@fixture") && (r.usage as { total_tokens: number }).total_tokens === 100), "copies keep model_id, prompt_version, usage");
  const steps = must(await db.from("studio_run_steps").select("step_key,state").eq("run_id", started.run_id), "steps");
  check(steps.filter((s) => s.state === "done").map((s) => s.step_key).sort().join() === [...upTo].sort().join(), "the four early steps are done, the rest pending");
  check(must(await db.from("studio_generations").select("id").eq("run_id", old), "old").length === 15, "the failed run keeps all its own generations");

  const again = await db.rpc("studio_start_run", { p_course_id: c1, p_run_id: started.run_id, p_started_by: admin, p_resume_from: old });
  check(must(again, "repeat").created === false && (await generations(started.run_id)).length === rows.length, "repeating the same run id copies nothing more");

  // --- refusals: the call starts a normal run and says why ---------------------------------------
  const cDone = await course("Resume done");
  const published = await failedRun(cDone, upTo, [["a", "lessons", 0]], "published");
  const r1 = await start(cDone, published);
  check(r1.resume_skipped === "run_not_draft_failed" && (await generations(r1.run_id)).length === 0, "a run that did not end as draft_failed is not resumed");

  const cNewer = await course("Resume newer");
  const first = await failedRun(cNewer, upTo, [["a", "lessons", 0]]);
  await failedRun(cNewer, upTo, [["a", "lessons", 0]]);
  const r2 = await start(cNewer, first);
  check(r2.resume_skipped === "not_latest_run" && (await generations(r2.run_id)).length === 0, "only the newest run of the course can be resumed");

  const cEarly = await course("Resume early");
  const early = await failedRun(cEarly, ["brief", "research"], []);
  const r3 = await start(cEarly, early);
  check(r3.resume_skipped === "curriculum_not_done" && (await generations(r3.run_id)).length === 0, "a run that did not finish its curriculum starts over, nothing copied");

  const cOther = await course("Resume other");
  const r4 = await start(cOther, old);
  check(r4.resume_skipped === "run_not_found" && (await generations(r4.run_id)).length === 0, "a run of another course is not resumable");

  const cPlain = await course("Resume plain");
  const r5 = await start(cPlain, null);
  check(r5.created && r5.resume === undefined && r5.resume_skipped === undefined, "no resume asked: plain start");
} finally {
  for (const id of courses) await db.from("studio_courses").delete().eq("id", id);
}
console.log(failed ? "FAILED" : "ALL PASS");
Deno.exit(failed ? 1 : 0);
