-- Defense-in-depth hardening following the privilege-escalation incident.
-- Each item is independently safe and addresses a Supabase database-linter finding.

-- -----------------------------------------------------------------------------
-- 1) public_bucket_allows_listing (WARN): drop the broad SELECT on the public
--    `cdn` bucket so clients can no longer enumerate every file via the list API.
--    Safe: the bucket is public (storage.buckets.public = true), so object
--    downloads go through the public object path and bypass RLS. The app only
--    uses getPublicUrl()/remove() on `cdn` (src/lib/storage.ts) — never list()
--    or createSignedUrl() — so removing this policy does not affect delivery.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS cdn_public_read ON storage.objects;

-- -----------------------------------------------------------------------------
-- 2) rls_enabled_no_policy (INFO): these tables have RLS enabled but no policy,
--    which denies all access to anon/authenticated. Add explicit, minimal
--    policies so intent is clear and the linter clears. Writes stay service-role
--    only (no INSERT/UPDATE/DELETE policy => denied; service role bypasses RLS).
-- -----------------------------------------------------------------------------

-- Plan pricing is public, non-sensitive reference data.
DROP POLICY IF EXISTS tier_limits_read_all ON public.tier_limits;
CREATE POLICY tier_limits_read_all
  ON public.tier_limits FOR SELECT
  TO anon, authenticated
  USING (true);

-- Model pricing: readable by signed-in users (used to compute/display costs).
DROP POLICY IF EXISTS ai_model_pricing_read_authenticated ON public.ai_model_pricing;
CREATE POLICY ai_model_pricing_read_authenticated
  ON public.ai_model_pricing FOR SELECT
  TO authenticated
  USING (true);

-- Per-user usage log is sensitive: a user may read ONLY their own rows.
DROP POLICY IF EXISTS ai_usage_log_read_own ON public.ai_usage_log;
CREATE POLICY ai_usage_log_read_own
  ON public.ai_usage_log FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- NOTE (handled outside this migration):
--  * auth_leaked_password_protection (WARN): enable in Supabase dashboard →
--    Authentication → Password security → "Check against HaveIBeenPwned".
--  * anon_security_definer_function_executable for public.list_followers_v1:
--    left granted to `anon` because logged-out visitors view follower previews
--    on public profile pages. Audit the function body to confirm it exposes only
--    public data before revoking; revoking blindly would break public profiles.
--  * The course-co-instructor invite SECURITY DEFINER functions
--    (create/accept/decline/revoke/peek_*) and set_my_project_collaboration_visibility
--    should be reviewed to confirm each verifies caller ownership internally.
-- -----------------------------------------------------------------------------
