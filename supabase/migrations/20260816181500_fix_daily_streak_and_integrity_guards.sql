-- Forward migration to apply integrity guards, disambiguate streak claim RPC, and support revocation audit.

-- 1. Guard completed_at: ensure authenticated users cannot mutate completed_at directly
CREATE OR REPLACE FUNCTION private.guard_enrollment_completion_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF (
    (TG_OP = 'INSERT' AND NEW.completed_at IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at)
  )
  AND (
    COALESCE(auth.role(), '') IN ('authenticated', 'anon')
    OR (auth.uid() IS NOT NULL AND COALESCE(auth.role(), '') <> 'service_role')
  ) THEN
    RAISE EXCEPTION 'enrollments.completed_at is server-managed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_enrollment_completion_mutation ON public.enrollments;
CREATE TRIGGER trg_guard_enrollment_completion_mutation
  BEFORE INSERT OR UPDATE OF completed_at ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_enrollment_completion_mutation();

-- 2. Disambiguate claim_daily_streak SQL column reference
CREATE OR REPLACE FUNCTION public.claim_daily_streak(
  p_user_id uuid,
  p_timezone text DEFAULT NULL
)
RETURNS TABLE (
  claimed boolean,
  current_streak integer,
  longest_streak integer,
  last_claim_date date,
  timezone text,
  can_claim boolean,
  next_claim_at timestamptz,
  total_points bigint,
  unlocked_milestones smallint[],
  new_milestones smallint[],
  ocid_connected boolean,
  github_connected boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_state public.user_daily_streaks%ROWTYPE;
  v_timezone text;
  v_candidate_timezone text := NULLIF(trim(COALESCE(p_timezone, '')), '');
  v_today date;
  v_previous_streak integer;
  v_current_streak integer;
  v_new_milestones smallint[] := ARRAY[]::smallint[];
BEGIN
  -- Serialize claim creation per user.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT * INTO v_state
  FROM public.user_daily_streaks
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF v_candidate_timezone IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_candidate_timezone) THEN
      v_timezone := v_candidate_timezone;
    ELSE
      v_timezone := 'Asia/Ho_Chi_Minh';
    END IF;

    INSERT INTO public.user_daily_streaks (user_id, timezone)
    VALUES (p_user_id, v_timezone)
    RETURNING * INTO v_state;
  ELSE
    v_timezone := v_state.timezone;
  END IF;

  v_today := (now() AT TIME ZONE v_timezone)::date;

  IF v_state.last_claim_date = v_today THEN
    RETURN QUERY
    SELECT
      false,
      s.current_streak,
      s.longest_streak,
      s.last_claim_date,
      s.timezone,
      false,
      ((v_today + 1)::timestamp AT TIME ZONE s.timezone),
      COALESCE((SELECT sum(points)::bigint FROM public.user_point_ledger WHERE user_id = p_user_id), 0::bigint),
      COALESCE((SELECT array_agg(milestone_days ORDER BY milestone_days) FROM public.user_streak_milestone_unlocks WHERE user_id = p_user_id), ARRAY[]::smallint[]),
      ARRAY[]::smallint[],
      EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND NULLIF(trim(ocid), '') IS NOT NULL),
      EXISTS (SELECT 1 FROM auth.identities WHERE user_id = p_user_id AND provider = 'github')
    FROM public.user_daily_streaks s
    WHERE s.user_id = p_user_id;
    RETURN;
  END IF;

  v_previous_streak := v_state.current_streak;
  v_current_streak := CASE
    WHEN v_state.last_claim_date = v_today - 1 THEN v_state.current_streak + 1
    ELSE 1
  END;

  UPDATE public.user_daily_streaks AS uds
  SET current_streak = v_current_streak,
      longest_streak = GREATEST(uds.longest_streak, v_current_streak),
      last_claim_date = v_today,
      updated_at = now()
  WHERE uds.user_id = p_user_id
  RETURNING * INTO v_state;

  INSERT INTO public.user_daily_streak_claims (
    user_id, claim_date, timezone, previous_streak, current_streak
  ) VALUES (
    p_user_id, v_today, v_timezone, v_previous_streak, v_current_streak
  );

  INSERT INTO public.user_point_ledger (user_id, source, source_key, points)
  VALUES (p_user_id, 'daily_streak_claim', 'daily:' || v_today::text, 1)
  ON CONFLICT (user_id, source_key) DO NOTHING;

  WITH inserted AS (
    INSERT INTO public.user_streak_milestone_unlocks (user_id, milestone_days, claim_date)
    SELECT p_user_id, milestone_days, v_today
    FROM unnest(ARRAY[3, 7, 14, 30]::smallint[]) AS milestones(milestone_days)
    WHERE milestone_days <= v_current_streak
    ON CONFLICT (user_id, milestone_days) DO NOTHING
    RETURNING milestone_days
  )
  SELECT COALESCE(array_agg(milestone_days ORDER BY milestone_days), ARRAY[]::smallint[])
  INTO v_new_milestones
  FROM inserted;

  PERFORM public.sync_account_connection_points(p_user_id);

  RETURN QUERY
  SELECT
    true,
    v_state.current_streak,
    v_state.longest_streak,
    v_state.last_claim_date,
    v_state.timezone,
    false,
    ((v_today + 1)::timestamp AT TIME ZONE v_state.timezone),
    COALESCE((SELECT sum(points)::bigint FROM public.user_point_ledger WHERE user_id = p_user_id), 0::bigint),
    COALESCE((SELECT array_agg(milestone_days ORDER BY milestone_days) FROM public.user_streak_milestone_unlocks WHERE user_id = p_user_id), ARRAY[]::smallint[]),
    COALESCE(v_new_milestones, ARRAY[]::smallint[]),
    EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND NULLIF(trim(ocid), '') IS NOT NULL),
    EXISTS (SELECT 1 FROM auth.identities WHERE user_id = p_user_id AND provider = 'github');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_streak(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_daily_streak(uuid, text) TO service_role;

-- 3. Support 'revoked' status and audit trail for credential issuances
ALTER TABLE public.credential_issuances
  DROP CONSTRAINT IF EXISTS credential_issuances_status_check;

ALTER TABLE public.credential_issuances
  ADD CONSTRAINT credential_issuances_status_check
  CHECK (status IN ('pending', 'minted', 'failed', 'revoked'));

ALTER TABLE public.credential_issuances
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_reason text;
