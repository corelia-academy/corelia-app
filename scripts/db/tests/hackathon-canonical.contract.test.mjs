import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260823122000_hackathon_canonical_project_compatibility.sql"),
  "utf8",
);

test("C-09 permits both canonical and legacy hackathon project provenance", () => {
  assert.match(migration, /source_type IN \('standalone', 'contest', 'hackathon', 'course'\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.sync_project_from_hackathon_submission/);
  assert.match(migration, /'hackathon', v_hackathon_id, NEW\.id/);
});

test("C-09 prevents a legacy project from being duplicated on a submission update", () => {
  assert.match(migration, /p\.source_submission_id = NEW\.id[\s\S]*p\.source_type = 'contest'/);
  assert.match(migration, /ON CONFLICT \(owner_id, source_type, source_submission_id\)[\s\S]*DO NOTHING/);
});

test("C-09 keeps collaboration RPCs compatible and non-public", () => {
  assert.match(migration, /v_source_type NOT IN \('contest', 'hackathon'\)/);
  assert.match(migration, /p\.source_type IN \('contest', 'hackathon'\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.create_project_collaboration_invite[\s\S]*FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.list_invitable_hackathon_users[\s\S]*FROM PUBLIC/);
});
