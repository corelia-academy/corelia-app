-- Rename contest → hackathon (end-to-end naming)
-- This is a breaking change (routes + schema). Apply after all previous contest Phase 2 migrations.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Rename tables
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.contests RENAME TO hackathons;

ALTER TABLE IF EXISTS public.contest_registrations RENAME TO hackathon_registrations;
ALTER TABLE IF EXISTS public.contest_access_invites RENAME TO hackathon_access_invites;
ALTER TABLE IF EXISTS public.contest_submissions RENAME TO hackathon_submissions;
ALTER TABLE IF EXISTS public.contest_scores RENAME TO hackathon_scores;

-- -----------------------------------------------------------------------------
-- 2) Rename columns (contest_id → hackathon_id)
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.hackathon_registrations
  RENAME COLUMN contest_id TO hackathon_id;

ALTER TABLE IF EXISTS public.hackathon_access_invites
  RENAME COLUMN contest_id TO hackathon_id;

ALTER TABLE IF EXISTS public.hackathon_submissions
  RENAME COLUMN contest_id TO hackathon_id;

ALTER TABLE IF EXISTS public.hackathon_scores
  RENAME COLUMN contest_id TO hackathon_id;

-- -----------------------------------------------------------------------------
-- 3) Rename indexes (best-effort)
-- -----------------------------------------------------------------------------

ALTER INDEX IF EXISTS public.contests_status_updated RENAME TO hackathons_status_updated;

ALTER INDEX IF EXISTS public.contest_reg_contest RENAME TO hackathon_reg_hackathon;
ALTER INDEX IF EXISTS public.contest_invite_contest RENAME TO hackathon_invite_hackathon;
ALTER INDEX IF EXISTS public.contest_sub_contest RENAME TO hackathon_sub_hackathon;
ALTER INDEX IF EXISTS public.contest_scores_contest RENAME TO hackathon_scores_hackathon;

-- -----------------------------------------------------------------------------
-- 4) Drop legacy policies (contest*)
-- -----------------------------------------------------------------------------

-- Main table policies (names from 20250504120000 + 20260506071954)
DROP POLICY IF EXISTS contests_select ON public.hackathons;
DROP POLICY IF EXISTS contests_write_staff ON public.hackathons;
DROP POLICY IF EXISTS contests_insert_instructor_corelia ON public.hackathons;
DROP POLICY IF EXISTS contests_update_creator_staff ON public.hackathons;

-- Registrations (tightened RLS)
DROP POLICY IF EXISTS contest_registrations_authenticated ON public.hackathon_registrations;
DROP POLICY IF EXISTS contest_registrations_select_own_or_staff ON public.hackathon_registrations;
DROP POLICY IF EXISTS contest_registrations_insert_self ON public.hackathon_registrations;
DROP POLICY IF EXISTS contest_registrations_delete_self_or_staff ON public.hackathon_registrations;

-- Invites (tightened + phase2)
DROP POLICY IF EXISTS contest_invites_authenticated ON public.hackathon_access_invites;
DROP POLICY IF EXISTS contest_invites_staff_or_creator ON public.hackathon_access_invites;
DROP POLICY IF EXISTS contest_invites_manage_staff_or_creator ON public.hackathon_access_invites;
DROP POLICY IF EXISTS contest_invites_select_self_by_email ON public.hackathon_access_invites;
DROP POLICY IF EXISTS contest_invites_update_self_response_only ON public.hackathon_access_invites;

-- Submissions (tightened)
DROP POLICY IF EXISTS contest_submissions_authenticated ON public.hackathon_submissions;
DROP POLICY IF EXISTS contest_submissions_select_own_or_staff ON public.hackathon_submissions;
DROP POLICY IF EXISTS contest_submissions_insert_self ON public.hackathon_submissions;
DROP POLICY IF EXISTS contest_submissions_update_self_or_staff ON public.hackathon_submissions;
DROP POLICY IF EXISTS contest_submissions_delete_self_or_staff ON public.hackathon_submissions;

