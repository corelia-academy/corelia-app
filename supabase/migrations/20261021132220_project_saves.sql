ALTER TABLE public.projects
  ADD COLUMN save_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_save_count_non_negative_chk
  CHECK (save_count >= 0);

CREATE TABLE public.project_saves (
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX project_saves_project_id_idx
  ON public.project_saves (project_id);

CREATE OR REPLACE FUNCTION private.project_saves_adjust_save_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);

  IF TG_OP = 'INSERT' THEN
    UPDATE public.projects
    SET save_count = save_count + 1
    WHERE id = NEW.project_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.projects
    SET save_count = GREATEST(0, save_count - 1)
    WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.project_saves_adjust_save_count()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_project_saves_adjust_save_count
  AFTER INSERT OR DELETE ON public.project_saves
  FOR EACH ROW
  EXECUTE FUNCTION private.project_saves_adjust_save_count();

ALTER TABLE public.project_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_saves_select_own
  ON public.project_saves FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY project_saves_insert_own
  ON public.project_saves FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND private.can_read_project_content(project_id, (SELECT auth.uid()))
  );

CREATE POLICY project_saves_delete_own
  ON public.project_saves FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.project_saves FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.project_saves TO authenticated;
