-- Migration: Learning Reminders tracking, RPC candidate evaluator, and notification preferences
-- Supports Issue #319: Inactivity learning reminder cadence (Day 3 -> 7 -> 14 -> 30)

-- 1. Notification preference for learning reminders
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_learning_reminders boolean NOT NULL DEFAULT true;

-- 2. Audit log table for learning reminders
CREATE TABLE IF NOT EXISTS public.learning_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage smallint NOT NULL CHECK (stage IN (3, 7, 14, 30)),
  course_ids text[] NOT NULL DEFAULT '{}',
  sent_at timestamptz NOT NULL DEFAULT now(),
  digest_summary jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_learning_reminder_logs_user_stage
  ON public.learning_reminder_logs (user_id, stage, sent_at DESC);

ALTER TABLE public.learning_reminder_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.learning_reminder_logs FROM PUBLIC;
GRANT ALL ON public.learning_reminder_logs TO service_role;

-- 3. SQL helper function to fetch eligible reminder candidates directly
CREATE OR REPLACE FUNCTION public.get_learning_reminder_candidates()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  locale text,
  days_inactive int,
  stage smallint,
  last_active_at timestamptz,
  in_progress_courses jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  WITH user_inactivities AS (
    SELECT
      e.user_id,
      MAX(e.last_accessed_at) AS last_active,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'slug', c.slug,
          'title', COALESCE(c.data->>'title', c.slug)
        )
      ) AS courses_data
    FROM public.enrollments e
    INNER JOIN public.courses c ON c.id = e.course_id
    WHERE e.completed_at IS NULL
    GROUP BY e.user_id
  ),
  evaluated_users AS (
    SELECT
      u.user_id,
      COALESCE(NULLIF(p.email, ''), au.email) AS email,
      COALESCE(p.full_name, split_part(COALESCE(NULLIF(p.email, ''), au.email), '@', 1)) AS full_name,
      COALESCE(p.locale, 'vi') AS locale,
      FLOOR(EXTRACT(EPOCH FROM (now() - u.last_active)) / 86400)::int AS days_inactive,
      CASE
        WHEN EXTRACT(EPOCH FROM (now() - u.last_active)) / 86400 >= 3 AND EXTRACT(EPOCH FROM (now() - u.last_active)) / 86400 < 7 THEN 3::smallint
        WHEN EXTRACT(EPOCH FROM (now() - u.last_active)) / 86400 >= 7 AND EXTRACT(EPOCH FROM (now() - u.last_active)) / 86400 < 14 THEN 7::smallint
        WHEN EXTRACT(EPOCH FROM (now() - u.last_active)) / 86400 >= 14 AND EXTRACT(EPOCH FROM (now() - u.last_active)) / 86400 < 30 THEN 14::smallint
        WHEN EXTRACT(EPOCH FROM (now() - u.last_active)) / 86400 >= 30 AND EXTRACT(EPOCH FROM (now() - u.last_active)) / 86400 <= 35 THEN 30::smallint
        ELSE NULL::smallint
      END AS stage,
      u.courses_data,
      u.last_active
    FROM user_inactivities u
    INNER JOIN public.profiles p ON p.id = u.user_id
    LEFT JOIN auth.users au ON au.id = u.user_id
    LEFT JOIN public.notification_preferences np ON np.user_id = u.user_id
    WHERE (np.email_learning_reminders IS NULL OR np.email_learning_reminders = true)
  )
  SELECT
    eu.user_id,
    eu.email,
    eu.full_name,
      eu.locale,
      eu.days_inactive,
      eu.stage,
      eu.last_active,
      eu.courses_data
  FROM evaluated_users eu
  WHERE eu.stage IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.learning_reminder_logs l
      WHERE l.user_id = eu.user_id
        AND l.stage = eu.stage
        AND l.sent_at >= eu.last_active
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_learning_reminder_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_learning_reminder_candidates() TO service_role;
