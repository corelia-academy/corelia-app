-- Phase 2 (contests): allow accepted judges / co-organizers to write their own scores.
--
-- Uses helpers introduced in 20260508100000_contest_phase2_invites_rls.sql:
-- - public.has_contest_invite_role(contest_id, roles[])
-- - public.current_email() (not required here)

ALTER TABLE public.contest_scores ENABLE ROW LEVEL SECURITY;

-- Remove staff-only score writes to enable judge scoring
DROP POLICY IF EXISTS contest_scores_select_visible ON public.contest_scores;
DROP POLICY IF EXISTS contest_scores_write_staff ON public.contest_scores;
DROP POLICY IF EXISTS contest_scores_update_staff ON public.contest_scores;
DROP POLICY IF EXISTS contest_scores_delete_staff ON public.contest_scores;

-- Read scores if:
-- - contest is public-visible OR
-- - viewer is staff OR
-- - viewer is contest creator OR
-- - viewer is accepted judge/co_organizer for this contest.
CREATE POLICY contest_scores_select_phase2
  ON public.contest_scores FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_id
        AND (c.document->>'created_by') = ((SELECT auth.uid())::text)
    )
    OR public.has_contest_invite_role(contest_id, ARRAY['judge', 'co_organizer'])
    OR EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_id
        AND c.status IN ('published', 'running', 'ended')
    )
  );

-- Judges/co_organizers can INSERT their own score rows.
CREATE POLICY contest_scores_insert_judge_or_co_organizer
  ON public.contest_scores FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR (
      public.has_contest_invite_role(contest_id, ARRAY['judge', 'co_organizer'])
      AND COALESCE(document->>'judge_uid', '') = ((SELECT auth.uid())::text)
    )
  );

-- Judges/co_organizers can UPDATE their own score rows.
CREATE POLICY contest_scores_update_judge_or_co_organizer
  ON public.contest_scores FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (
      public.has_contest_invite_role(contest_id, ARRAY['judge', 'co_organizer'])
      AND COALESCE(document->>'judge_uid', '') = ((SELECT auth.uid())::text)
    )
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (
      public.has_contest_invite_role(contest_id, ARRAY['judge', 'co_organizer'])
      AND COALESCE(document->>'judge_uid', '') = ((SELECT auth.uid())::text)
    )
  );

-- Keep DELETE restricted to staff/creator only (judges can't delete).
CREATE POLICY contest_scores_delete_staff_or_creator
  ON public.contest_scores FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.contests c
      WHERE c.id = contest_id
        AND (c.document->>'created_by') = ((SELECT auth.uid())::text)
    )
  );

