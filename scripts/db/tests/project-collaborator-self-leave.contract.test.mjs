import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260920090000_project_collaborator_self_leave.sql"),
  "utf8",
);

test("#499 self-leave is authenticated, self-only, and owner-protected", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.leave_project\(p_project_id uuid\)/);
  assert.match(migration, /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(migration, /v_uid uuid := auth\.uid\(\)/);
  assert.match(migration, /RAISE EXCEPTION 'forbidden:project_owner'/);
  assert.match(
    migration,
    /DELETE FROM public\.project_collaborators[\s\S]*?WHERE project_id = p_project_id[\s\S]*?AND user_id = v_uid/,
  );
  assert.ok(
    migration.indexOf("forbidden:project_owner") < migration.indexOf("DELETE FROM public.project_collaborators"),
    "owner guard must run before the membership delete",
  );
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.leave_project\(p_project_id uuid\)/);
  assert.match(migration, /SECURITY INVOKER[\s\S]*SELECT private\.leave_project\(p_project_id\)/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.leave_project\(uuid\) TO authenticated/);
});
