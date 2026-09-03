DO $test$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_project_id uuid := gen_random_uuid();
  v_logo_path text;
BEGIN
  IF to_regclass('public.project_comments') IS NOT NULL
    OR to_regprocedure('private.project_comments_soft_delete_guard()') IS NOT NULL
  THEN
    RAISE EXCEPTION 'Retired project comment database objects remain';
  END IF;
  IF to_regclass('public.project_hearts') IS NULL THEN
    RAISE EXCEPTION 'Project hearts were removed unexpectedly';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
      AND column_name IN ('cover_image_url', 'screenshot_url')
  ) THEN
    RAISE EXCEPTION 'Legacy project media columns remain';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
      AND column_name = 'logo_path' AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
      AND column_name = 'screenshot_paths' AND data_type = 'ARRAY'
  ) THEN
    RAISE EXCEPTION 'Canonical project media columns are missing';
  END IF;
  IF has_table_privilege('authenticated', 'public.projects', 'INSERT')
    OR has_table_privilege('authenticated', 'public.projects', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.project_locales', 'INSERT')
    OR has_table_privilege('authenticated', 'public.project_locales', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.project_locales', 'DELETE')
  THEN
    RAISE EXCEPTION 'Browser role can bypass the project AI write boundary';
  END IF;
  IF has_table_privilege('authenticated', 'public.project_media_uploads', 'SELECT')
    OR has_table_privilege('authenticated', 'public.project_media_uploads', 'INSERT')
  THEN
    RAISE EXCEPTION 'Browser role can access the project upload registry';
  END IF;

  INSERT INTO auth.users (id, email)
  VALUES (v_user_id, 'project-gate-test@corelia.local');
  v_logo_path := 'project-media/' || v_user_id::text || '/' || v_project_id::text || '/logo/test.png';

  BEGIN
    PERFORM * FROM public.save_ai_gated_project(
      p_actor_id => v_user_id,
      p_project_id => v_project_id,
      p_slug => 'project-gate-test',
      p_title => 'Project gate test',
      p_logo_path => v_logo_path
    );
    RAISE EXCEPTION 'Unregistered project media bypassed the AI gate';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invalid_input:project_logo_upload%' THEN
        RAISE;
      END IF;
  END;

  INSERT INTO public.project_media_uploads (path, owner_id, project_id)
  VALUES (v_logo_path, v_user_id, v_project_id);
  PERFORM * FROM public.save_ai_gated_project(
    p_actor_id => v_user_id,
    p_project_id => v_project_id,
    p_slug => 'project-gate-test',
    p_title => 'Project gate test',
    p_logo_path => v_logo_path
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = v_project_id AND visibility = 'public' AND logo_path = v_logo_path
  ) THEN
    RAISE EXCEPTION 'AI-gated project save did not persist canonical media';
  END IF;

  DELETE FROM public.project_media_uploads WHERE project_id = v_project_id;
  DELETE FROM public.projects WHERE id = v_project_id;
  DELETE FROM public.profiles WHERE id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$test$;
