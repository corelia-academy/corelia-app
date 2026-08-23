import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createMigrationBaseline, validateMigrationBaseline } from "../lib/migration-baseline.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "corelia-db-guard-"));
  const migrations = join(root, "supabase", "migrations");
  mkdirSync(migrations, { recursive: true });
  writeFileSync(join(migrations, "20260101000000_initial.sql"), "create table public.example (id uuid primary key);\n");
  writeFileSync(join(migrations, "20260102000000_add_name.sql"), "alter table public.example add column name text;\n");
  const baseline = createMigrationBaseline(root, { commitSha: "a".repeat(40), generatedAt: "2026-08-23T00:00:00.000Z" });
  return { root, migrations, baseline };
}

function withFixture(callback) {
  const value = fixture();
  try {
    callback(value);
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
}

test("CASE A: unchanged released migrations pass", () => withFixture(({ root, baseline }) => {
  assert.equal(validateMigrationBaseline(root, baseline).ok, true);
}));

test("CASE B: changed released migration fails", () => withFixture(({ root, migrations, baseline }) => {
  writeFileSync(join(migrations, "20260101000000_initial.sql"), "-- changed\n");
  const result = validateMigrationBaseline(root, baseline);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Released migration changed/);
}));

test("CASE C: deleted released migration fails", () => withFixture(({ root, migrations, baseline }) => {
  rmSync(join(migrations, "20260101000000_initial.sql"));
  const result = validateMigrationBaseline(root, baseline);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /missing or renamed/);
}));

test("CASE D: a valid new migration after the freeze is allowed", () => withFixture(({ root, migrations, baseline }) => {
  writeFileSync(join(migrations, "20260103000000_add_status.sql"), "alter table public.example add column status text;\n");
  const result = validateMigrationBaseline(root, baseline);
  assert.equal(result.ok, true);
  assert.equal(result.newMigrations.length, 1);
}));

test("CASE E: duplicate versions fail", () => withFixture(({ root, migrations, baseline }) => {
  writeFileSync(join(migrations, "20260102000000_duplicate.sql"), "select 1;\n");
  const result = validateMigrationBaseline(root, baseline);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Duplicate migration version/);
}));

test("baseline records raw SHA-256 values", () => withFixture(({ baseline }) => {
  const expected = createHash("sha256").update("create table public.example (id uuid primary key);\n").digest("hex");
  assert.equal(baseline.migrations[0].sha256, expected);
}));
