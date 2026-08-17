-- Forward fix for Issue #319: do not remind learners about unpublished courses.
-- The original reminder RPC is already deployed, so keep this as a new migration.

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
      AND c.published = true
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
