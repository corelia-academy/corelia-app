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

  PERFORM * FROM public.save_ai_gated_project(
    p_actor_id => v_user_id, p_project_id => v_project_id,
    p_slug => 'project-gate-test', p_title => 'Project story',
    p_description => '## Solution' || chr(10) || 'Detailed description',
    p_progress => 'Built a working prototype',
    p_pitch_video_url => 'https://youtu.be/pitch-test'
  );
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id
    AND description LIKE '## Solution%' AND progress = 'Built a working prototype'
    AND pitch_video_url = 'https://youtu.be/pitch-test') THEN
    RAISE EXCEPTION 'Project story was not persisted';
  END IF;
  -- Legacy clients must preserve fields they do not yet send.
  PERFORM * FROM public.save_ai_gated_project(
    p_actor_id => v_user_id, p_project_id => v_project_id,
    p_slug => 'project-gate-test', p_title => 'Legacy edit'
  );
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id
    AND progress = 'Built a working prototype') THEN
    RAISE EXCEPTION 'Legacy save erased project story';
  END IF;
  BEGIN
    PERFORM * FROM public.save_ai_gated_project(
      p_actor_id => v_user_id, p_project_id => v_project_id,
      p_slug => 'project-gate-test', p_title => 'Should roll back',
      p_description => repeat('x', 20001)
    );
    RAISE EXCEPTION 'Oversized description accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id AND title = 'Legacy edit') THEN
    RAISE EXCEPTION 'Content constraint failure did not roll back the base save';
  END IF;
  PERFORM * FROM public.save_ai_gated_project(
    p_actor_id => v_user_id, p_project_id => v_project_id,
    p_slug => 'project-gate-test', p_title => 'Clear story',
    p_description => '', p_progress => '', p_pitch_video_url => ''
  );
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id
    AND (description IS NOT NULL OR progress IS NOT NULL OR pitch_video_url IS NOT NULL)) THEN
    RAISE EXCEPTION 'Explicitly cleared story fields remain';
  END IF;
  IF has_function_privilege('authenticated', 'public.save_ai_gated_project(uuid,uuid,text,text,text,text,text,text,text,text,text[],text,text,text,text[],text[],text[],text,text,text)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.save_ai_gated_project(uuid,uuid,text,text,text,text,text,text,text,text,text[],text,text,text,text[],text[],text[],text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Project story RPC exposed outside the AI gate';
  END IF;

  DELETE FROM public.project_media_uploads WHERE project_id = v_project_id;
  DELETE FROM public.projects WHERE id = v_project_id;
  DELETE FROM public.profiles WHERE id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$test$;
