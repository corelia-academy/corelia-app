-- Localized content for hackathons, career tracks, and projects (text-only).

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Schema: locale tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hackathon_locales (
  hackathon_id uuid NOT NULL REFERENCES public.hackathons (id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('vi', 'en')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hackathon_id, locale)
);

CREATE INDEX IF NOT EXISTS hackathon_locales_locale_idx
  ON public.hackathon_locales (locale);

CREATE TABLE IF NOT EXISTS public.career_track_locales (
  career_track_id uuid NOT NULL REFERENCES public.career_tracks (id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('vi', 'en')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (career_track_id, locale)
);

CREATE INDEX IF NOT EXISTS career_track_locales_locale_idx
  ON public.career_track_locales (locale);

CREATE TABLE IF NOT EXISTS public.project_locales (
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('vi', 'en')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, locale)
);

CREATE INDEX IF NOT EXISTS project_locales_locale_idx
  ON public.project_locales (locale);

-- -----------------------------------------------------------------------------
-- 2) Schema: minimal i18n configs (text-only)
-- -----------------------------------------------------------------------------

ALTER TABLE public.career_tracks
  ADD COLUMN IF NOT EXISTS i18n jsonb;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS i18n jsonb;

-- -----------------------------------------------------------------------------
-- 3) RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.hackathon_locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_track_locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_locales ENABLE ROW LEVEL SECURITY;

-- hackathon_locales: readable whenever the parent hackathon row is readable
DROP POLICY IF EXISTS hackathon_locales_select_visible ON public.hackathon_locales;
CREATE POLICY hackathon_locales_select_visible
  ON public.hackathon_locales FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = hackathon_id
    )
  );

-- Writes: staff OR creator (created_by stored in hackathons.document)
DROP POLICY IF EXISTS hackathon_locales_insert_manage ON public.hackathon_locales;
CREATE POLICY hackathon_locales_insert_manage
  ON public.hackathon_locales FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
  );

DROP POLICY IF EXISTS hackathon_locales_update_manage ON public.hackathon_locales;
CREATE POLICY hackathon_locales_update_manage
  ON public.hackathon_locales FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
  );

DROP POLICY IF EXISTS hackathon_locales_delete_manage ON public.hackathon_locales;
CREATE POLICY hackathon_locales_delete_manage
  ON public.hackathon_locales FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = hackathon_id
        AND (h.document->>'created_by') = ((SELECT auth.uid())::text)
    )
  );

-- career_track_locales: readable whenever the parent track row is readable
DROP POLICY IF EXISTS career_track_locales_select_visible ON public.career_track_locales;
CREATE POLICY career_track_locales_select_visible
  ON public.career_track_locales FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.career_tracks t
      WHERE t.id = career_track_id
    )
  );

-- Writes: staff OR instructor owner of the track
DROP POLICY IF EXISTS career_track_locales_insert_manage ON public.career_track_locales;
CREATE POLICY career_track_locales_insert_manage
  ON public.career_track_locales FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.career_tracks t
      WHERE t.id = career_track_id
        AND t.owner_scope = 'instructor'
        AND t.instructor_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS career_track_locales_update_manage ON public.career_track_locales;
CREATE POLICY career_track_locales_update_manage
  ON public.career_track_locales FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.career_tracks t
      WHERE t.id = career_track_id
        AND t.owner_scope = 'instructor'
        AND t.instructor_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.career_tracks t
      WHERE t.id = career_track_id
        AND t.owner_scope = 'instructor'
        AND t.instructor_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS career_track_locales_delete_manage ON public.career_track_locales;
CREATE POLICY career_track_locales_delete_manage
  ON public.career_track_locales FOR DELETE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.career_tracks t
      WHERE t.id = career_track_id
        AND t.owner_scope = 'instructor'
        AND t.instructor_id = (SELECT auth.uid())
    )
  );

-- project_locales: readable whenever the parent project row is readable
DROP POLICY IF EXISTS project_locales_select_visible ON public.project_locales;
CREATE POLICY project_locales_select_visible
  ON public.project_locales FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
    )
  );

-- Writes: project owner/staff (reuse SECURITY DEFINER helper to avoid recursion)
DROP POLICY IF EXISTS project_locales_insert_manage ON public.project_locales;
CREATE POLICY project_locales_insert_manage
  ON public.project_locales FOR INSERT
  TO authenticated
  WITH CHECK (
    private.can_manage_project(project_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS project_locales_update_manage ON public.project_locales;
CREATE POLICY project_locales_update_manage
  ON public.project_locales FOR UPDATE
  TO authenticated
  USING (
    private.can_manage_project(project_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    private.can_manage_project(project_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS project_locales_delete_manage ON public.project_locales;
CREATE POLICY project_locales_delete_manage
  ON public.project_locales FOR DELETE
  TO authenticated
  USING (
    private.can_manage_project(project_id, (SELECT auth.uid()))
  );

COMMIT;

