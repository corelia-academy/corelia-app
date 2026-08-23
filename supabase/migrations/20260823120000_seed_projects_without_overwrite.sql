-- C-06: a submission seeds its portfolio project once; the project owns later edits.
-- Keep the existing AFTER INSERT OR UPDATE triggers so an update can recreate a
-- missing historical project, but an existing project must never be overwritten.

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
  DO NOTHING;

  RETURN NEW;
END;
$$;

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
  DO NOTHING;

  RETURN NEW;
END;
$$;
