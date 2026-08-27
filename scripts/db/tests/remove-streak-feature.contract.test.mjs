import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "../../..");

describe("Remove Streak Feature Contract Test", () => {
  it("STREAK-01: Streak frontend components and APIs are completely removed", () => {
    const dailyStreakMenuPath = path.join(rootDir, "src/components/layouts/DailyStreakMenu.tsx");
    const dailyStreakLibPath = path.join(rootDir, "src/lib/dailyStreak.ts");
    assert.strictEqual(fs.existsSync(dailyStreakMenuPath), false, "DailyStreakMenu.tsx must be deleted");
    assert.strictEqual(fs.existsSync(dailyStreakLibPath), false, "dailyStreak.ts must be deleted");

    const headerContent = fs.readFileSync(path.join(rootDir, "src/components/layouts/Header.tsx"), "utf8");
    assert.doesNotMatch(headerContent, /DailyStreakMenu/, "Header.tsx must not import or render DailyStreakMenu");

    const authSyncContent = fs.readFileSync(path.join(rootDir, "src/components/auth/AuthSync.tsx"), "utf8");
    assert.doesNotMatch(authSyncContent, /daily streak/i, "AuthSync.tsx must not contain daily streak comments");

    const globalsCssContent = fs.readFileSync(path.join(rootDir, "src/styles/globals.css"), "utf8");
    assert.doesNotMatch(globalsCssContent, /streak-flame-burst/, "globals.css must not contain streak-flame-burst keyframes");

    const enCommon = JSON.parse(fs.readFileSync(path.join(rootDir, "src/locales/en/common.json"), "utf8"));
    const viCommon = JSON.parse(fs.readFileSync(path.join(rootDir, "src/locales/vi/common.json"), "utf8"));
    assert.strictEqual(enCommon.dailyStreak, undefined, "en/common.json must not have dailyStreak namespace");
    assert.strictEqual(viCommon.dailyStreak, undefined, "vi/common.json must not have dailyStreak namespace");
    assert.strictEqual(enCommon.achievements?.badgeCategory?.streak, undefined, "en badgeCategory must not contain streak");
    assert.strictEqual(viCommon.achievements?.badgeCategory?.streak, undefined, "vi badgeCategory must not contain streak");

    const enAdmin = JSON.parse(fs.readFileSync(path.join(rootDir, "src/locales/en/admin.json"), "utf8"));
    const viAdmin = JSON.parse(fs.readFileSync(path.join(rootDir, "src/locales/vi/admin.json"), "utf8"));
    assert.strictEqual(enAdmin.activityMilestones?.event?.loginStreak, undefined);
    assert.strictEqual(enAdmin.activityMilestones?.event?.dailyStreak, undefined);
    assert.strictEqual(viAdmin.activityMilestones?.event?.loginStreak, undefined);
    assert.strictEqual(viAdmin.activityMilestones?.event?.dailyStreak, undefined);
    assert.strictEqual(enAdmin.activityMilestones?.rule?.loginStreak, undefined);
    assert.strictEqual(enAdmin.activityMilestones?.rule?.dailyStreak, undefined);
    assert.strictEqual(viAdmin.activityMilestones?.rule?.loginStreak, undefined);
    assert.strictEqual(viAdmin.activityMilestones?.rule?.dailyStreak, undefined);

    const typesContent = fs.readFileSync(path.join(rootDir, "src/pages/achievements/types.ts"), "utf8");
    assert.doesNotMatch(typesContent, /"streak"/, "BadgeItem category union must not include 'streak'");
  });

  it("STREAK-02: Edge functions have zero streak routing and handlers", () => {
    const dailyStreakEdgePath = path.join(
      rootDir,
      "supabase/functions/corelia-api/gamification/daily_streak.ts",
    );
    assert.strictEqual(fs.existsSync(dailyStreakEdgePath), false, "daily_streak.ts edge function must be deleted");

    const indexContent = fs.readFileSync(path.join(rootDir, "supabase/functions/corelia-api/index.ts"), "utf8");
    assert.doesNotMatch(indexContent, /dailyStreak/i, "corelia-api index.ts must not reference dailyStreak");
    assert.doesNotMatch(indexContent, /gamification\./, "corelia-api index.ts must not route gamification ops");

    const checkActivityContent = fs.readFileSync(
      path.join(rootDir, "supabase/functions/corelia-api/credentials/check_activity.ts"),
      "utf8",
    );
    assert.doesNotMatch(checkActivityContent, /daily_streak|login_streak/, "check_activity.ts must not match streak events");
  });

  it("STREAK-03: Cleanup migration has fail-closed non-CASCADE drops and template deactivation", () => {
    const migrationPath = path.join(
      rootDir,
      "supabase/migrations/20260827130000_remove_daily_streak_feature.sql",
    );
    assert.strictEqual(fs.existsSync(migrationPath), true, "Cleanup migration must exist");
    const migrationContent = fs.readFileSync(migrationPath, "utf8");

    // Deactivation of templates
    assert.match(migrationContent, /UPDATE public\.credential_templates[\s\S]*?SET is_active = false/);
    assert.match(migrationContent, /'daily_streak', 'login_streak', 'login_streak_updated'/);

    // RPC drops
    assert.match(migrationContent, /DROP FUNCTION IF EXISTS public\.claim_daily_streak\(uuid, text\);/);
    assert.match(migrationContent, /DROP FUNCTION IF EXISTS public\.get_daily_streak_status\(uuid\);/);
    assert.match(migrationContent, /DROP FUNCTION IF EXISTS public\.sync_account_connection_points\(uuid\);/);

    // Table drops
    assert.match(migrationContent, /DROP TABLE IF EXISTS public\.user_daily_streak_claims;/);
    assert.match(migrationContent, /DROP TABLE IF EXISTS public\.user_streak_milestone_unlocks;/);
    assert.match(migrationContent, /DROP TABLE IF EXISTS public\.user_daily_streaks;/);
    assert.match(migrationContent, /user_point_ledger is intentionally retained/);
    assert.doesNotMatch(migrationContent, /DROP TABLE IF EXISTS public\.user_point_ledger;/);

    // Profile column drop
    assert.match(migrationContent, /ALTER TABLE public\.profiles DROP COLUMN IF EXISTS streak_days;/);

    // Strict non-cascade invariant
    assert.doesNotMatch(migrationContent, /CASCADE/i, "Migration must not use CASCADE drops");
  });

  it("STREAK-04: Historical docs/streak are preserved verbatim", () => {
    const expectedSha256 = {
      "docs/streak/README.md": "f1941b5645e067789b1a6a670f288efd70cee51a189d4e4f4d55ab3312b56ddf",
      "docs/streak/streak-system.md": "5f2d65ee2de553ac27868c2d4f148c4d6a130daddf58e191cdef3b6ac6c74ca3",
      "docs/streak/streak-ui.md": "cfc9c64eae1230a586efa9b98852757b48c9101cdecf422fc1c699af9ff3bf06",
    };

    for (const [relativePath, expectedHash] of Object.entries(expectedSha256)) {
      const doc = path.join(rootDir, relativePath);
      assert.strictEqual(fs.existsSync(doc), true, `Historical doc must exist: ${doc}`);
      const actualHash = createHash("sha256").update(fs.readFileSync(doc)).digest("hex");
      assert.strictEqual(actualHash, expectedHash, `Historical doc changed: ${relativePath}`);
    }
  });

  it("STREAK-05: Staging deploys the removed API before destructive cleanup", () => {
    const workflowContent = fs.readFileSync(path.join(rootDir, ".github/workflows/deploy-staging.yml"), "utf8");
    const preDeployIndex = workflowContent.indexOf("Deploy corelia-api before destructive Streak cleanup");
    const migrationIndex = workflowContent.indexOf("Apply Supabase migrations");
    const postDeployIndex = workflowContent.indexOf("Deploy Edge Function (corelia-api)");

    assert.ok(preDeployIndex >= 0, "Staging workflow must have a pre-cleanup corelia-api deployment");
    assert.ok(migrationIndex > preDeployIndex, "Pre-cleanup corelia-api deployment must precede migrations");
    assert.ok(postDeployIndex > migrationIndex, "Normal corelia-api deployment must remain after migrations");
    assert.match(workflowContent, /id: streak_cleanup/);
    assert.match(workflowContent, /steps\.streak_cleanup\.outputs\.required == 'true'/);
    assert.match(workflowContent, /20260827130000_remove_daily_streak_feature\.sql/);
  });
});
