-- Return only the text skills earned from completed courses. The function
-- exposes a public profile's skills, or the signed-in owner's skills when the
-- profile is private; enrollment rows remain protected by their existing RLS.
CREATE OR REPLACE FUNCTION public.list_profile_course_skills(p_profile_id uuid)
RETURNS TABLE (skill text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT distinct_skills.skill
  FROM (
    SELECT DISTINCT btrim(source.skill) AS skill
    FROM public.enrollments AS enrollment
    INNER JOIN public.public_profiles AS profile
      ON profile.id = enrollment.user_id
    INNER JOIN public.courses AS course
      ON course.id = enrollment.course_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(course.data->'skills') = 'array' THEN course.data->'skills'
        ELSE '[]'::jsonb
      END
    ) AS source(skill)
    WHERE enrollment.user_id = p_profile_id
      AND enrollment.completed_at IS NOT NULL
      AND (profile.profile_public = true OR enrollment.user_id = (select auth.uid()))
      AND btrim(source.skill) <> ''
  ) AS distinct_skills
  ORDER BY lower(distinct_skills.skill), distinct_skills.skill;
$$;

REVOKE ALL ON FUNCTION public.list_profile_course_skills(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_profile_course_skills(uuid) TO anon, authenticated;
