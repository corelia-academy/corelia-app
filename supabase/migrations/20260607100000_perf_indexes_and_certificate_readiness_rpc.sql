-- Fetch performance: targeted indexes + single-query certificate readiness for edge API.
--
-- 1) payment_transactions: verify path filters (user_id, course_id, purpose) then orders by created_at desc.
-- 2) final_assignment_submissions: common lookup by (user_id, course_id).
-- 3) public_profiles: composite for OR / handle-style lookups used by getPublicProfileByHandle.
-- 4) corelia_certificate_readiness: replaces two large selects (all lesson ids + all progress rows) in certificates.issue.

-- ─── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS payment_tx_user_course_purpose_created_idx
  ON public.payment_transactions (user_id, course_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS fas_user_course_idx
  ON public.final_assignment_submissions (user_id, course_id);

-- Aligns handle lookup with table actually queried by the app (public.public_profiles).
CREATE INDEX IF NOT EXISTS public_profiles_handle_lookup_idx
  ON public.public_profiles (lower(username), ocid);

-- ─── Certificate readiness (service_role / edge only) ─────────────────────────

CREATE OR REPLACE FUNCTION public.corelia_certificate_readiness(
  p_course_id text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lesson_total AS (
    SELECT COUNT(*)::bigint AS n
    FROM public.course_lessons
    WHERE course_id = p_course_id
  ),
  completed_distinct AS (
    SELECT COUNT(DISTINCT lesson_id)::bigint AS n
    FROM public.lesson_progress
    WHERE course_id = p_course_id
      AND user_id = p_user_id
      AND completed_at IS NOT NULL
  ),
  final_row AS (
    SELECT f.status::text AS st
    FROM public.final_assignment_submissions f
    WHERE f.course_id = p_course_id
      AND f.user_id = p_user_id
    ORDER BY f.submitted_at DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'course_exists',
      EXISTS (SELECT 1 FROM public.courses c WHERE c.id = p_course_id),
    'lesson_total', (SELECT n FROM lesson_total),
    'completed_distinct', (SELECT n FROM completed_distinct),
    'all_lessons_complete',
      (SELECT lt.n > 0 AND cd.n >= lt.n FROM lesson_total lt, completed_distinct cd),
    'final_assignment_required',
      EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = p_course_id
          AND NULLIF(TRIM(c.data ->> 'final_assignment_title'), '') IS NOT NULL
      ),
    'final_submission_status',
      (SELECT st FROM final_row)
  );
$$;

REVOKE ALL ON FUNCTION public.corelia_certificate_readiness(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.corelia_certificate_readiness(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.corelia_certificate_readiness(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.corelia_certificate_readiness(text, uuid) TO service_role;
