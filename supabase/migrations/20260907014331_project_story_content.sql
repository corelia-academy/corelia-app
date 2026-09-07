-- Keep gallery summaries compact while supporting a complete project story.
ALTER TABLE public.projects
  ADD COLUMN description text,
  ADD COLUMN progress text,
  ADD COLUMN pitch_video_url text,
  ADD CONSTRAINT projects_description_length CHECK (char_length(description) <= 20000),
  ADD CONSTRAINT projects_progress_length CHECK (char_length(progress) <= 10000),
  ADD CONSTRAINT projects_pitch_video_https CHECK (pitch_video_url IS NULL OR pitch_video_url ~ '^https://');

-- Replace the public forwarding signature, retaining optional defaults for old
-- callers. Existing ownership, source, deadline, media and taxonomy checks stay
-- in the private gate. The wrapper itself does not elevate privileges.
DROP FUNCTION public.save_ai_gated_project(uuid, uuid, text, text, text, text, text, text, text, text, text[], text, text, text, text[], text[], text[]);
CREATE FUNCTION public.save_ai_gated_project(
  p_actor_id uuid,
  p_project_id uuid,
  p_slug text,
  p_title text,
  p_summary text DEFAULT NULL,
  p_demo_url text DEFAULT NULL,
  p_repo_url text DEFAULT NULL,
  p_slide_url text DEFAULT NULL,
  p_video_url text DEFAULT NULL,
  p_logo_path text DEFAULT NULL,
  p_screenshot_paths text[] DEFAULT '{}'::text[],
  p_visibility text DEFAULT 'public',
  p_source_type text DEFAULT 'standalone',
  p_source_id text DEFAULT NULL,
  p_track_ids text[] DEFAULT '{}'::text[],
  p_sector_ids text[] DEFAULT '{}'::text[],
  p_tech_stack_ids text[] DEFAULT '{}'::text[],
  p_description text DEFAULT NULL,
  p_progress text DEFAULT NULL,
  p_pitch_video_url text DEFAULT NULL
)
RETURNS TABLE(project_id uuid, submission_id text, project_slug text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Two open Create forms must not race past the existing-submission check.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text || ':' || COALESCE(p_source_id, p_project_id::text), 0));
  RETURN QUERY SELECT * FROM private.save_ai_gated_project(
    p_actor_id, p_project_id, p_slug, p_title, p_summary, p_demo_url,
    p_repo_url, p_slide_url, p_video_url, p_logo_path, p_screenshot_paths,
    p_visibility, p_source_type, p_source_id, p_track_ids, p_sector_ids,
    p_tech_stack_ids
  );
  UPDATE public.projects p SET
    description = CASE WHEN p_description IS NULL THEN p.description ELSE NULLIF(btrim(p_description), '') END,
    progress = CASE WHEN p_progress IS NULL THEN p.progress ELSE NULLIF(btrim(p_progress), '') END,
    pitch_video_url = CASE WHEN p_pitch_video_url IS NULL THEN p.pitch_video_url ELSE NULLIF(btrim(p_pitch_video_url), '') END
  WHERE p.id = p_project_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_ai_gated_project(uuid, uuid, text, text, text, text, text, text, text, text, text[], text, text, text, text[], text[], text[], text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_ai_gated_project(uuid, uuid, text, text, text, text, text, text, text, text, text[], text, text, text, text[], text[], text[], text, text, text) TO service_role;