-- Scores (tightened + phase2)
DROP POLICY IF EXISTS contest_scores_authenticated ON public.hackathon_scores;
DROP POLICY IF EXISTS contest_scores_select_visible ON public.hackathon_scores;
DROP POLICY IF EXISTS contest_scores_write_staff ON public.hackathon_scores;
DROP POLICY IF EXISTS contest_scores_update_staff ON public.hackathon_scores;
DROP POLICY IF EXISTS contest_scores_delete_staff ON public.hackathon_scores;
DROP POLICY IF EXISTS contest_scores_select_phase2 ON public.hackathon_scores;
DROP POLICY IF EXISTS contest_scores_insert_judge_or_co_organizer ON public.hackathon_scores;
DROP POLICY IF EXISTS contest_scores_update_judge_or_co_organizer ON public.hackathon_scores;
DROP POLICY IF EXISTS contest_scores_delete_staff_or_creator ON public.hackathon_scores;

-- -----------------------------------------------------------------------------
-- 5) Recreate policies with hackathon naming
-- -----------------------------------------------------------------------------

ALTER TABLE public.hackathons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_access_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathon_scores ENABLE ROW LEVEL SECURITY;

-- Hackathon visibility: published-like statuses for anon; managers see all
CREATE POLICY hackathons_select
  ON public.hackathons FOR SELECT
  USING (
    status IN ('published', 'running', 'ended')
    OR public.is_admin_or_support()
    OR (document->>'created_by') = (auth.uid()::text)
  );

CREATE POLICY hackathons_write_staff
  ON public.hackathons FOR ALL
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

CREATE POLICY hackathons_insert_instructor_corelia
  ON public.hackathons FOR INSERT
  WITH CHECK (
    public.is_admin_or_support()
    OR (
      public.current_profile_role() = 'instructor'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.instructor_origin = 'corelia'
      )
    )
  );

CREATE POLICY hackathons_update_creator_staff
  ON public.hackathons FOR UPDATE
  USING (
    public.is_admin_or_support()
    OR (document->>'created_by') = (auth.uid()::text)
  );

-- Registrations
CREATE POLICY hackathon_registrations_select_own_or_staff
  ON public.hackathon_registrations FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR user_id = (SELECT auth.uid())
  );

CREATE POLICY hackathon_registrations_insert_self
  ON public.hackathon_registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND h.status IN ('published', 'running', 'ended')
    )
  );

CREATE POLICY hackathon_registrations_delete_self_or_staff
  ON public.hackathon_registrations FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR user_id = (SELECT auth.uid())
  );

-- Submissions
CREATE POLICY hackathon_submissions_select_own_or_staff
  ON public.hackathon_submissions FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR user_id = (SELECT auth.uid())
  );

CREATE POLICY hackathon_submissions_insert_self
  ON public.hackathon_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND h.status IN ('published', 'running', 'ended')
    )
  );

CREATE POLICY hackathon_submissions_update_self_or_staff
  ON public.hackathon_submissions FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR user_id = (SELECT auth.uid())
  );

CREATE POLICY hackathon_submissions_delete_self_or_staff
  ON public.hackathon_submissions FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR user_id = (SELECT auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 6) Phase 2 invites: rename helpers + trigger + policies
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS private.has_contest_invite_role(text, text[]);
DROP FUNCTION IF EXISTS public.has_contest_invite_role(text, text[]);

