-- Keep the privileged, transactional implementation outside the exposed API
-- schema. The public RPC remains stable as a SECURITY INVOKER wrapper.

ALTER FUNCTION public.upsert_hackathon_project(
  text, uuid, text, text, text, text, text, text, text, text, text,
  text[], text[], text[]
) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.upsert_hackathon_project(
  text, uuid, text, text, text, text, text, text, text, text, text,
  text[], text[], text[]
) FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.upsert_hackathon_project(
  text, uuid, text, text, text, text, text, text, text, text, text,
  text[], text[], text[]
) TO authenticated;

CREATE FUNCTION public.upsert_hackathon_project(
  p_hackathon_id text,
  p_project_id uuid,
  p_slug text,
  p_title text,
  p_summary text DEFAULT NULL,
  p_demo_url text DEFAULT NULL,
  p_repo_url text DEFAULT NULL,
  p_slide_url text DEFAULT NULL,
  p_screenshot_url text DEFAULT NULL,
  p_cover_image_url text DEFAULT NULL,
  p_video_url text DEFAULT NULL,
  p_track_ids text[] DEFAULT '{}',
  p_sector_ids text[] DEFAULT '{}',
  p_tech_stack_ids text[] DEFAULT '{}'
)
RETURNS TABLE(project_id uuid, submission_id text, project_slug text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT *
  FROM private.upsert_hackathon_project(
    p_hackathon_id,
    p_project_id,
    p_slug,
    p_title,
    p_summary,
    p_demo_url,
    p_repo_url,
    p_slide_url,
    p_screenshot_url,
    p_cover_image_url,
    p_video_url,
    p_track_ids,
    p_sector_ids,
    p_tech_stack_ids
  );
$$;

REVOKE ALL ON FUNCTION public.upsert_hackathon_project(
  text, uuid, text, text, text, text, text, text, text, text, text,
  text[], text[], text[]
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.upsert_hackathon_project(
  text, uuid, text, text, text, text, text, text, text, text, text,
  text[], text[], text[]
) TO authenticated;
