import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePostMigrationInspection,
  verifyProductionPostMigration,
} from "../verify-production-post-migration.mjs";

const audit = {
  learner_ai_relations: [],
  learner_ai_functions: [],
  learner_ai_payment_rows: 0,
  learner_ai_quota_columns: [],
  instructor_course_tables_present: {
    courses: true,
    course_sections: true,
    course_lessons: true,
    course_section_questions: true,
  },
};

const migrationOutput = `LOCAL | REMOTE | TIME\n20260828060630 | 20260828060630 | x\n20260830212012 | 20260830212012 | x`;

test("post-migration audit parses the Supabase JSON row", () => {
  assert.deepEqual(
    parsePostMigrationInspection(JSON.stringify([{ learner_ai_retirement_audit: audit }])),
    audit,
  );
});

test("exact learner-AI-free production state passes", () => {
  const result = verifyProductionPostMigration({
    migrationOutput,
    inspectionOutput: JSON.stringify([{ learner_ai_retirement_audit: audit }]),
    localVersions: ["20260828060630", "20260830212012"],
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("remaining AI objects, data, quota columns, or missing course tables fail closed", () => {
  for (const mutation of [
    { learner_ai_relations: [{ object_name: "ai_chat_sessions" }] },
    { learner_ai_functions: [{ function_name: "record_ai_successful_usage" }] },
    { learner_ai_payment_rows: 1 },
    { learner_ai_quota_columns: ["monthly_tokens"] },
    { instructor_course_tables_present: { ...audit.instructor_course_tables_present, courses: false } },
  ]) {
    const result = verifyProductionPostMigration({
      migrationOutput,
      inspectionOutput: JSON.stringify([{ learner_ai_retirement_audit: { ...audit, ...mutation } }]),
      localVersions: ["20260828060630", "20260830212012"],
    });
    assert.equal(result.ok, false);
  }
});
