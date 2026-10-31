import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const restartRunMigrationPath = "supabase/migrations/20261101160000_studio_restart_run.sql";
const contractPath = "scripts/db/tests/studio-start-gate.integration.sql";

function psql(container, sql) {
  return execFileSync("docker", [
    "exec", "-i", container, "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
    "-c", sql,
  ], { encoding: "utf8" }).trim();
}

function assertDisposableClone(container, expectedVersion) {
  if (!container || !expectedVersion) {
    throw new Error("Pass an isolated database container and its expected latest migration version as arguments.");
  }
  const running = execFileSync("docker", ["inspect", "--format", "{{.State.Running}}", container], { encoding: "utf8" }).trim();
  if (running !== "true") throw new Error(`Refusing mutation test: ${container} is not running.`);
  const version = psql(container, "SELECT max(version) FROM supabase_migrations.schema_migrations;");
  if (version !== expectedVersion) throw new Error(`Refusing mutation test: baseline is ${version || "unknown"}.`);
  const counts = psql(container, "SELECT (SELECT count(*) FROM public.studio_courses)||'|'||(SELECT count(*) FROM public.studio_runs)||'|'||(SELECT count(*) FROM public.studio_generations)||'|'||(SELECT count(*) FROM public.studio_run_events);");
  if (counts !== "0|0|0|0") throw new Error(`Refusing mutation test: clone must be empty; counts=${counts}.`);
}

function assertCloneEmpty(container, label) {
  const counts = psql(container, "SELECT (SELECT count(*) FROM public.studio_courses)||'|'||(SELECT count(*) FROM public.studio_runs)||'|'||(SELECT count(*) FROM public.studio_generations)||'|'||(SELECT count(*) FROM public.studio_run_events);");
  if (counts !== "0|0|0|0") throw new Error(`${label} left clone rows: ${counts}.`);
}

function expectMutationFailure(container, label, expectedMessage, sql) {
  const contract = readFileSync(resolve(contractPath), "utf8");
  const input = `BEGIN;\n${sql}\n${contract}`;
  let output = "";
  try {
    output = execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    output = `${error.stdout?.toString() ?? ""}\n${error.stderr?.toString() ?? ""}`;
    if (!output.includes(expectedMessage)) {
      throw new Error(`${label} failed outside its intended assertion. Output: ${output.slice(-1600)}`);
    }
    console.log(`[PASS] ${label}: contract failed at the expected assertion.`);
    return;
  }
  throw new Error(`${label} survived the mutation. Output: ${output.slice(-1600)}`);
}

function lastFunctionDefinition(source, declaration) {
  const starts = [...source.matchAll(new RegExp(declaration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))];
  const start = starts.at(-1)?.index ?? -1;
  const end = source.indexOf("\n$$;", start);
  if (start < 0 || end < 0) throw new Error(`Could not locate final function definition: ${declaration}.`);
  return source.slice(start, end + "\n$$;".length);
}

export function runStudioProvenanceMutationTests(container, expectedVersion) {
  assertDisposableClone(container, expectedVersion);
  const restartRunSource = readFileSync(resolve(restartRunMigrationPath), "utf8");

  // The migration creates the functions; the mutation replaces the existing ones.
  const asReplacement = (definition) => definition.replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION");
  const functionSource = asReplacement(lastFunctionDefinition(restartRunSource, "CREATE FUNCTION private.studio_resume_run("));
  const eventStart = functionSource.indexOf("  -- Every copied run-owned step gets one source line; Catalog keeps its start-run event only.");
  const eventEnd = functionSource.indexOf("  SELECT count(*)::integer INTO v_total", eventStart);
  if (eventStart < 0 || eventEnd < 0) throw new Error("Could not locate the copied-step source event block.");
  const withoutCopiedStepEvents = functionSource.slice(0, eventStart) + functionSource.slice(eventEnd);
  expectMutationFailure(container, "W-03 copied-step event mutation", "resumed run must have one A1 event plus six copied-step events", withoutCopiedStepEvents);
  assertCloneEmpty(container, "W-03 mutation");

  const sourceMessage = "Dùng lại kết quả nghiên cứu còn hiệu lực: job hoàn tất cách đây %s ngày, còn hiệu lực %s ngày (kỳ %s ngày của khóa). Không gọi model.";
  const mutatedMessage = "Dùng lại kết quả nghiên cứu còn hiệu lực: job hoàn tất cách đây %s ngày, còn hiệu lực %s ngày (kỳ %s ngày của khóa), ghi lúc 2026-10-30 UTC. Không gọi model.";
  const startRunSource = asReplacement(lastFunctionDefinition(restartRunSource, "CREATE FUNCTION private.studio_start_run("));
  if (!startRunSource.includes(sourceMessage)) throw new Error("Could not locate the W-04h source message for mutation.");
  const relativeCopyMutation = startRunSource.replace(sourceMessage, mutatedMessage);
  expectMutationFailure(container, "W-04h absolute UTC message mutation", "source message must not contain an absolute UTC date", relativeCopyMutation);
  assertCloneEmpty(container, "W-04h mutation");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runStudioProvenanceMutationTests(process.argv[2], process.argv[3]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
