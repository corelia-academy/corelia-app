# Remove Streak: Staging Readiness Walkthrough

## Base and branch

- Branch: `feat/remove-streak`
- Base: `origin/staging` at `82a9f9948210e38ebc162ff483d1988fa28369a4`
- `docs/streak/` is preserved byte-for-byte.
- Historical Streak migrations are not rewritten.

## Runtime scope removed

- Deleted the Streak header menu and client API module.
- Removed the `corelia-api` Streak route and handler.
- Removed Streak activity-milestone matching, admin rule options, locale keys,
  badge category, and the unused flame animation.
- Removed Streak-only controls from the milestone test page.

## Database scope

`supabase/migrations/20260827130000_remove_daily_streak_feature.sql`:

- Deactivates automatic activity-milestone templates for `daily_streak`,
  `login_streak`, and `login_streak_updated`.
- Drops `claim_daily_streak`, `get_daily_streak_status`, and
  `sync_account_connection_points`.
- Drops `user_daily_streak_claims`, `user_streak_milestone_unlocks`, and
  `user_daily_streaks`.
- Drops the deprecated `profiles.streak_days` column.
- Retains `user_point_ledger` because it also contains `ocid_connected` and
  `github_connected` point history, which is not exclusively Streak data.

## Staging rollout order

The staging workflow detects this cleanup migration and deploys the new
`corelia-api` before applying migrations. This makes the new Edge code live
before the RPCs are removed. The normal post-migration `corelia-api` deployment
remains in place as a convergence step.

The frontend build is handled by the separate Workers/frontend deployment
pipeline described in `.github/workflows/deploy-staging.yml`.

## Validation

- `pnpm test`: 28/28 files, 172/172 tests passed.
- `pnpm db:verify`: 211/211 contract tests passed.
- `pnpm lint`: passed with 0 errors and 0 warnings.
- `pnpm build`: passed.
- `pnpm build:staging`: passed.
- `pnpm db:verify:local`: passed all local SQL, concurrency, and HTTP callback
  integration gates.
- `git diff --check`: passed.
- Active `src/` and `supabase/functions/` Streak reference scan: no matches.

## Explicit non-actions

- No commit, push, merge, or deploy is performed by this walkthrough.
- Actual Staging migration ledger, catalog, row counts, and runtime smoke tests
  must be checked by the deployment operator after the branch is approved.
