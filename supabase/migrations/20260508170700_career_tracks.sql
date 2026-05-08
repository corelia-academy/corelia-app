-- Career tracks (learning tracks): public-readable collections of courses.

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.career_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL,
  what_youll_learn text[] NOT NULL DEFAULT '{}'::text[],
  prerequisites text[] NOT NULL DEFAULT '{}'::text[],
  has_certificate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.career_track_courses (
  track_id uuid NOT NULL REFERENCES public.career_tracks (id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE RESTRICT,
  sort_order int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, course_id)
);

CREATE INDEX IF NOT EXISTS career_track_courses_track_sort_idx
  ON public.career_track_courses (track_id, sort_order);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.career_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_track_courses ENABLE ROW LEVEL SECURITY;

-- Readable by anyone (anon/auth) for public pages.
DROP POLICY IF EXISTS career_tracks_select_public ON public.career_tracks;
CREATE POLICY career_tracks_select_public
  ON public.career_tracks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS career_track_courses_select_public ON public.career_track_courses;
CREATE POLICY career_track_courses_select_public
  ON public.career_track_courses FOR SELECT
  USING (true);

-- Writes restricted to staff.
DROP POLICY IF EXISTS career_tracks_insert_staff ON public.career_tracks;
CREATE POLICY career_tracks_insert_staff
  ON public.career_tracks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_support());

DROP POLICY IF EXISTS career_tracks_update_staff ON public.career_tracks;
CREATE POLICY career_tracks_update_staff
  ON public.career_tracks FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

DROP POLICY IF EXISTS career_tracks_delete_staff ON public.career_tracks;
CREATE POLICY career_tracks_delete_staff
  ON public.career_tracks FOR DELETE
  TO authenticated
  USING (public.is_admin_or_support());

DROP POLICY IF EXISTS career_track_courses_insert_staff ON public.career_track_courses;
CREATE POLICY career_track_courses_insert_staff
  ON public.career_track_courses FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_support());

DROP POLICY IF EXISTS career_track_courses_update_staff ON public.career_track_courses;
CREATE POLICY career_track_courses_update_staff
  ON public.career_track_courses FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

DROP POLICY IF EXISTS career_track_courses_delete_staff ON public.career_track_courses;
CREATE POLICY career_track_courses_delete_staff
  ON public.career_track_courses FOR DELETE
  TO authenticated
  USING (public.is_admin_or_support());

