import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const pnpmShell = process.platform === "win32";

function localSupabaseEnvironment() {
  const output = execFileSync(
    command,
    ["exec", "supabase", "status", "--output", "env"],
    { encoding: "utf8", shell: pnpmShell, stdio: ["ignore", "pipe", "inherit"] },
  );
  return Object.fromEntries(output.trim().split(/\r?\n/).map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(?:"([^"]*)"|'([^']*)'|(.*))$/);
    assert.ok(match, `Unexpected Supabase status output field: ${line.split("=", 1)[0]}`);
    return [match[1], match[2] ?? match[3] ?? match[4]];
  }));
}

async function selectCompanies(apiUrl, serviceRoleKey, relationship) {
  const url = new URL("/rest/v1/job_companies", apiUrl);
  url.searchParams.set(
    "select",
    `id,source_id,name,slug,source_type,active,priority,${relationship}`,
  );
  url.searchParams.set("active", "eq.true");
  url.searchParams.set("run_source.enabled", "eq.true");
  url.searchParams.set("run_source.policy_reviewed_at", "not.is.null");
  url.searchParams.set("order", "priority.desc,id.asc");
  url.searchParams.set("limit", "1");

  return fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });
}

const environment = localSupabaseEnvironment();
const apiUrl = environment.API_URL;
const serviceRoleKey = environment.SERVICE_ROLE_KEY;

assert.ok(apiUrl, "Local Supabase API_URL is missing");
assert.ok(serviceRoleKey, "Local Supabase SERVICE_ROLE_KEY is missing");
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(apiUrl).hostname),
  "Refusing to run the PostgREST smoke against a non-local Supabase API",
);

const explicitRelationship =
  "run_source:job_sources!job_companies_source_id_fkey!inner(enabled,policy_reviewed_at)";
const explicitResponse = await selectCompanies(apiUrl, serviceRoleKey, explicitRelationship);
const explicitBodyText = await explicitResponse.text();
assert.equal(
  explicitResponse.status,
  200,
  `Explicit Jobs source relationship must return HTTP 200: ${explicitBodyText}`,
);
assert.ok(Array.isArray(JSON.parse(explicitBodyText)), "Explicit relationship response must be an array");

const ambiguousResponse = await selectCompanies(
  apiUrl,
  serviceRoleKey,
  "run_source:job_sources!inner(enabled,policy_reviewed_at)",
);
const ambiguousBody = await ambiguousResponse.json();
assert.equal(ambiguousResponse.status, 300, "Bare Jobs source relationship must remain an ambiguous request");
assert.equal(ambiguousBody.code, "PGRST201", "Bare Jobs source relationship must fail with PGRST201");

console.log("✓ Jobs PostgREST relationship smoke passed without exposing local credentials.");
