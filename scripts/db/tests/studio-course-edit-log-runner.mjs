import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

function cleanupFixtures(containerName, databaseName, runId) {
  const sql = `
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', '', true);
DELETE FROM public.follows
WHERE subject_type = 'course'
  AND subject_id LIKE 'edit-log-' || :'test_run_id' || '-%';
UPDATE public.course_lessons
SET published = false, archived_at = NULL
WHERE course_id LIKE 'edit-log-' || :'test_run_id' || '-%';
UPDATE public.courses
SET published = false, archived_at = NULL
WHERE id LIKE 'edit-log-' || :'test_run_id' || '-%';
DELETE FROM public.studio_course_edits
WHERE course_id LIKE 'edit-log-' || :'test_run_id' || '-%';
DELETE FROM public.courses
WHERE id LIKE 'edit-log-' || :'test_run_id' || '-%';
DELETE FROM auth.users
WHERE email LIKE 'edit-log-' || :'test_run_id' || '-%@corelia.local';
COMMIT;
`;

  execFileSync("docker", [
    "exec", "-i", containerName, "psql", "-U", "postgres", "-d", databaseName,
    "-v", "ON_ERROR_STOP=1", "-v", `test_run_id=${runId}`,
  ], { input: sql, stdio: ["pipe", "inherit", "inherit"] });
}

export function runStudioCourseEditLogIntegration({
  containerName = "supabase_db_corelia-app",
  databaseName = "postgres",
  forceAssertionFailure = false,
} = {}) {
  const runId = randomUUID();
  let testError;

  try {
    const args = [
      "exec", "-i", containerName, "psql", "-U", "postgres", "-d", databaseName,
      "-v", "ON_ERROR_STOP=1", "-v", `test_run_id=${runId}`,
    ];
    if (forceAssertionFailure) args.push("-v", "force_assertion_failure=1");
    execFileSync("docker", args, {
      input: readFileSync(resolve("scripts/db/tests/studio-course-edit-log.integration.sql")),
      stdio: ["pipe", "inherit", "inherit"],
    });
  } catch (error) {
    testError = error;
  }

  try {
    cleanupFixtures(containerName, databaseName, runId);
  } catch (cleanupError) {
    if (!testError) throw cleanupError;
    console.error("[CLEANUP_FAILURE] Could not remove course edit-log test fixtures after failure.", cleanupError);
  }

  if (testError) throw testError;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [databaseName = "postgres", mode] = process.argv.slice(2);
  try {
    runStudioCourseEditLogIntegration({
      databaseName,
      forceAssertionFailure: mode === "--force-assertion-failure",
    });
  } catch (error) {
    if (mode === "--force-assertion-failure") {
      console.error("Forced assertion failed; fixture cleanup was attempted.");
    } else {
      console.error("Course edit-log integration test failed.", error);
    }
    process.exitCode = 1;
  }
}
