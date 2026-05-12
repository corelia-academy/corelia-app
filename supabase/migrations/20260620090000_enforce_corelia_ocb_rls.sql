-- Enforce strict OCB write access for course credential templates:
-- - only course templates for Corelia-owned courses
-- - only admin/support or Corelia instructors

DROP POLICY IF EXISTS credential_templates_insert ON public.credential_templates;
DROP POLICY IF EXISTS credential_templates_update ON public.credential_templates;
DROP POLICY IF EXISTS credential_templates_delete ON public.credential_templates;

CREATE POLICY credential_templates_insert
  ON public.credential_templates FOR INSERT TO authenticated
  WITH CHECK (
    (
      scope_type = 'course'
      AND course_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_templates.course_id
          AND COALESCE(c.data->>'owner_type', 'corelia') = 'corelia'
          AND (
            public.is_admin_or_support()
            OR (
              public.current_profile_role() = 'instructor'
              AND EXISTS (
                SELECT 1
                FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.instructor_origin = 'corelia'
              )
            )
          )
      )
    )
    OR (
      scope_type = 'hackathon'
      AND hackathon_id IS NOT NULL
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = (auth.uid()::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );

CREATE POLICY credential_templates_update
  ON public.credential_templates FOR UPDATE TO authenticated
  USING (
    (
      scope_type = 'course'
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_templates.course_id
          AND COALESCE(c.data->>'owner_type', 'corelia') = 'corelia'
          AND (
            public.is_admin_or_support()
            OR (
              public.current_profile_role() = 'instructor'
              AND EXISTS (
                SELECT 1
                FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.instructor_origin = 'corelia'
              )
            )
          )
      )
    )
    OR (
      scope_type = 'hackathon'
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = (auth.uid()::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  )
  WITH CHECK (
    (
      scope_type = 'course'
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_templates.course_id
          AND COALESCE(c.data->>'owner_type', 'corelia') = 'corelia'
          AND (
            public.is_admin_or_support()
            OR (
              public.current_profile_role() = 'instructor'
              AND EXISTS (
                SELECT 1
                FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.instructor_origin = 'corelia'
              )
            )
          )
      )
    )
    OR (
      scope_type = 'hackathon'
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = (auth.uid()::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );

CREATE POLICY credential_templates_delete
  ON public.credential_templates FOR DELETE TO authenticated
  USING (
    (
      scope_type = 'course'
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_templates.course_id
          AND COALESCE(c.data->>'owner_type', 'corelia') = 'corelia'
          AND (
            public.is_admin_or_support()
            OR (
              public.current_profile_role() = 'instructor'
              AND EXISTS (
                SELECT 1
                FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.instructor_origin = 'corelia'
              )
            )
          )
      )
    )
    OR (
      scope_type = 'hackathon'
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = (auth.uid()::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );
