-- Linter remediation:
-- 1) Avoid per-row auth function re-evaluation in RLS by using (SELECT auth.uid())
-- 2) Remove overlapping permissive policies on course_discounts
-- 3) Drop duplicate trigram indexes on hackathons

-- -----------------------------------------------------------------------------
-- credential_templates: SELECT policy (performance-only rewrite)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS credential_templates_select ON public.credential_templates;
CREATE POLICY credential_templates_select
  ON public.credential_templates FOR SELECT TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.credential_issuances ci
      WHERE ci.template_id = credential_templates.id
        AND ci.user_id = (SELECT auth.uid())
    )
    OR (
      scope_type = 'course'
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_templates.course_id
          AND (
            c.instructor_id = (SELECT auth.uid())
            OR (c.data->'co_instructor_permissions') ? ((SELECT auth.uid())::text)
          )
      )
    )
    OR (
      scope_type = 'hackathon'
      AND EXISTS (
        SELECT 1
        FROM public.hackathons h
        WHERE h.id = credential_templates.hackathon_id
          AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );

-- -----------------------------------------------------------------------------
-- credential_templates: INSERT/UPDATE/DELETE policies (keep strict OCB logic)
-- performance-only rewrite for auth.uid() calls
-- -----------------------------------------------------------------------------
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
                WHERE p.id = (SELECT auth.uid())
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
            AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
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
                WHERE p.id = (SELECT auth.uid())
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
            AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
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
                WHERE p.id = (SELECT auth.uid())
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
            AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
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
                WHERE p.id = (SELECT auth.uid())
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
            AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );

-- -----------------------------------------------------------------------------
-- credential_issuances: SELECT policy (performance-only rewrite)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS credential_issuances_select ON public.credential_issuances;
CREATE POLICY credential_issuances_select
  ON public.credential_issuances FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_support()
    OR (
      course_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_issuances.course_id
          AND (
            c.instructor_id = (SELECT auth.uid())
            OR (c.data->'co_instructor_permissions') ? ((SELECT auth.uid())::text)
          )
      )
    )
    OR (
      hackathon_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.hackathons h
        WHERE h.id = credential_issuances.hackathon_id
          AND (
            public.is_admin_or_support()
            OR (h.document->>'created_by') = ((SELECT auth.uid())::text)
          )
      )
    )
  );

-- -----------------------------------------------------------------------------
-- course_discounts: remove overlapping permissive policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS course_discounts_select ON public.course_discounts;
DROP POLICY IF EXISTS course_discounts_insert ON public.course_discounts;
DROP POLICY IF EXISTS course_discounts_update ON public.course_discounts;
DROP POLICY IF EXISTS course_discounts_delete ON public.course_discounts;
DROP POLICY IF EXISTS course_discounts_write ON public.course_discounts;

CREATE POLICY course_discounts_select
  ON public.course_discounts FOR SELECT
  USING (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'pricing')
  );

CREATE POLICY course_discounts_insert
  ON public.course_discounts FOR INSERT
  WITH CHECK (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'pricing')
  );

CREATE POLICY course_discounts_update
  ON public.course_discounts FOR UPDATE
  USING (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'pricing')
  )
  WITH CHECK (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'pricing')
  );

CREATE POLICY course_discounts_delete
  ON public.course_discounts FOR DELETE
  USING (
    private.can_manage_course_feature(course_id, (SELECT auth.uid()), 'pricing')
  );

-- -----------------------------------------------------------------------------
-- hackathons: remove duplicate trigram indexes
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.contests_document_tagline_trgm_idx;
DROP INDEX IF EXISTS public.contests_document_title_trgm_idx;
