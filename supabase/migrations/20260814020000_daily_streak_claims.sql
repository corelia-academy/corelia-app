-- Daily streak / reward ledger.
--
-- Claiming is intentionally server-mediated.  Clients may read their own rows
-- through RLS, but cannot create a claim, change its local date, or add points.

CREATE TABLE IF NOT EXISTS public.user_daily_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak integer NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_claim_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_daily_streak_claims (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  claim_date date NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  timezone text NOT NULL,
  previous_streak integer NOT NULL CHECK (previous_streak >= 0),
  current_streak integer NOT NULL CHECK (current_streak >= 1),
  PRIMARY KEY (user_id, claim_date)
);

CREATE INDEX IF NOT EXISTS user_daily_streak_claims_claimed_at_idx
  ON public.user_daily_streak_claims (user_id, claimed_at DESC);

CREATE TABLE IF NOT EXISTS public.user_point_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('daily_streak_claim', 'ocid_connected', 'github_connected')),
  source_key text NOT NULL,
  points integer NOT NULL CHECK (points <> 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_key)
);

CREATE INDEX IF NOT EXISTS user_point_ledger_user_created_idx
  ON public.user_point_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_streak_milestone_unlocks (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  milestone_days smallint NOT NULL CHECK (milestone_days IN (3, 7, 14, 30)),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  claim_date date NOT NULL,
  PRIMARY KEY (user_id, milestone_days)
);

ALTER TABLE public.user_daily_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_streak_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_point_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streak_milestone_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_daily_streaks_select_own
  ON public.user_daily_streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_daily_streak_claims_select_own
  ON public.user_daily_streak_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_point_ledger_select_own
  ON public.user_point_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_streak_milestone_unlocks_select_own
  ON public.user_streak_milestone_unlocks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Award connection bonuses at most once, based on data controlled by Corelia
-- (profiles) and Supabase Auth (auth.identities), never a browser flag.
CREATE OR REPLACE FUNCTION public.sync_account_connection_points(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND NULLIF(trim(ocid), '') IS NOT NULL
  ) THEN
    INSERT INTO public.user_point_ledger (user_id, source, source_key, points)
    VALUES (p_user_id, 'ocid_connected', 'ocid_connected', 50)
    ON CONFLICT (user_id, source_key) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.identities
    WHERE user_id = p_user_id
      AND provider = 'github'
  ) THEN
    INSERT INTO public.user_point_ledger (user_id, source, source_key, points)
    VALUES (p_user_id, 'github_connected', 'github_connected', 50)
    ON CONFLICT (user_id, source_key) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_streak_status(p_user_id uuid)
RETURNS TABLE (
  current_streak integer,
  longest_streak integer,
  last_claim_date date,
  timezone text,
  can_claim boolean,
  next_claim_at timestamptz,
  total_points bigint,
  unlocked_milestones smallint[],
  ocid_connected boolean,
  github_connected boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_state public.user_daily_streaks%ROWTYPE;
  v_timezone text := 'Asia/Ho_Chi_Minh';
  v_today date;
  v_effective_current_streak integer := 0;
BEGIN
  PERFORM public.sync_account_connection_points(p_user_id);

  SELECT * INTO v_state
  FROM public.user_daily_streaks
  WHERE user_id = p_user_id;

  IF FOUND THEN
    v_timezone := v_state.timezone;
    v_today := (now() AT TIME ZONE v_timezone)::date;
    -- If user claimed today or yesterday, streak is currently alive.
    -- If user missed yesterday (last_claim_date < today - 1) or never claimed, active streak is 0.
    IF v_state.last_claim_date = v_today OR v_state.last_claim_date = v_today - 1 THEN
      v_effective_current_streak := COALESCE(v_state.current_streak, 0);
    ELSE
      v_effective_current_streak := 0;
    END IF;
  ELSE
    v_today := (now() AT TIME ZONE v_timezone)::date;
  END IF;

  RETURN QUERY
  SELECT
    v_effective_current_streak,
    COALESCE(v_state.longest_streak, 0),
    v_state.last_claim_date,
    v_timezone,
    COALESCE(v_state.last_claim_date IS DISTINCT FROM v_today, true),
    CASE
      WHEN v_state.last_claim_date = v_today
        THEN ((v_today + 1)::timestamp AT TIME ZONE v_timezone)
      ELSE NULL
    END,
    COALESCE((
      SELECT sum(points)::bigint
      FROM public.user_point_ledger
      WHERE user_id = p_user_id
    ), 0::bigint),
    COALESCE((
      SELECT array_agg(milestone_days ORDER BY milestone_days)
      FROM public.user_streak_milestone_unlocks
      WHERE user_id = p_user_id
    ), ARRAY[]::smallint[]),
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_user_id AND NULLIF(trim(ocid), '') IS NOT NULL
    ),
    EXISTS (
      SELECT 1 FROM auth.identities
      WHERE user_id = p_user_id AND provider = 'github'
    );
END;
$$;

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
  -- Serialize claim creation per user.  The unique claim key remains a second
  -- guard against duplicate requests from multiple tabs/retries.
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
    -- Timezone is intentionally fixed after the first claim.  A later profile
    -- timezone setting can change it with an effective-next-day policy, without
    -- allowing a second claim by hopping timezones in the same UTC day.
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

REVOKE ALL ON FUNCTION public.sync_account_connection_points(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_daily_streak_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_daily_streak(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_streak_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_daily_streak(uuid, text) TO service_role;
