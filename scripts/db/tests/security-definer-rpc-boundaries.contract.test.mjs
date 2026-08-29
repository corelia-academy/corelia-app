import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260828060630_harden_security_definer_rpc_boundaries.sql",
  ),
  "utf8",
);

const publicRpcSignatures = [
  "create_project_collaboration_invite\\(uuid, uuid\\)",
  "enroll_in_course\\(text, uuid\\)",
  "get_learning_reminder_candidates\\(\\)",
  "list_course_co_instructor_candidates\\(text\\)",
  "list_invitable_hackathon_users\\(uuid, text, integer\\)",
  "list_profile_course_skills\\(uuid\\)",
  "patch_hackathon_metrics_snapshot\\(text, jsonb\\)",
  "refresh_course_total_duration\\(text\\)",
  "submit_quiz_attempt\\(text, text, text, text, integer\\)",
  "submit_quiz_attempts\\(jsonb\\)",
];

test("moves every privileged implementation out of the exposed schema", () => {
  for (const signature of publicRpcSignatures) {
    assert.match(
      migration,
      new RegExp(`ALTER FUNCTION public\\.${signature} SET SCHEMA private;`, "i"),
      `must move public.${signature} to private`,
    );
  }

  assert.match(
    migration,
    /ALTER FUNCTION public\.guard_course_enrollment_access\(\) SET SCHEMA private;/i,
  );
  assert.match(
    migration,
    /ALTER FUNCTION public\.sync_ai_chat_session_message_count\(\) SET SCHEMA private;/i,
  );
});

test("public compatibility wrappers are invokers with immutable search paths", () => {
  const wrapperNames = [
    "create_project_collaboration_invite",
    "enroll_in_course",
    "get_learning_reminder_candidates",
    "list_course_co_instructor_candidates",
    "list_invitable_hackathon_users",
    "list_profile_course_skills",
    "patch_hackathon_metrics_snapshot",
    "refresh_course_total_duration",
    "submit_quiz_attempt",
    "submit_quiz_attempts",
  ];

  for (let index = 0; index < wrapperNames.length; index += 1) {
    const name = wrapperNames[index];
    const start = migration.indexOf(`CREATE FUNCTION public.${name}`);
    const nextStart = wrapperNames
      .slice(index + 1)
      .map((nextName) => migration.indexOf(`CREATE FUNCTION public.${nextName}`, start + 1))
      .find((position) => position >= 0);
    const definition = migration.slice(start, nextStart ?? migration.indexOf("-- New functions", start));

    assert.notEqual(start, -1, `must recreate public.${name}`);
    assert.match(definition, /SECURITY INVOKER/i, `public.${name} must be SECURITY INVOKER`);
    assert.match(definition, /SET search_path = ''/i, `public.${name} must fix search_path`);
    assert.match(definition, new RegExp(`private\\.${name}\\(`), `public.${name} must delegate privately`);
    assert.doesNotMatch(definition, /SECURITY DEFINER/i, `public.${name} must not elevate directly`);
  }
});

test("credential activity helper is internal-only with a fixed search path", () => {
  assert.match(
    migration,
    /ALTER FUNCTION private\.credential_template_activity_payload\(uuid, jsonb\)\s+SET search_path = '';/i,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION private\.credential_template_activity_payload\(uuid, jsonb\)\s+FROM PUBLIC, anon, authenticated, service_role;/i,
  );
});

test("ACL matrix exposes only the intended RPC audience", () => {
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.list_profile_course_skills\(uuid\)\s+TO anon, authenticated, service_role;/i,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.get_learning_reminder_candidates\(\)\s+TO service_role;/i,
  );
  assert.doesNotMatch(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.get_learning_reminder_candidates\(\)\s+TO (?:anon|authenticated)/i,
  );

  const authenticatedOnly = [
    "create_project_collaboration_invite\\(uuid, uuid\\)",
    "enroll_in_course\\(text, uuid\\)",
    "list_course_co_instructor_candidates\\(text\\)",
    "list_invitable_hackathon_users\\(uuid, text, integer\\)",
    "patch_hackathon_metrics_snapshot\\(text, jsonb\\)",
    "refresh_course_total_duration\\(text\\)",
    "submit_quiz_attempt\\(text, text, text, text, integer\\)",
    "submit_quiz_attempts\\(jsonb\\)",
  ];

  for (const signature of authenticatedOnly) {
    assert.match(
      migration,
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${signature} FROM PUBLIC, anon, authenticated, service_role;`, "i"),
    );
  }

  assert.match(
    migration,
    /TO authenticated, service_role;/i,
    "authenticated RPC group must be restored only to authenticated and service_role",
  );
});

test("trigger implementations cannot be invoked by Data API roles", () => {
  for (const name of ["guard_course_enrollment_access", "sync_ai_chat_session_message_count"]) {
    assert.match(
      migration,
      new RegExp(
        `REVOKE ALL ON FUNCTION private\\.${name}\\(\\) FROM PUBLIC, anon, authenticated, service_role;`,
        "i",
      ),
    );
    assert.doesNotMatch(migration, new RegExp(`CREATE FUNCTION public\\.${name}\\(`, "i"));
  }
});
