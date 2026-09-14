-- Accepted membership is part of a public/unlisted project's public attribution.
-- `show_in_portfolio` now controls only whether the project appears on the
-- collaborator's own public profile.
DROP POLICY IF EXISTS project_collaborators_select_visible
  ON public.project_collaborators;
CREATE POLICY project_collaborators_select_visible
  ON public.project_collaborators FOR SELECT
  TO anon, authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.can_manage_project(project_id, (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_id
        AND p.visibility IN ('public', 'unlisted')
    )
  );
