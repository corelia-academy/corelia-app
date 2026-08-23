import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260823120000_seed_projects_without_overwrite.sql"),
  "utf8",
);

const functionBlock = (name) => {
  const match = migration.match(new RegExp(`CREATE OR REPLACE FUNCTION private\\.${name}\\(\\)[\\s\\S]*?\\n\\$\\$;`));
  assert.ok(match, `${name} must be redefined by the C-06 migration`);
  return match[0];
};

test("Case 1: both submission flows seed a project on the first insert", () => {
  assert.match(functionBlock("sync_project_from_contest_submission"), /INSERT INTO public\.projects/);
  assert.match(functionBlock("sync_project_from_final_assignment_submission"), /INSERT INTO public\.projects/);
});

test("Case 2: submission updates cannot overwrite an existing contest project", () => {
  const block = functionBlock("sync_project_from_contest_submission");
  assert.match(block, /ON CONFLICT \(owner_id, source_type, source_submission_id\)\s+DO NOTHING;/);
  assert.doesNotMatch(block, /DO UPDATE SET/);
});

test("Case 3: a user-edited project remains independent after a submission update", () => {
  const block = functionBlock("sync_project_from_contest_submission");
  for (const field of ["title", "summary", "demo_url", "repo_url", "slide_url", "screenshot_url", "cover_image_url", "video_url"]) {
    assert.match(block, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(block, /DO UPDATE SET/);
});

test("Case 4: retries are idempotent through the existing source-key conflict target", () => {
  for (const name of ["sync_project_from_contest_submission", "sync_project_from_final_assignment_submission"]) {
    assert.match(functionBlock(name), /ON CONFLICT \(owner_id, source_type, source_submission_id\)\s+DO NOTHING;/);
  }
});

test("Case 5: seeded projects retain source provenance", () => {
  for (const name of ["sync_project_from_contest_submission", "sync_project_from_final_assignment_submission"]) {
    const block = functionBlock(name);
    assert.match(block, /source_type,[\s\S]*source_id,[\s\S]*source_submission_id/);
    assert.match(block, /NEW\.id/);
  }
});

test("Case 6: C-06 does not claim an unsupported polymorphic source foreign key", () => {
  assert.doesNotMatch(migration, /ALTER TABLE public\.projects[\s\S]*FOREIGN KEY/);
  assert.doesNotMatch(migration, /CREATE UNIQUE INDEX/);
});
