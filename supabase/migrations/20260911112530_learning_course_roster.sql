-- Course operators need a narrow roster, not access to full private profiles.
CREATE FUNCTION private.learning_course_roster(p_course text)
RETURNS TABLE(id uuid, full_name text, avatar_url text, email text, progress_percent integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  can_students boolean := private.can_manage_course_feature(p_course, auth.uid(), 'students');
  can_submissions boolean := private.can_manage_course_feature(p_course, auth.uid(), 'submissions');
BEGIN
  IF auth.uid() IS NULL OR NOT (can_students OR can_submissions) THEN
    RAISE EXCEPTION 'COURSE_ROSTER_PERMISSION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH available_lessons AS (
    SELECT l.id FROM public.course_lessons l
    WHERE l.course_id = p_course AND l.published AND l.archived_at IS NULL
  ), completions AS (
    SELECT lp.user_id, count(*) AS completed
    FROM public.lesson_progress lp JOIN available_lessons l ON l.id = lp.lesson_id
    WHERE lp.course_id = p_course AND lp.completed_at IS NOT NULL GROUP BY lp.user_id
  ), participants AS (
    SELECT e.user_id FROM public.enrollments e WHERE can_students AND e.course_id = p_course
    UNION
    SELECT s.user_id FROM public.final_assignment_submissions s WHERE can_submissions AND s.course_id = p_course
  )
  SELECT p.id, p.full_name, p.avatar_url,
    CASE WHEN can_students THEN p.email ELSE NULL::text END,
    COALESCE(round(100.0 * COALESCE(c.completed, 0) / NULLIF((SELECT count(*) FROM available_lessons), 0)), 0)::integer
  FROM participants u JOIN public.profiles p ON p.id = u.user_id
  LEFT JOIN completions c ON c.user_id = p.id
  ORDER BY p.full_name, p.id;
END $$;

CREATE FUNCTION public.learning_course_roster(p_course text)
RETURNS TABLE(id uuid, full_name text, avatar_url text, email text, progress_percent integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM private.learning_course_roster(p_course);
$$;
REVOKE ALL ON FUNCTION private.learning_course_roster(text), public.learning_course_roster(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.learning_course_roster(text), public.learning_course_roster(text) TO authenticated;

-- Preserve access to a course's operational panels when a co-instructor has
-- students/submissions/certificates permission but no content-edit permission.
CREATE POLICY learning_operator_course_read ON public.courses FOR SELECT TO authenticated
USING (
  private.can_manage_course_feature(id, (SELECT auth.uid()), 'students')
  OR private.can_manage_course_feature(id, (SELECT auth.uid()), 'submissions')
  OR private.can_manage_course_feature(id, (SELECT auth.uid()), 'certificates')
);

-- Enrollment/follow counters are operational metadata, not content edits.
DROP TRIGGER learning_publication ON public.courses;
CREATE CONSTRAINT TRIGGER learning_publication AFTER INSERT ON public.courses
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION private.learning_publication_guard();
CREATE CONSTRAINT TRIGGER learning_publication_update AFTER UPDATE ON public.courses
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
WHEN (OLD.data IS DISTINCT FROM NEW.data OR OLD.published IS DISTINCT FROM NEW.published OR OLD.archived_at IS DISTINCT FROM NEW.archived_at)
EXECUTE FUNCTION private.learning_publication_guard();
