-- Tighten course-domain policies so co-instructors only write within their
-- assigned feature scope, and root course writes stay owner/staff only.

DROP POLICY IF EXISTS courses_update_manager ON public.courses;
CREATE POLICY courses_update_manager
  ON public.courses FOR UPDATE
  USING (
    private.can_manage_course(id, (SELECT auth.uid()))
  )
  WITH CHECK (
    private.can_manage_course(id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS course_sections_all ON public.course_sections;
CREATE POLICY course_sections_all
  ON public.course_sections FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content')
        )
    )
  )
  WITH CHECK (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content')
  );

DROP POLICY IF EXISTS course_lessons_all ON public.course_lessons;
CREATE POLICY course_lessons_all
  ON public.course_lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content')
        )
    )
  )
  WITH CHECK (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content')
  );

DROP POLICY IF EXISTS course_locales_all ON public.course_locales;
CREATE POLICY course_locales_all
  ON public.course_locales FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content')
        )
    )
  )
  WITH CHECK (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content')
  );

DROP POLICY IF EXISTS course_section_locales_all ON public.course_section_locales;
CREATE POLICY course_section_locales_all
  ON public.course_section_locales FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content')
        )
    )
  )
  WITH CHECK (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content')
  );

DROP POLICY IF EXISTS course_lesson_locales_all ON public.course_lesson_locales;
CREATE POLICY course_lesson_locales_all
  ON public.course_lesson_locales FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content')
        )
    )
  )
  WITH CHECK (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'content')
  );

DROP POLICY IF EXISTS course_discounts_select ON public.course_discounts;
CREATE POLICY course_discounts_select
  ON public.course_discounts FOR SELECT
  USING (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'pricing')
  );

DROP POLICY IF EXISTS course_discounts_write ON public.course_discounts;
CREATE POLICY course_discounts_write
  ON public.course_discounts FOR ALL
  USING (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'pricing')
  )
  WITH CHECK (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'pricing')
  );

DROP POLICY IF EXISTS fas_select ON public.final_assignment_submissions;
CREATE POLICY fas_select
  ON public.final_assignment_submissions FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'submissions')
  );

DROP POLICY IF EXISTS fas_update_reviewers ON public.final_assignment_submissions;
CREATE POLICY fas_update_reviewers
  ON public.final_assignment_submissions FOR UPDATE
  USING (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'submissions')
  )
  WITH CHECK (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'submissions')
  );
