-- Fix RLS for Hackathon Registrations and Submissions to allow proper service-layer permissions
-- Issue #190

BEGIN;

-- Drop existing restricted policies
DROP POLICY IF EXISTS hackathon_registrations_select_own_or_staff ON public.hackathon_registrations;
DROP POLICY IF EXISTS hackathon_submissions_select_own_or_staff ON public.hackathon_submissions;

-- 1. Registrations: accessible by owner, manager (creator/staff), and reviewers
CREATE POLICY hackathon_registrations_select_phase2
  ON public.hackathon_registrations FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.can_manage_hackathon(hackathon_id, auth.uid())
    OR public.has_hackathon_invite_role(hackathon_id, ARRAY['reviewer'])
  );

-- 2. Submissions: accessible by owner, manager (creator/staff), judges, and co-organizers
CREATE POLICY hackathon_submissions_select_phase2
  ON public.hackathon_submissions FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.can_manage_hackathon(hackathon_id, auth.uid())
    OR public.has_hackathon_invite_role(hackathon_id, ARRAY['judge', 'co_organizer'])
  );

COMMIT;

-- -----------------------------------------------------------------------------
-- SMOKE SQL: Test Registration & Submission Read Access
-- -----------------------------------------------------------------------------
/*
-- Để test các role này, chạy snippet sau với các UID/Email giả định:
DO $$
BEGIN
  -- 1. Role: Instructor Manager (Creator)
  -- SET LOCAL role = authenticated;
  -- SELECT set_config('request.jwt.claims', '{"sub": "CREATOR_UID_HERE"}', true);
  -- Kiểm tra: Phải SELECT ĐƯỢC tất cả registrations và submissions của hackathon_id tương ứng.

  -- 2. Role: Reviewer (Đã accept invite)
  -- SELECT set_config('request.jwt.claims', '{"sub": "REVIEWER_UID_HERE", "email": "reviewer@email.com"}', true);
  -- Kiểm tra: Phải SELECT ĐƯỢC hackathon_registrations.
  -- Kiểm tra: KHÔNG SELECT ĐƯỢC hackathon_submissions (trừ bài của chính mình).

  -- 3. Role: Judge (Đã accept invite)
  -- SELECT set_config('request.jwt.claims', '{"sub": "JUDGE_UID_HERE", "email": "judge@email.com"}', true);
  -- Kiểm tra: Phải SELECT ĐƯỢC hackathon_submissions.
  -- Kiểm tra: KHÔNG SELECT ĐƯỢC hackathon_registrations (trừ bài của chính mình).

  -- 4. Role: Participant (Chỉ đăng ký thi)
  -- SELECT set_config('request.jwt.claims', '{"sub": "PARTICIPANT_UID_HERE"}', true);
  -- Kiểm tra: CHỈ SELECT ĐƯỢC registrations và submissions do chính mình tạo (user_id = auth.uid()).
END $$;
*/
