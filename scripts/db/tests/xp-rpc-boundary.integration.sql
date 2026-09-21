BEGIN;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid,p.proname,p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'xp_%' LOOP
  IF f.prosecdef THEN RAISE EXCEPTION 'exposed XP definer: %',f.proname; END IF;
 END LOOP;
 IF has_function_privilege('anon','public.xp_toggle_project_heart(uuid)','EXECUTE')
   OR has_function_privilege('authenticated','public.xp_link_verified_ocid(uuid,text,text)','EXECUTE')
   OR has_function_privilege('authenticated','private.xp_consume_wallet_challenge(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'XP privileged RPC grant leaked'; END IF;
END $$;
INSERT INTO auth.users(id,email) VALUES
 ('eeee7777-0000-4000-8000-000000000001','xp-owner@corelia.local'),
 ('eeee7777-0000-4000-8000-000000000002','xp-reader@corelia.local');
UPDATE public.profiles SET profile_public=false WHERE id='eeee7777-0000-4000-8000-000000000002';
INSERT INTO public.projects(id,owner_id,title,slug,source_type,visibility)
VALUES('eeee7777-0000-4000-8000-000000000003','eeee7777-0000-4000-8000-000000000001','XP boundary project','xp-boundary-project','standalone','public');
SELECT set_config('request.jwt.claim.sub','eeee7777-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.xp_toggle_project_heart('eeee7777-0000-4000-8000-000000000003');
 IF r<> '{"hearted":true,"awarded":true}'::jsonb THEN RAISE EXCEPTION 'first like failed: %',r; END IF;
 PERFORM public.xp_toggle_project_heart('eeee7777-0000-4000-8000-000000000003');
 r:=public.xp_toggle_project_heart('eeee7777-0000-4000-8000-000000000003');
 IF r<> '{"hearted":true,"awarded":false}'::jsonb THEN RAISE EXCEPTION 'repeat like awarded: %',r; END IF;
 IF (public.xp_summary(auth.uid())->>'total')::integer<>2 THEN RAISE EXCEPTION 'owner summary wrong'; END IF;
 IF (SELECT sum(xp) FROM public.xp_day_breakdown((now() AT TIME ZONE 'UTC')::date))<>2 THEN RAISE EXCEPTION 'owner breakdown wrong'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF public.xp_summary('eeee7777-0000-4000-8000-000000000002') IS NOT NULL THEN RAISE EXCEPTION 'private summary leaked'; END IF;
 IF EXISTS(SELECT 1 FROM public.xp_totals(ARRAY['eeee7777-0000-4000-8000-000000000002'::uuid])) THEN RAISE EXCEPTION 'private total leaked'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
