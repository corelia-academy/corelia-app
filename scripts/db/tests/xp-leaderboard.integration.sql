BEGIN;
INSERT INTO auth.users(id,email)
SELECT ('ebad0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 'xp-rank-'||n||'@corelia.local' FROM generate_series(1,10) n;
UPDATE public.profiles SET full_name='Rank Test', profile_public=id<>'ebad0000-0000-4000-8000-000000000005',
 role=case id when 'ebad0000-0000-4000-8000-000000000006' then 'admin' when 'ebad0000-0000-4000-8000-000000000007' then 'support_staff' when 'ebad0000-0000-4000-8000-000000000008' then 'instructor' else 'student' end
WHERE id::text LIKE 'ebad0000-%';
INSERT INTO public.user_point_ledger(user_id,source,source_key,points,occurred_at)
SELECT ('ebad0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'lesson_completed','week-award',
 case n when 1 then 10 when 2 then 500 when 3 then 500 when 4 then 200 when 8 then 300 when 9 then 50 else 9000 end,
 date_trunc('week',now() at time zone 'UTC') at time zone 'UTC'
FROM generate_series(1,9) n;
INSERT INTO public.user_point_ledger(user_id,source,source_key,points,occurred_at) VALUES
('ebad0000-0000-4000-8000-000000000004','lesson_completed','previous-week',1000,(date_trunc('week',now() at time zone 'UTC') at time zone 'UTC')-interval '1 microsecond'),
('ebad0000-0000-4000-8000-000000000009','daily_streak_claim','legacy',600,null),
('ebad0000-0000-4000-8000-000000000010','lesson_completed','next-week',100,(date_trunc('week',now() at time zone 'UTC') at time zone 'UTC')+interval '7 days');
INSERT INTO public.user_point_ledger(user_id,source,source_key,points,occurred_at,reverses_id,reason)
SELECT user_id,'correction','reverse:'||id,-points,now(),id,'Private correction reason' FROM public.user_point_ledger WHERE source_key IN ('previous-week','legacy') AND user_id::text LIKE 'ebad0000-%';
SELECT set_config('request.jwt.claim.sub','ebad0000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE result jsonb; row_data jsonb;
BEGIN
 result:=public.xp_leaderboard_v1('week');
 IF (result->>'eligible_count')::int <> 6 OR (result#>>'{viewer,position}')::int <> 6 THEN RAISE EXCEPTION 'Eligibility or viewer position incorrect: %',result; END IF;
 IF result#>>'{rows,0,position}' <> '1' OR result#>>'{rows,1,position}' <> '1' OR result#>>'{rows,2,position}' <> '3' THEN RAISE EXCEPTION 'Competition ranking failed'; END IF;
 IF result#>>'{rows,0,id}' <> 'ebad0000-0000-4000-8000-000000000002' THEN RAISE EXCEPTION 'Tie order is unstable'; END IF;
 FOR row_data IN SELECT value FROM jsonb_array_elements(result->'rows') LOOP
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(row_data) k WHERE k NOT IN ('id','username','ocid','full_name','avatar_url','avatar_seed','position','total_xp','period_xp')) THEN RAISE EXCEPTION 'Private fields leaked'; END IF;
   IF row_data->>'id'='ebad0000-0000-4000-8000-000000000004' AND (row_data->>'period_xp')::int<>200 THEN RAISE EXCEPTION 'Old reversal counted this week'; END IF;
   IF row_data->>'id'='ebad0000-0000-4000-8000-000000000009' AND (row_data->>'period_xp')::int<>50 THEN RAISE EXCEPTION 'Undated reversal counted this week'; END IF;
 END LOOP;
 IF (result->>'period_start')::timestamptz <> date_trunc('week',now() at time zone 'UTC') at time zone 'UTC' THEN RAISE EXCEPTION 'Week is not UTC Monday'; END IF;
 IF result::text LIKE '%Private correction reason%' THEN RAISE EXCEPTION 'Ledger reason leaked'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_point_ledger WHERE user_id<>auth.uid()) THEN RAISE EXCEPTION 'Other users ledger exposed'; END IF;
 BEGIN
  PERFORM public.xp_leaderboard_v1('month'); RAISE EXCEPTION 'Invalid period accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 result:=public.xp_leaderboard_v1('all_time');
 IF result->'period_start' <> 'null'::jsonb OR (result->>'eligible_count')::int<>7 THEN RAISE EXCEPTION 'All-time period incorrect'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','ebad0000-0000-4000-8000-000000000005',true);
DO $$ DECLARE result jsonb; BEGIN
 result:=public.xp_leaderboard_v1('week');
 IF result#>>'{viewer,reason}'<>'private_profile' OR result#>'{viewer,position}'<>'null'::jsonb OR result#>>'{viewer,total_xp}'<>'9000' THEN RAISE EXCEPTION 'Private viewer handling failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','ebad0000-0000-4000-8000-000000000006',true);
DO $$ BEGIN
 IF public.xp_leaderboard_v1('week')#>>'{viewer,reason}'<>'ineligible_role' THEN RAISE EXCEPTION 'Staff viewer ranked'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','ebad0000-0000-4000-8000-000000000010',true);
DO $$ BEGIN
 IF public.xp_leaderboard_v1('week')#>>'{viewer,reason}'<>'no_xp' THEN RAISE EXCEPTION 'Future XP entered weekly ranking'; END IF;
END $$;
RESET ROLE;
-- More than 100 participants; the viewer must still get an exact rank.
INSERT INTO auth.users(id,email)
SELECT ('ebad0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid, 'xp-rank-'||n||'@corelia.local' FROM generate_series(11,115) n;
UPDATE public.profiles SET profile_public=true WHERE id::text LIKE 'ebad0000-%' AND id>'ebad0000-0000-4000-8000-000000000010';
INSERT INTO public.user_point_ledger(user_id,source,source_key,points,occurred_at)
SELECT id,'lesson_completed','bulk-week',100,now() FROM public.profiles WHERE id::text LIKE 'ebad0000-%' AND id>'ebad0000-0000-4000-8000-000000000010';
SELECT set_config('request.jwt.claim.sub','ebad0000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
 result:=public.xp_leaderboard_v1('week');
 IF jsonb_array_length(result->'rows')<>100 OR result#>>'{viewer,position}'<>'111' OR result->>'eligible_count'<>'111' THEN RAISE EXCEPTION 'Top 100 or outside viewer rank incorrect'; END IF;
END $$;
RESET ROLE;
-- Eligibility changes must be reflected on the next read, not a scheduled snapshot.
UPDATE public.profiles SET profile_public=false WHERE id='ebad0000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.xp_leaderboard_v1('week')->'rows') r WHERE r->>'id'='ebad0000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Newly private profile leaked'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.xp_leaderboard_v1(text)','EXECUTE') OR has_function_privilege('anon','private.xp_leaderboard_v1(text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous grants exposed'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.xp_leaderboard_v1(text)'::regprocedure) THEN RAISE EXCEPTION 'Public wrapper must be invoker'; END IF;
END $$;
-- A correction in the same week removes the revoked award from both scores.
INSERT INTO public.user_point_ledger(user_id,source,source_key,points,occurred_at,reverses_id,reason)
SELECT user_id,'correction','reverse:'||id,-points,now(),id,'Same week correction'
FROM public.user_point_ledger WHERE user_id='ebad0000-0000-4000-8000-000000000008' AND source_key='week-award';
SELECT set_config('request.jwt.claim.sub','ebad0000-0000-4000-8000-000000000008',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
 result:=public.xp_leaderboard_v1('week');
 IF result#>>'{viewer,reason}'<>'no_xp' OR result#>>'{viewer,total_xp}'<>'0' OR result#>>'{viewer,period_xp}'<>'0' THEN RAISE EXCEPTION 'Same-week reversal failed'; END IF;
END $$;
RESET ROLE;
UPDATE public.profiles SET profile_public=false WHERE id::text LIKE 'ebad0000-%';
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
 result:=public.xp_leaderboard_v1('week');
 IF jsonb_array_length(result->'rows')<>0 OR result->>'eligible_count'<>'0' THEN RAISE EXCEPTION 'Empty leaderboard not empty'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.xp_leaderboard_v1('week'); RAISE EXCEPTION 'Missing auth accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
