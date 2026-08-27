-- Forward migration: Remove Daily Streak runtime feature objects and legacy dependencies.
-- Preserves docs/streak history, issued credential records, generic activity milestones,
-- and non-Streak point ledger history.
-- Uses explicit RESTRICT/fail-closed drops to ensure safety.

-- 1. Deactivate automatic activity milestone credential templates linked to streak events.
UPDATE public.credential_templates
SET is_active = false,
    updated_at = now()
WHERE scope_type = 'activity_milestone'
  AND trigger_type = 'auto'
  AND trigger_rule->>'event' IN ('daily_streak', 'login_streak', 'login_streak_updated');

-- 2. Drop Streak-specific RPCs
DROP FUNCTION IF EXISTS public.claim_daily_streak(uuid, text);
DROP FUNCTION IF EXISTS public.get_daily_streak_status(uuid);
DROP FUNCTION IF EXISTS public.sync_account_connection_points(uuid);

-- 3. Drop Streak-specific tables in reverse dependency order.
-- user_point_ledger is intentionally retained: its source constraint also stores
-- ocid_connected and github_connected point history, which is not exclusively Streak data.
DROP TABLE IF EXISTS public.user_daily_streak_claims;
DROP TABLE IF EXISTS public.user_streak_milestone_unlocks;
DROP TABLE IF EXISTS public.user_daily_streaks;

-- 4. Drop legacy/deprecated streak column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS streak_days;
