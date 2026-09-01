import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260901002156_remove_dashboard_configs_and_tier_limits.sql", import.meta.url),
  "utf8",
);
const appRouter = readFileSync(new URL("../../../src/App.tsx", import.meta.url), "utf8");
const homeHook = readFileSync(
  new URL("../../../src/pages/home/hooks/useHomeUserDashboard.ts", import.meta.url),
  "utf8",
);
const productionAudit = readFileSync(
  new URL("../audit-production-ai-state.sql", import.meta.url),
  "utf8",
);

test("unused configuration tables are dropped without CASCADE", () => {
  assert.match(migration, /DROP TABLE public\.dashboard_configs;/);
  assert.match(migration, /DROP TABLE public\.tier_limits;/);
  assert.doesNotMatch(migration, /DROP TABLE[^;]*CASCADE/i);
  assert.match(migration, /CONFIG_TABLE_RETIREMENT_INCOMPLETE/);
});

test("dashboard pinning has no runtime route or Home query", () => {
  assert.doesNotMatch(appRouter, /admin\/dashboard|AdminDashboard/);
  assert.doesNotMatch(homeHook, /dashboardConfig|dashboard_configs|pinned_programs/i);
});

test("production audit fails closed when either retired table remains", () => {
  assert.match(productionAudit, /dashboard_configs/);
  assert.match(productionAudit, /tier_limits/);
  assert.match(productionAudit, /retired_config_relations/);
});
