-- Career tracks: add ownership + publish workflow + scoped slug uniqueness.

-- -----------------------------------------------------------------------------
-- 1) Schema changes
-- -----------------------------------------------------------------------------

ALTER TABLE public.career_tracks
  ADD COLUMN IF NOT EXISTS owner_scope text,
  ADD COLUMN IF NOT EXISTS instructor_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

-- Backfill existing rows as Corelia-owned and published.
UPDATE public.career_tracks
SET owner_scope = COALESCE(owner_scope, 'corelia'),
    published = true
WHERE owner_scope IS NULL;

ALTER TABLE public.career_tracks
  ALTER COLUMN owner_scope SET NOT NULL;

ALTER TABLE public.career_tracks
  ADD CONSTRAINT career_tracks_owner_scope_check
    CHECK (owner_scope IN ('corelia', 'instructor'));

ALTER TABLE public.career_tracks
  ADD CONSTRAINT career_tracks_instructor_id_required_when_instructor
    CHECK (
      (owner_scope = 'corelia' AND instructor_id IS NULL)
      OR (owner_scope = 'instructor' AND instructor_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS career_tracks_owner_scope_idx
  ON public.career_tracks (owner_scope);
CREATE INDEX IF NOT EXISTS career_tracks_instructor_id_idx
  ON public.career_tracks (instructor_id);
CREATE INDEX IF NOT EXISTS career_tracks_published_idx
  ON public.career_tracks (published);

-- Replace global slug uniqueness with scoped uniqueness.
ALTER TABLE public.career_tracks
  DROP CONSTRAINT IF EXISTS career_tracks_slug_key;

-- Corelia: slug unique within corelia namespace.
CREATE UNIQUE INDEX IF NOT EXISTS career_tracks_slug_unique_corelia
  ON public.career_tracks (slug)
  WHERE owner_scope = 'corelia';

-- Instructor: slug unique within instructor.
CREATE UNIQUE INDEX IF NOT EXISTS career_tracks_slug_unique_instructor
  ON public.career_tracks (instructor_id, slug)
  WHERE owner_scope = 'instructor';

-- -----------------------------------------------------------------------------
-- 2) RLS policy updates
-- -----------------------------------------------------------------------------

-- career_tracks
ALTER TABLE public.career_tracks ENABLE ROW LEVEL SECURITY;

-- Remove old policies (names from initial career migration).
DROP POLICY IF EXISTS career_tracks_select_public ON public.career_tracks;
DROP POLICY IF EXISTS career_tracks_insert_staff ON public.career_tracks;
DROP POLICY IF EXISTS career_tracks_update_staff ON public.career_tracks;
DROP POLICY IF EXISTS career_tracks_delete_staff ON public.career_tracks;

-- Public can only read published rows.
CREATE POLICY career_tracks_select_public_published
  ON public.career_tracks FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Owner (instructor) or staff can read drafts too.
CREATE POLICY career_tracks_select_owner_or_staff
  ON public.career_tracks FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (owner_scope = 'instructor' AND instructor_id = (select auth.uid()))
  );

-- Writes: owner (instructor) or staff.
CREATE POLICY career_tracks_insert_owner_or_staff
  ON public.career_tracks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR (owner_scope = 'instructor' AND instructor_id = (select auth.uid()))
  );

CREATE POLICY career_tracks_update_owner_or_staff
  ON public.career_tracks FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (owner_scope = 'instructor' AND instructor_id = (select auth.uid()))
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR (owner_scope = 'instructor' AND instructor_id = (select auth.uid()))
  );

CREATE POLICY career_tracks_delete_owner_or_staff
  ON public.career_tracks FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR (owner_scope = 'instructor' AND instructor_id = (select auth.uid()))
  );

-- career_track_courses
ALTER TABLE public.career_track_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS career_track_courses_select_public ON public.career_track_courses;
DROP POLICY IF EXISTS career_track_courses_insert_staff ON public.career_track_courses;
DROP POLICY IF EXISTS career_track_courses_update_staff ON public.career_track_courses;
DROP POLICY IF EXISTS career_track_courses_delete_staff ON public.career_track_courses;

-- Read included courses if track is published OR viewer is owner/staff.
CREATE POLICY career_track_courses_select_visible
  ON public.career_track_courses FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.career_tracks t
      WHERE t.id = track_id
        AND (
          t.published = true
          OR public.is_admin_or_support()
          OR (t.owner_scope = 'instructor' AND t.instructor_id = (select auth.uid()))
        )
    )
  );

-- Writes: staff OR instructor owner of the track.
CREATE POLICY career_track_courses_insert_owner_or_staff
  ON public.career_track_courses FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.career_tracks t
      WHERE t.id = track_id
        AND t.owner_scope = 'instructor'
        AND t.instructor_id = (select auth.uid())
    )
  );

CREATE POLICY career_track_courses_update_owner_or_staff
  ON public.career_track_courses FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.career_tracks t
      WHERE t.id = track_id
        AND t.owner_scope = 'instructor'
        AND t.instructor_id = (select auth.uid())
    )
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.career_tracks t
      WHERE t.id = track_id
        AND t.owner_scope = 'instructor'
        AND t.instructor_id = (select auth.uid())
    )
  );

CREATE POLICY career_track_courses_delete_owner_or_staff
  ON public.career_track_courses FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.career_tracks t
      WHERE t.id = track_id
        AND t.owner_scope = 'instructor'
        AND t.instructor_id = (select auth.uid())
    )
  );

