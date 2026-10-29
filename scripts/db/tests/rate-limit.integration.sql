DO $test$
DECLARE
  v_subject uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  i integer;
BEGIN
  SET LOCAL ROLE service_role;

  FOR i IN 1..3 LOOP
    PERFORM public.consume_rate_limit('test_bucket',v_subject,3,60);
  END LOOP;
  BEGIN
    PERFORM public.consume_rate_limit('test_bucket',v_subject,3,60);
    RAISE EXCEPTION 'Fourth hit inside the window was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rate_limited:test_bucket' THEN RAISE; END IF;
  END;
  -- Rejected hits do not extend the window.
  IF (SELECT count(*) FROM private.rate_limit_hits WHERE bucket='test_bucket' AND subject=v_subject) <> 3 THEN
    RAISE EXCEPTION 'Rejected hit was recorded';
  END IF;

  -- Buckets and subjects are independent.
  PERFORM public.consume_rate_limit('test_bucket',other,3,60);
  PERFORM public.consume_rate_limit('test_other_bucket',v_subject,3,60);

  -- Hits outside the window no longer count.
  RESET ROLE;
  UPDATE private.rate_limit_hits SET hit_at = hit_at - interval '2 minutes'
  WHERE bucket='test_bucket' AND rate_limit_hits.subject=v_subject;
  SET LOCAL ROLE service_role;
  PERFORM public.consume_rate_limit('test_bucket',v_subject,3,60);

  BEGIN
    PERFORM public.consume_rate_limit('test_bucket',v_subject,3,86401);
    RAISE EXCEPTION 'Window longer than the cleanup horizon was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'invalid_input:rate_limit' THEN RAISE; END IF;
  END;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.consume_rate_limit('test_bucket',v_subject,3,60);
    RAISE EXCEPTION 'Browser role can consume rate-limit buckets';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='corelia-rate-limit-cleanup') THEN
    RAISE EXCEPTION 'Rate-limit cleanup job is not scheduled';
  END IF;
  DELETE FROM private.rate_limit_hits WHERE bucket LIKE 'test_%';
END;
$test$;
