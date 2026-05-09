-- Project hearts (likes) and flat comments with RLS aligned to project visibility.

CREATE SCHEMA IF NOT EXISTS private;

-- -----------------------------------------------------------------------------
-- Read helper (SECURITY DEFINER, mirrors projects_select_policy)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.can_read_project_content(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_visibility text;
  v_owner uuid;
BEGIN
  PERFORM set_config('row_security', 'off', true);
  SELECT visibility, owner_id
  INTO v_visibility, v_owner
  FROM public.projects
  WHERE id = p_project_id;

  IF v_visibility IS NULL THEN
    RETURN false;
  END IF;

  IF p_user_id IS NULL THEN
    RETURN v_visibility IN ('public', 'unlisted');
  END IF;

  IF public.is_admin_or_support() THEN
    RETURN true;
  END IF;

  RETURN (
    v_visibility IN ('public', 'unlisted')
    OR v_owner = p_user_id
    OR private.is_project_collaborator(p_project_id, p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION private.can_read_project_content(uuid, uuid) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Denormalized like counter (maintained by SECURITY DEFINER triggers)
-- -----------------------------------------------------------------------------

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'projects'
      AND c.conname = 'projects_like_count_non_negative_chk'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_like_count_non_negative_chk CHECK (like_count >= 0);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_hearts (
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_hearts_project_idx
  ON public.project_hearts (project_id);

CREATE TABLE IF NOT EXISTS public.project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT project_comments_body_len_chk CHECK (
    char_length(body) <= 2000 AND trim(body) <> ''
  )
);

CREATE INDEX IF NOT EXISTS project_comments_project_created_idx
  ON public.project_comments (project_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.project_hearts_adjust_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects
    SET like_count = like_count + 1
    WHERE id = NEW.project_id;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE public.projects
    SET like_count = GREATEST(0, like_count - 1)
    WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_hearts_adjust_like_count ON public.project_hearts;
CREATE TRIGGER trg_project_hearts_adjust_like_count
  AFTER INSERT OR DELETE ON public.project_hearts
  FOR EACH ROW
  EXECUTE FUNCTION private.project_hearts_adjust_like_count();

CREATE OR REPLACE FUNCTION private.project_comments_soft_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'COMMENT_ALREADY_DELETED';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN
      IF NEW.body IS DISTINCT FROM OLD.body
        OR NEW.author_id IS DISTINCT FROM OLD.author_id
        OR NEW.project_id IS DISTINCT FROM OLD.project_id
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
      THEN
        RAISE EXCEPTION 'COMMENT_SOFT_DELETE_ONLY';
      END IF;
      NEW.updated_at := now();
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'COMMENT_EDIT_NOT_ALLOWED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_comments_soft_delete_guard ON public.project_comments;
CREATE TRIGGER trg_project_comments_soft_delete_guard
  BEFORE UPDATE ON public.project_comments
  FOR EACH ROW
  EXECUTE FUNCTION private.project_comments_soft_delete_guard();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.project_hearts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_hearts_select_visible ON public.project_hearts;
CREATE POLICY project_hearts_select_visible
  ON public.project_hearts FOR SELECT
  TO anon, authenticated
  USING (
    private.can_read_project_content(project_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS project_hearts_insert_own ON public.project_hearts;
CREATE POLICY project_hearts_insert_own
  ON public.project_hearts FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND private.can_read_project_content(project_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS project_hearts_delete_own ON public.project_hearts;
CREATE POLICY project_hearts_delete_own
  ON public.project_hearts FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS project_comments_select_visible ON public.project_comments;
CREATE POLICY project_comments_select_visible
  ON public.project_comments FOR SELECT
  TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND private.can_read_project_content(project_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS project_comments_insert_authenticated ON public.project_comments;
CREATE POLICY project_comments_insert_authenticated
  ON public.project_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND private.can_read_project_content(project_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS project_comments_update_soft_delete ON public.project_comments;
CREATE POLICY project_comments_update_soft_delete
  ON public.project_comments FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND private.can_read_project_content(project_id, (SELECT auth.uid()))
    AND (
      author_id = (SELECT auth.uid())
      OR private.can_manage_project(project_id, (SELECT auth.uid()))
      OR public.is_admin_or_support()
    )
  )
  WITH CHECK (
    deleted_at IS NOT NULL
    AND private.can_read_project_content(project_id, (SELECT auth.uid()))
  );

GRANT SELECT ON public.project_hearts TO anon, authenticated;
GRANT INSERT, DELETE ON public.project_hearts TO authenticated;

GRANT SELECT ON public.project_comments TO anon, authenticated;
GRANT INSERT, UPDATE ON public.project_comments TO authenticated;
