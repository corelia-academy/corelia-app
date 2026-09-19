DO $test$
DECLARE
  actor uuid := gen_random_uuid();
  moderation_actor uuid := gen_random_uuid();
  project uuid := gen_random_uuid();
  moderation_project uuid := gen_random_uuid();
  request_id uuid;
  i integer;
BEGIN
  INSERT INTO auth.users(id) VALUES(actor),(moderation_actor);
  SET LOCAL ROLE service_role;

  request_id := public.reserve_project_translation_success(actor,project);
  IF NOT EXISTS (
    SELECT 1 FROM private.project_translation_requests
    WHERE id=request_id AND actor_id=actor AND status='reserved' AND expires_at > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'Successful translation reservation was not created';
  END IF;
  PERFORM public.release_project_translation(actor,request_id);
  IF EXISTS (SELECT 1 FROM private.project_translation_requests WHERE id=request_id) THEN
    RAISE EXCEPTION 'Released reservation still consumes a slot';
  END IF;

  request_id := public.reserve_project_translation_success(actor,project);
  PERFORM public.commit_project_translation(actor,request_id);
  IF NOT EXISTS (
    SELECT 1 FROM private.project_translation_requests
    WHERE id=request_id AND actor_id=actor AND status='committed' AND expires_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Successful translation was not committed';
  END IF;
  FOR i IN 1..9 LOOP
    request_id := public.reserve_project_translation_success(actor,project);
    PERFORM public.commit_project_translation(actor,request_id);
  END LOOP;
  BEGIN
    PERFORM public.reserve_project_translation_success(actor,project);
    RAISE EXCEPTION 'Eleventh successful translation was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%rate_limited:project_translation%' THEN RAISE; END IF;
  END;

  FOR i IN 1..10 LOOP
    PERFORM public.record_project_translation_moderation_block(moderation_actor,moderation_project);
  END LOOP;
  BEGIN
    PERFORM public.assert_project_translation_moderation_allowed(moderation_actor);
    RAISE EXCEPTION 'Eleventh blocked request was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%rate_limited:project_translation_moderation%' THEN RAISE; END IF;
  END;
  -- Moderation abuse quota is separate from successful translation quota.
  request_id := public.reserve_project_translation_success(moderation_actor,moderation_project);
  PERFORM public.commit_project_translation(moderation_actor,request_id);
  RESET ROLE;
END;
$test$;
