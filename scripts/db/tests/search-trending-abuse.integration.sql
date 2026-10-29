DO $test$
DECLARE
  spammer uuid := gen_random_uuid();
  reader_a uuid := gen_random_uuid();
  reader_b uuid := gen_random_uuid();
  i integer;
  spam_score bigint;
  real_score bigint;
BEGIN
  INSERT INTO auth.users(id) VALUES(spammer),(reader_a),(reader_b);

  -- Immediate repeats of one query by one user are dropped.
  INSERT INTO public.search_query_events(user_id,query) VALUES(spammer,'zqxvspam');
  INSERT INTO public.search_query_events(user_id,query) VALUES(spammer,' ZQXVSPAM ');
  IF (SELECT count(*) FROM public.search_query_events WHERE user_id=spammer) <> 1 THEN
    RAISE EXCEPTION 'Repeated query inside the dedupe window was logged';
  END IF;

  -- Older repeats are kept as events but still count as one searcher.
  UPDATE public.search_query_events SET created_at = now() - interval '30 minutes' WHERE user_id=spammer;
  FOR i IN 1..5 LOOP
    INSERT INTO public.search_query_events(user_id,query,created_at)
    VALUES(spammer,'zqxvspam',now() - make_interval(hours => i));
  END LOOP;
  IF (SELECT count(*) FROM public.search_query_events WHERE user_id=spammer) <> 6 THEN
    RAISE EXCEPTION 'Spaced-out repeats were not logged';
  END IF;
  INSERT INTO public.search_query_events(user_id,query) VALUES(reader_a,'zqxvreal'),(reader_b,'zqxvreal');

  SELECT searches INTO spam_score FROM public.list_trending_searches(20) WHERE query='zqxvspam';
  SELECT searches INTO real_score FROM public.list_trending_searches(20) WHERE query='zqxvreal';
  IF spam_score IS DISTINCT FROM 1 OR real_score IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Trending is not ranked by distinct searchers (spam %, real %)', spam_score, real_score;
  END IF;

  -- Per-user hourly cap.
  FOR i IN 1..70 LOOP
    INSERT INTO public.search_query_events(user_id,query) VALUES(reader_a,'zqxvcap' || i);
  END LOOP;
  IF (SELECT count(*) FROM public.search_query_events WHERE user_id=reader_a AND created_at > now() - interval '1 hour') <> 60 THEN
    RAISE EXCEPTION 'Hourly search event cap was not enforced';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='corelia-search-query-events-retention')
    OR NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='corelia-wallet-challenge-cleanup') THEN
    RAISE EXCEPTION 'Retention jobs are not scheduled';
  END IF;

  DELETE FROM auth.users WHERE id IN (spammer,reader_a,reader_b);
END;
$test$;
