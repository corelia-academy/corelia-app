-- Migration: 20260916110000_revert_course_completion.sql
-- Description: Allow learners to revert course completion status while preserving issued certificates (Issue #333).

-- 1. Update guard_enrollment_completion_mutation to allow clearing completed_at
-- when session setting app.allow_course_completion_revert is enabled in trusted transaction.
CREATE OR REPLACE FUNCTION private.guard_enrollment_completion_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb; BEGIN
 IF TG_OP='UPDATE' AND OLD.completed_at IS NOT NULL THEN
   IF NEW.completed_at IS NULL AND current_setting('app.allow_course_completion_revert', true) = 'on' THEN
     RETURN NEW;
   END IF;
   NEW.completed_at := OLD.completed_at; RETURN NEW;
 END IF;
 IF NEW.completed_at IS NOT NULL THEN
   r := public.corelia_certificate_readiness(NEW.course_id,NEW.user_id);
   IF NOT COALESCE((r->>'all_lessons_complete')::boolean,false) OR ((r->>'final_assignment_required')::boolean AND COALESCE(r->>'final_submission_status','')<>'approved') THEN RAISE EXCEPTION 'COURSE_NOT_COMPLETE'; END IF;
   NEW.completed_at := clock_timestamp();
 END IF;
 RETURN NEW;
END $$;

-- 2. Update learning_progress_guard to allow clearing completed_at
-- when session setting app.allow_course_completion_revert is enabled in trusted transaction,
-- while preserving reset_epoch semantics introduced in redo migrations.
CREATE OR REPLACE FUNCTION private.learning_progress_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f text; BEGIN
 IF TG_OP='UPDATE' AND (NEW.user_id<>OLD.user_id OR NEW.course_id<>OLD.course_id OR NEW.lesson_id<>OLD.lesson_id) THEN RAISE EXCEPTION 'PROGRESS_IDENTITY_IMMUTABLE'; END IF;
 IF auth.uid() IS NOT NULL AND NOT private.learning_lesson_visible(NEW.course_id,NEW.lesson_id) THEN RAISE EXCEPTION 'LESSON_UNAVAILABLE'; END IF;
 IF current_setting('app.allow_course_completion_revert', true) = 'on' THEN
   IF TG_OP='UPDATE' AND OLD.completed_at IS NOT NULL AND NEW.completed_at IS NULL THEN
     RETURN NEW;
   END IF;
 END IF;
 IF TG_OP='UPDATE' AND NEW.reset_epoch<OLD.reset_epoch THEN RAISE EXCEPTION 'STALE_LESSON_ATTEMPT'; END IF;
 IF TG_OP='UPDATE' AND OLD.completed_at IS NOT NULL AND NEW.completed_at IS NULL AND NEW.reset_epoch=OLD.reset_epoch THEN RAISE EXCEPTION 'RESET_EPOCH_REQUIRED'; END IF;
 SELECT data->>'lesson_format' INTO f FROM public.course_lessons WHERE id=NEW.lesson_id AND course_id=NEW.course_id;
 IF f='quiz' AND NEW.completed_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.completed_at IS NULL OR NEW.reset_epoch<>OLD.reset_epoch) AND NOT EXISTS(
   SELECT 1 FROM public.section_question_attempts WHERE user_id=NEW.user_id AND lesson_id=NEW.lesson_id AND course_id=NEW.course_id AND reset_epoch=NEW.reset_epoch AND attempt_group_id IS NOT NULL AND group_total>0 AND group_correct::numeric/group_total>=passing_ratio
 ) THEN RAISE EXCEPTION 'QUIZ_PASS_REQUIRED' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND OLD.completed_at IS NOT NULL AND NEW.completed_at IS NOT NULL AND NEW.reset_epoch=OLD.reset_epoch THEN NEW.completed_at:=OLD.completed_at;
 ELSIF NEW.completed_at IS NOT NULL THEN NEW.completed_at:=clock_timestamp(); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_progress_guard() FROM PUBLIC;

-- 3. Core RPC function to revert course completion
CREATE OR REPLACE FUNCTION private.learning_revert_completion(p_course text, p_user uuid, p_mode text DEFAULT 'last_lesson')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_enr public.enrollments%ROWTYPE;
  v_reverted_lesson_id text := NULL;
  v_reverted_count int := 0;
BEGIN
  IF p_user IS NULL OR p_course IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- Caller isolation check
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user AND NOT private.is_admin_or_support() THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- V-04 fix: strict validation against NULL and invalid modes
  IF p_mode IS NULL OR p_mode NOT IN ('last_lesson', 'reset_all') THEN
    RAISE EXCEPTION 'INVALID_MODE' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_enr FROM public.enrollments
   WHERE course_id = p_course AND user_id = p_user
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENROLLMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- V-02 fix: cannot revert an incomplete course enrollment
  IF v_enr.completed_at IS NULL THEN
    RAISE EXCEPTION 'COURSE_NOT_COMPLETED' USING ERRCODE = '22023';
  END IF;

  -- Enable session variable locally for this transaction
  PERFORM set_config('app.allow_course_completion_revert', 'on', true);

  IF p_mode = 'last_lesson' THEN
    -- Find the most recently completed visible published lesson
    SELECT p.lesson_id INTO v_reverted_lesson_id
      FROM public.lesson_progress p
      JOIN public.course_lessons l ON l.id = p.lesson_id AND l.course_id = p_course
     WHERE p.course_id = p_course
       AND p.user_id = p_user
       AND p.completed_at IS NOT NULL
       AND l.published = true
       AND l.archived_at IS NULL
     ORDER BY p.completed_at DESC, l.sort_order DESC
     LIMIT 1;

    IF v_reverted_lesson_id IS NOT NULL THEN
      UPDATE public.lesson_progress
         SET completed_at = NULL,
             reset_epoch = reset_epoch + 1
       WHERE user_id = p_user
         AND course_id = p_course
         AND lesson_id = v_reverted_lesson_id;
      v_reverted_count := 1;
    END IF;
  ELSIF p_mode = 'reset_all' THEN
    UPDATE public.lesson_progress
       SET completed_at = NULL,
           reset_epoch = reset_epoch + 1
     WHERE user_id = p_user
       AND course_id = p_course
       AND completed_at IS NOT NULL;
    GET DIAGNOSTICS v_reverted_count = ROW_COUNT;
  END IF;

  -- Revert enrollment completed_at
  UPDATE public.enrollments
     SET completed_at = NULL
   WHERE course_id = p_course
     AND user_id = p_user;

  -- Invariant: Certificate & Credential Preservation
  -- certificate_issued_at, certificate_records, and credential_issuances
  -- are STRICTLY PRESERVED (never revoked, purged or modified upon learning revert).

  RETURN jsonb_build_object(
    'ok', true,
    'mode', p_mode,
    'reverted_lesson_id', v_reverted_lesson_id,
    'reverted_count', v_reverted_count,
    'certificate_preserved', v_enr.certificate_issued_at IS NOT NULL
  );
END $$;

-- 4. Public wrapper for authenticated clients (SECURITY DEFINER to invoke private helper securely)
CREATE OR REPLACE FUNCTION public.learning_revert_completion(p_course_id text, p_mode text DEFAULT 'last_lesson')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN private.learning_revert_completion(p_course_id, v_user, p_mode);
END $$;

-- 5. Permissions: V-01 fix
REVOKE ALL ON FUNCTION private.learning_revert_completion(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.learning_revert_completion(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.learning_revert_completion(text, text) TO authenticated;
