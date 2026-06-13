-- Course report / DMCA intake for the open creator model.
-- Keeps reports private to the reporter and staff while preserving enough
-- status metadata for a future admin moderation queue.

CREATE TABLE IF NOT EXISTS public.course_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (
    reason IN (
      'copyright',
      'spam',
      'misleading',
      'unsafe',
      'other'
    )
  ),
  details text NOT NULL CHECK (char_length(details) BETWEEN 10 AND 4000),
  contact_email text,
  status text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'reviewing', 'resolved', 'rejected')
  ),
  priority text NOT NULL DEFAULT 'normal' CHECK (
    priority IN ('low', 'normal', 'high', 'urgent')
  ),
  reviewer_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  resolution_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS course_reports_course_status_idx
  ON public.course_reports (course_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS course_reports_reporter_time_idx
  ON public.course_reports (reporter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS course_reports_status_priority_idx
  ON public.course_reports (status, priority, created_at DESC);

ALTER TABLE public.course_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS course_reports_select_own_or_staff ON public.course_reports;
CREATE POLICY course_reports_select_own_or_staff
  ON public.course_reports FOR SELECT
  TO authenticated
  USING (
    reporter_id = (select auth.uid())
    OR public.is_admin_or_support()
  );

DROP POLICY IF EXISTS course_reports_insert_self ON public.course_reports;
CREATE POLICY course_reports_insert_self
  ON public.course_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = (select auth.uid())
    AND status = 'open'
    AND reviewer_id IS NULL
    AND resolved_at IS NULL
  );

DROP POLICY IF EXISTS course_reports_update_staff ON public.course_reports;
CREATE POLICY course_reports_update_staff
  ON public.course_reports FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

DROP POLICY IF EXISTS course_reports_delete_staff ON public.course_reports;
CREATE POLICY course_reports_delete_staff
  ON public.course_reports FOR DELETE
  TO authenticated
  USING (public.is_admin_or_support());
