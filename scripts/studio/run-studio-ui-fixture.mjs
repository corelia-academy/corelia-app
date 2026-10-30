import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

let CONTAINER = process.env.STUDIO_CONTAINER || process.env.CONTAINER || "supabase_db_studio-manual-order-clone";
const DATABASE = "postgres";

function docker(args, options = {}) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"], ...options }).trim();
}

function assertTarget() {
  const running = docker(["inspect", "--format", "{{.State.Running}}", CONTAINER]);
  if (running !== "true") throw new Error(`Refusing to write: ${CONTAINER} is not running.`);
  const pausedColumn = psql("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='studio_runs' AND column_name='paused_at');");
  if (pausedColumn !== "t") throw new Error("Refusing to write: pause/continue migration has not been applied to the target database.");
}

function psql(sqlOrPath, variables = {}, file = false) {
  const args = ["exec", "-i", CONTAINER, "psql", "-X", "-qAt", "-U", "postgres", "-d", DATABASE, "-v", "ON_ERROR_STOP=1"];
  for (const [name, value] of Object.entries(variables)) args.push("-v", `${name}=${value}`);
  if (file) return docker(args, { input: readFileSync(resolve(sqlOrPath)) });
  args.push("-c", sqlOrPath);
  return docker(args);
}

function courseCounts() {
  const result = psql("SELECT (SELECT count(*) FROM public.studio_courses)||'|'||(SELECT count(*) FROM public.studio_runs)||'|'||(SELECT count(*) FROM public.studio_generations)||'|'||(SELECT count(*) FROM public.studio_run_events);");
  return result.split("|").map(Number);
}

function runSeed() {
  assertTarget();
  const countsBefore = courseCounts();
  const isClone = CONTAINER.includes("clone");
  if (isClone && countsBefore.some((count) => count !== 0)) {
    throw new Error("Refusing to seed: the schema-only clone already has Studio course/run/generation/event rows. Clean it before retrying.");
  }
  const fixtureKey = randomUUID();
  const output = psql("scripts/studio/studio-ui-fixture.sql", { fixture_key: fixtureKey }, true);
  const countsAfter = courseCounts();
  console.log(`Seeded disposable UI fixture ${fixtureKey} in ${CONTAINER}.`);
  console.log(`Counts before: courses=${countsBefore[0]}, runs=${countsBefore[1]}, generations=${countsBefore[2]}, events=${countsBefore[3]}`);
  console.log(`Counts after:  courses=${countsAfter[0]}, runs=${countsAfter[1]}, generations=${countsAfter[2]}, events=${countsAfter[3]}`);
  console.log(`Delta:         +${countsAfter[0] - countsBefore[0]} courses, +${countsAfter[1] - countsBefore[1]} runs, +${countsAfter[2] - countsBefore[2]} generations, +${countsAfter[3] - countsBefore[3]} events`);
  console.log(`Cleanup: node scripts/studio/run-studio-ui-fixture.mjs cleanup ${fixtureKey} --container ${CONTAINER}`);
  console.log("case_key | course_id | run_id");
  for (const row of output.split(/\r?\n/).filter((line) => line.includes("|"))) console.log(row);
}

function runCleanup(fixtureKey) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fixtureKey ?? "")) {
    throw new Error("Pass the UUID printed by the seed command: cleanup <fixture-key>.");
  }
  assertTarget();
  const countsBefore = courseCounts();
  psql("scripts/studio/studio-ui-fixture-cleanup.sql", { fixture_key: fixtureKey }, true);
  const remaining = psql(`SELECT count(*) FROM public.studio_courses WHERE left(title, length('__studio_ui_fixture__:${fixtureKey}:')) = '__studio_ui_fixture__:${fixtureKey}:';`);
  if (remaining !== "0") throw new Error(`Cleanup left ${remaining} fixture courses.`);
  const countsAfter = courseCounts();
  const isClone = CONTAINER.includes("clone");
  if (isClone && countsAfter.some((count) => count !== 0)) {
    throw new Error(`Fixture rows were removed, but clone is not empty: courses|runs|generations|events=${countsAfter.join("|")}.`);
  }
  console.log(`Cleaned fixture ${fixtureKey} in ${CONTAINER}.`);
  console.log(`Counts before cleanup: courses=${countsBefore[0]}, runs=${countsBefore[1]}, generations=${countsBefore[2]}, events=${countsBefore[3]}`);
  console.log(`Counts after cleanup:  courses=${countsAfter[0]}, runs=${countsAfter[1]}, generations=${countsAfter[2]}, events=${countsAfter[3]}`);
  console.log(`Delta:                 -${countsBefore[0] - countsAfter[0]} courses, -${countsBefore[1] - countsAfter[1]} runs, -${countsBefore[2] - countsAfter[2]} generations, -${countsBefore[3] - countsAfter[3]} events`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rawArgs = process.argv.slice(2);
    const containerIdx = rawArgs.indexOf("--container");
    if (containerIdx !== -1 && rawArgs[containerIdx + 1]) {
      CONTAINER = rawArgs[containerIdx + 1];
      rawArgs.splice(containerIdx, 2);
    }
    const [action, fixtureKey] = rawArgs;
    if (action === "seed") runSeed();
    else if (action === "cleanup") runCleanup(fixtureKey);
    else throw new Error("Usage: node scripts/studio/run-studio-ui-fixture.mjs <seed|cleanup fixture-key> [--container <name>]");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
