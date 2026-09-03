import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260901104414_harden_hackathon_project_rpc_boundary.sql",
  ),
  "utf8",
);

const signature = String.raw`upsert_hackathon_project\(\s*text, uuid, text, text, text, text, text, text, text, text, text,\s*text\[\], text\[\], text\[\]\s*\)`;

test("hackathon project RPC keeps the privileged implementation out of public", () => {
  assert.match(
    migration,
    new RegExp(`ALTER FUNCTION public\\.${signature} SET SCHEMA private;`, "i"),
  );
  assert.match(
    migration,
    new RegExp(`REVOKE ALL ON FUNCTION private\\.${signature} FROM PUBLIC, anon, authenticated, service_role;`, "i"),
  );
});

test("hackathon project public wrapper is an authenticated invoker", () => {
  const wrapperStart = migration.indexOf("CREATE FUNCTION public.upsert_hackathon_project");
  const wrapperEnd = migration.indexOf("REVOKE ALL ON FUNCTION public.upsert_hackathon_project", wrapperStart);
  const wrapper = migration.slice(wrapperStart, wrapperEnd);

  assert.notEqual(wrapperStart, -1);
  assert.match(wrapper, /SECURITY INVOKER/i);
  assert.match(wrapper, /SET search_path = ''/i);
  assert.match(wrapper, /private\.upsert_hackathon_project\(/i);
  assert.doesNotMatch(wrapper, /SECURITY DEFINER/i);
  assert.match(
    migration,
    new RegExp(`REVOKE ALL ON FUNCTION public\\.${signature} FROM PUBLIC, anon, authenticated, service_role;`, "i"),
  );
  assert.match(
    migration,
    new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${signature} TO authenticated;`, "i"),
  );
});
