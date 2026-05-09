-- Performance + policy simplification:
-- - Fix auth_rls_initplan by wrapping auth.*() calls in (select ...)
-- - Merge multiple permissive policies per role+action where possible

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) public.hackathons: remove overlapping FOR ALL policy; keep 1 policy per action
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS hackathons_write_staff ON public.hackathons;
DROP POLICY IF EXISTS hackathons_select ON public.hackathons;
DROP POLICY IF EXISTS hackathons_insert_instructor_corelia ON public.hackathons;
DROP POLICY IF EXISTS hackathons_update_creator_staff ON public.hackathons;

-- SELECT: public statuses; plus staff; plus creator.
CREATE POLICY hackathons_select
  ON public.hackathons FOR SELECT
  USING (
    status IN ('published', 'running', 'ended')
    OR public.is_admin_or_support()
    OR (document->>'created_by') = ((SELECT auth.uid())::text)
  );

-- INSERT: staff OR corelia instructor
CREATE POLICY hackathons_insert_instructor_corelia
  ON public.hackathons FOR INSERT
  WITH CHECK (
    public.is_admin_or_support()
    OR (
      public.current_profile_role() = 'instructor'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = (SELECT auth.uid()) AND p.instructor_origin = 'corelia'
      )
    )
  );

-- UPDATE: staff OR creator
CREATE POLICY hackathons_update_creator_staff
  ON public.hackathons FOR UPDATE
  USING (
    public.is_admin_or_support()
    OR (document->>'created_by') = ((SELECT auth.uid())::text)
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (document->>'created_by') = ((SELECT auth.uid())::text)
  );

-- DELETE: staff only
DROP POLICY IF EXISTS hackathons_delete_staff ON public.hackathons;
CREATE POLICY hackathons_delete_staff
  ON public.hackathons FOR DELETE
  USING (public.is_admin_or_support());

-- -----------------------------------------------------------------------------
-- 2) public.hackathon_registrations: fix auth_rls_initplan in update reviewer policy
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS hackathon_registrations_update_staff_or_reviewer ON public.hackathon_registrations;
CREATE POLICY hackathon_registrations_update_staff_or_reviewer
  ON public.hackathon_registrations
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      INNER JOIN public.profiles p ON p.id = (SELECT auth.uid())
      WHERE h.id = hackathon_registrations.hackathon_id
        AND p.email IS NOT NULL
        AND trim(lower(p.email::text)) IN (
          SELECT trim(lower(elem))
          FROM jsonb_array_elements_text(
            COALESCE(h.document->'reviewer_emails', '[]'::jsonb)
          ) AS elem
        )
    )
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      INNER JOIN public.profiles p ON p.id = (SELECT auth.uid())
      WHERE h.id = hackathon_registrations.hackathon_id
        AND p.email IS NOT NULL
        AND trim(lower(p.email::text)) IN (
          SELECT trim(lower(elem))
          FROM jsonb_array_elements_text(
            COALESCE(h.document->'reviewer_emails', '[]'::jsonb)
          ) AS elem
        )
    )
  );

-- -----------------------------------------------------------------------------
-- 3) public.career_tracks: merge SELECT policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS career_tracks_select_public_published ON public.career_tracks;
DROP POLICY IF EXISTS career_tracks_select_owner_or_staff ON public.career_tracks;

CREATE POLICY career_tracks_select_visible
  ON public.career_tracks FOR SELECT
  TO anon, authenticated
  USING (
    published = true
    OR public.is_admin_or_support()
    OR (owner_scope = 'instructor' AND instructor_id = (SELECT auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 4) public.hackathon_access_invites: split FOR ALL manage policy into per-action
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS hackathon_invites_manage_staff_or_creator ON public.hackathon_access_invites;
DROP POLICY IF EXISTS hackathon_invites_select_self_by_email ON public.hackathon_access_invites;
DROP POLICY IF EXISTS hackathon_invites_update_self_response_only ON public.hackathon_access_invites;

-- SELECT: staff/creator OR invitee by email
CREATE POLICY hackathon_invites_select_visible
  ON public.hackathon_access_invites FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
    OR (document->>'email') = public.current_email()
  );

-- INSERT/UPDATE/DELETE: staff/creator only (self-response handled by UPDATE below; trigger restricts fields)
DROP POLICY IF EXISTS hackathon_invites_insert_manage_staff_or_creator ON public.hackathon_access_invites;
CREATE POLICY hackathon_invites_insert_manage_staff_or_creator
  ON public.hackathon_access_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
  );

-- UPDATE: staff/creator OR invitee by email (trigger restricts self-update)
DROP POLICY IF EXISTS hackathon_invites_update_visible ON public.hackathon_access_invites;
CREATE POLICY hackathon_invites_update_visible
  ON public.hackathon_access_invites FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
    OR (document->>'email') = public.current_email()
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
    OR (document->>'email') = public.current_email()
  );

DROP POLICY IF EXISTS hackathon_invites_delete_manage_staff_or_creator ON public.hackathon_access_invites;
CREATE POLICY hackathon_invites_delete_manage_staff_or_creator
  ON public.hackathon_access_invites FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
  );

-- -----------------------------------------------------------------------------
-- 5) public.project_collaboration_invites: merge UPDATE policies
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS project_collab_invites_update_invitee_response ON public.project_collaboration_invites;
DROP POLICY IF EXISTS project_collab_invites_update_manager ON public.project_collaboration_invites;

CREATE POLICY project_collab_invites_update_visible
  ON public.project_collaboration_invites FOR UPDATE
  TO authenticated
  USING (
    private.can_manage_project(project_id, (SELECT auth.uid()))
    OR (
      invitee_user_id = (SELECT auth.uid())
      AND status = 'pending'
      AND expires_at > now()
    )
  )
  WITH CHECK (
    private.can_manage_project(project_id, (SELECT auth.uid()))
    OR (
      invitee_user_id = (SELECT auth.uid())
      AND status IN ('accepted', 'declined')
    )
  );

-- -----------------------------------------------------------------------------
-- 6) public.project_collaborators: replace broad FOR ALL policy with 1 policy per action
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS project_collaborators_select ON public.project_collaborators;
DROP POLICY IF EXISTS project_collaborators_manage_owner ON public.project_collaborators;
DROP POLICY IF EXISTS project_collaborators_insert_from_invite ON public.project_collaborators;

CREATE POLICY project_collaborators_select_visible
  ON public.project_collaborators FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.can_manage_project(project_id, (SELECT auth.uid()))
  );

CREATE POLICY project_collaborators_insert_visible
  ON public.project_collaborators FOR INSERT
  TO authenticated
  WITH CHECK (
    private.can_manage_project(project_id, (SELECT auth.uid()))
    OR (
      user_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.project_collaboration_invites i
        WHERE i.project_id = project_collaborators.project_id
          AND i.invitee_user_id = (SELECT auth.uid())
          AND i.status = 'pending'
          AND i.expires_at > now()
      )
    )
  );

CREATE POLICY project_collaborators_update_manage
  ON public.project_collaborators FOR UPDATE
  TO authenticated
  USING (
    private.can_manage_project(project_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    private.can_manage_project(project_id, (SELECT auth.uid()))
  );

CREATE POLICY project_collaborators_delete_manage
  ON public.project_collaborators FOR DELETE
  TO authenticated
  USING (
    private.can_manage_project(project_id, (SELECT auth.uid()))
  );

COMMIT;

