-- Projects entity (portfolio) that can be sourced from contests or courses.
-- Adds:
-- - public.projects
-- - public.project_collaborators
-- - triggers to sync from contest_submissions + final_assignment_submissions

CREATE SCHEMA IF NOT EXISTS private;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  title text NOT NULL,
  summary text,

  demo_url text,
  repo_url text,
  slide_url text,

  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'unlisted', 'private')),

  -- Source system reference
  source_type text NOT NULL
    CHECK (source_type IN ('standalone', 'contest', 'course')),
  source_id text,
  source_submission_id text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (owner_id, source_type, source_submission_id)
);

CREATE INDEX IF NOT EXISTS projects_owner_updated_idx
  ON public.projects (owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS projects_source_idx
  ON public.projects (source_type, source_id);

CREATE TABLE IF NOT EXISTS public.project_collaborators (
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'contributor',
  show_in_portfolio boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_collaborators_user_idx
  ON public.project_collaborators (user_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

-- Select: public/unlisted is readable; private only for owner/collaborator/staff.
DROP POLICY IF EXISTS projects_select_policy ON public.projects;
CREATE POLICY projects_select_policy
  ON public.projects FOR SELECT
  TO authenticated, anon
  USING (
    visibility IN ('public', 'unlisted')
    OR owner_id = (SELECT auth.uid())
    OR public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.project_collaborators pc
      WHERE pc.project_id = projects.id
        AND pc.user_id = (SELECT auth.uid())
        AND pc.show_in_portfolio = true
    )
  );

DROP POLICY IF EXISTS projects_insert_own ON public.projects;
CREATE POLICY projects_insert_own
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.is_admin_or_support()
  );

DROP POLICY IF EXISTS projects_update_own ON public.projects;
CREATE POLICY projects_update_own
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.is_admin_or_support()
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR public.is_admin_or_support()
  );

DROP POLICY IF EXISTS projects_delete_own ON public.projects;
CREATE POLICY projects_delete_own
  ON public.projects FOR DELETE
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR public.is_admin_or_support()
  );

-- Collaborators: owner manages; collaborator can view their row.
DROP POLICY IF EXISTS project_collaborators_select ON public.project_collaborators;
CREATE POLICY project_collaborators_select
  ON public.project_collaborators FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.owner_id = (SELECT auth.uid()) OR public.is_admin_or_support())
    )
  );

DROP POLICY IF EXISTS project_collaborators_manage_owner ON public.project_collaborators;
CREATE POLICY project_collaborators_manage_owner
  ON public.project_collaborators FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.owner_id = (SELECT auth.uid()) OR public.is_admin_or_support())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.owner_id = (SELECT auth.uid()) OR public.is_admin_or_support())
    )
  );

-- -----------------------------------------------------------------------------
-- Trigger helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_touch_updated_at ON public.projects;
CREATE TRIGGER trg_projects_touch_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

-- Sync a project from contest submission jsonb
CREATE OR REPLACE FUNCTION private.sync_project_from_contest_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_summary text;
  v_demo text;
  v_repo text;
  v_slide text;
BEGIN
  v_title := COALESCE(NULLIF(NEW.document->>'title', ''), 'Contest submission');
  v_summary := NULLIF(NEW.document->>'summary', '');
  v_demo := NULLIF(NEW.document->>'demo_url', '');
  v_repo := NULLIF(NEW.document->>'repo_url', '');
  v_slide := NULLIF(NEW.document->>'slide_url', '');

  INSERT INTO public.projects (
    owner_id,
    title,
    summary,
    demo_url,
    repo_url,
    slide_url,
    visibility,
    source_type,
    source_id,
    source_submission_id
  )
  VALUES (
    NEW.user_id,
    v_title,
    v_summary,
    v_demo,
    v_repo,
    v_slide,
    'public',
    'contest',
    NEW.contest_id,
    NEW.id
  )
  ON CONFLICT (owner_id, source_type, source_submission_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    demo_url = EXCLUDED.demo_url,
    repo_url = EXCLUDED.repo_url,
    slide_url = EXCLUDED.slide_url,
    source_id = EXCLUDED.source_id,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Sync a project from course final assignment submission
CREATE OR REPLACE FUNCTION private.sync_project_from_final_assignment_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_summary text;
BEGIN
  v_title := CONCAT('Course submission · ', NEW.course_id);
  v_summary := NULLIF(NEW.content, '');

  INSERT INTO public.projects (
    owner_id,
    title,
    summary,
    visibility,
    source_type,
    source_id,
    source_submission_id
  )
  VALUES (
    NEW.user_id,
    v_title,
    v_summary,
    'unlisted',
    'course',
    NEW.course_id,
    NEW.id
  )
  ON CONFLICT (owner_id, source_type, source_submission_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    source_id = EXCLUDED.source_id,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_from_contest_submission ON public.contest_submissions;
CREATE TRIGGER trg_sync_project_from_contest_submission
  AFTER INSERT OR UPDATE ON public.contest_submissions
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_project_from_contest_submission();

DROP TRIGGER IF EXISTS trg_sync_project_from_final_assignment_submission ON public.final_assignment_submissions;
CREATE TRIGGER trg_sync_project_from_final_assignment_submission
  AFTER INSERT OR UPDATE ON public.final_assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_project_from_final_assignment_submission();

