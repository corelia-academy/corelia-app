ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS screenshot_url text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS video_url text;

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
  v_screenshot text;
  v_cover text;
  v_video text;
  v_hackathon_id text;
BEGIN
  v_hackathon_id := NEW.hackathon_id::text;
  v_title := COALESCE(NULLIF(NEW.document->>'title', ''), 'Contest submission');
  v_summary := NULLIF(NEW.document->>'summary', '');
  v_demo := NULLIF(NEW.document->>'demo_url', '');
  v_repo := NULLIF(NEW.document->>'repo_url', '');
  v_slide := NULLIF(NEW.document->>'slide_url', '');
  v_screenshot := NULLIF(NEW.document->>'screenshot_url', '');
  v_cover := COALESCE(NULLIF(NEW.document->>'cover_image_url', ''), v_screenshot);
  v_video := NULLIF(NEW.document->>'video_url', '');

  INSERT INTO public.projects (
    owner_id,
    title,
    summary,
    demo_url,
    repo_url,
    slide_url,
    screenshot_url,
    cover_image_url,
    video_url,
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
    v_screenshot,
    v_cover,
    v_video,
    'public',
    'contest',
    v_hackathon_id,
    NEW.id
  )
  ON CONFLICT (owner_id, source_type, source_submission_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    demo_url = EXCLUDED.demo_url,
    repo_url = EXCLUDED.repo_url,
    slide_url = EXCLUDED.slide_url,
    screenshot_url = EXCLUDED.screenshot_url,
    cover_image_url = EXCLUDED.cover_image_url,
    video_url = EXCLUDED.video_url,
    source_id = EXCLUDED.source_id,
    updated_at = now();

  RETURN NEW;
END;
$$;
