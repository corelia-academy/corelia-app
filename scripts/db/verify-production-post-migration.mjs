import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMigrationList } from "./verify-production-migration-state.mjs";

export function parsePostMigrationInspection(raw) {
  const parsed = JSON.parse(raw);
  const rows = Array.isArray(parsed) ? parsed : parsed.result ?? parsed.data ?? [];
  const row = Array.isArray(rows) ? rows[0] : rows;
  const audit = row?.learner_ai_retirement_audit ?? row?.audit ?? row;
  if (!audit || typeof audit !== "object") {
    throw new Error("Inspection output does not contain learner_ai_retirement_audit");
  }
  return audit;
}

export function verifyProductionPostMigration({ migrationOutput, inspectionOutput, localVersions }) {
  const errors = [];
  let remoteVersions = [];
  let audit;
  try {
    remoteVersions = parseMigrationList(migrationOutput);
  } catch (error) {
    errors.push(error.message);
  }
  try {
    audit = parsePostMigrationInspection(inspectionOutput);
  } catch (error) {
    errors.push(error.message);
  }

  if (remoteVersions.length && JSON.stringify(remoteVersions) !== JSON.stringify(localVersions)) {
    errors.push("Production migration ledger does not exactly match the repository migration chain.");
  }

  if (audit) {
    for (const key of ["learner_ai_relations", "learner_ai_functions", "learner_ai_quota_columns"]) {
      if (!Array.isArray(audit[key]) || audit[key].length !== 0) {
        errors.push(`${key} must be an empty array.`);
      }
    }
    if (audit.learner_ai_payment_rows !== 0) {
      errors.push("learner_ai_payment_rows must be zero.");
    }
    if (audit.vector_extension_installed !== false) {
      errors.push("vector_extension_installed must be false.");
    }
    const courseTables = audit.instructor_course_tables_present ?? {};
    for (const table of ["courses", "course_sections", "course_lessons", "course_section_questions"]) {
      if (courseTables[table] !== true) errors.push(`Required instructor table ${table} is missing.`);
    }
  }

  return { ok: errors.length === 0, errors, remoteVersions, audit };
}

function repositoryMigrationVersions(root = process.cwd()) {
  return readdirSync(resolve(root, "supabase/migrations"))
    .map((name) => name.match(/^(\d{14})_[^/]+\.sql$/)?.[1])
    .filter(Boolean)
    .sort();
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [, , migrationPath, inspectionPath] = process.argv;
  if (!migrationPath || !inspectionPath) {
    console.error("Usage: node scripts/db/verify-production-post-migration.mjs <migration-list-output> <inspection-output>");
    process.exit(2);
  }
  const result = verifyProductionPostMigration({
    migrationOutput: readFileSync(migrationPath, "utf8"),
    inspectionOutput: readFileSync(inspectionPath, "utf8"),
    localVersions: repositoryMigrationVersions(),
  });
  if (!result.ok) {
    for (const error of result.errors) console.error(error);
    process.exit(1);
  }
  console.log("Production learner-AI retirement verification passed.");
}