CREATE OR REPLACE FUNCTION private.has_hackathon_invite_role(
  p_hackathon_id text,
  p_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hackathon_access_invites i
    WHERE i.hackathon_id = p_hackathon_id
      AND (i.document->>'email') = private.current_email()
      AND (i.document->>'status') = 'accepted'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(i.document->'roles', '[]'::jsonb)) r(role)
        WHERE r.role = ANY(p_roles)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_hackathon_invite_role(
  p_hackathon_id text,
  p_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_hackathon_invite_role(p_hackathon_id, p_roles);
$$;

GRANT EXECUTE ON FUNCTION private.has_hackathon_invite_role(text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_hackathon_invite_role(text, text[]) TO anon, authenticated;

-- Drop any existing trigger that still references the legacy function before dropping it.
DROP TRIGGER IF EXISTS trg_restrict_contest_invite_self_update ON public.hackathon_access_invites;

DROP FUNCTION IF EXISTS private.restrict_contest_invite_self_update();

CREATE OR REPLACE FUNCTION private.restrict_hackathon_invite_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := public.is_admin_or_support();
  is_creator boolean := EXISTS (
    SELECT 1 FROM public.hackathons h
    WHERE h.id = OLD.hackathon_id
      AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
  );
  is_invitee boolean := (OLD.document->>'email') = private.current_email();
  old_stripped jsonb;
  new_stripped jsonb;
  old_status text := COALESCE(OLD.document->>'status', '');
  new_status text := COALESCE(NEW.document->>'status', '');
BEGIN
  IF is_staff OR is_creator OR NOT is_invitee THEN
    RETURN NEW;
  END IF;

  old_stripped := COALESCE(OLD.document, '{}'::jsonb) - 'status' - 'responded_at';
  new_stripped := COALESCE(NEW.document, '{}'::jsonb) - 'status' - 'responded_at';

  IF old_stripped <> new_stripped THEN
    RAISE EXCEPTION 'Invitees can only update status/responded_at';
  END IF;

  IF old_status <> 'pending' THEN
    RAISE EXCEPTION 'Invite already responded';
  END IF;

  IF new_status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Invalid invite response status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_hackathon_invite_self_update ON public.hackathon_access_invites;
CREATE TRIGGER trg_restrict_hackathon_invite_self_update
  BEFORE UPDATE ON public.hackathon_access_invites
  FOR EACH ROW
  EXECUTE FUNCTION private.restrict_hackathon_invite_self_update();

-- Invites policies (phase2)
CREATE POLICY hackathon_invites_manage_staff_or_creator
  ON public.hackathon_access_invites FOR ALL
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
  );

CREATE POLICY hackathon_invites_select_self_by_email
  ON public.hackathon_access_invites FOR SELECT
  TO authenticated
  USING (
    (document->>'email') = public.current_email()
  );

CREATE POLICY hackathon_invites_update_self_response_only
  ON public.hackathon_access_invites FOR UPDATE
  TO authenticated
  USING (
    (document->>'email') = public.current_email()
  )
  WITH CHECK (
    (document->>'email') = public.current_email()
  );

-- -----------------------------------------------------------------------------
-- 7) Phase 2 scores: port policies to hackathon
-- -----------------------------------------------------------------------------

CREATE POLICY hackathon_scores_select_phase2
  ON public.hackathon_scores FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
    OR public.has_hackathon_invite_role(hackathon_id, ARRAY['judge', 'co_organizer'])
  );

CREATE POLICY hackathon_scores_insert_judge_or_co_organizer
  ON public.hackathon_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR (
      public.has_hackathon_invite_role(hackathon_id, ARRAY['judge', 'co_organizer'])
      AND COALESCE(document->>'judge_uid', '') = ((SELECT auth.uid())::text)
    )
  );

CREATE POLICY hackathon_scores_update_judge_or_co_organizer
  ON public.hackathon_scores FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (
      public.has_hackathon_invite_role(hackathon_id, ARRAY['judge', 'co_organizer'])
      AND COALESCE(document->>'judge_uid', '') = ((SELECT auth.uid())::text)
    )
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (
      public.has_hackathon_invite_role(hackathon_id, ARRAY['judge', 'co_organizer'])
      AND COALESCE(document->>'judge_uid', '') = ((SELECT auth.uid())::text)
    )
  );

CREATE POLICY hackathon_scores_delete_staff_or_creator
  ON public.hackathon_scores FOR DELETE
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

COMMIT;

