BEGIN;
INSERT INTO auth.users(id,email)
SELECT ('efee0000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'feed-v2-' || n || '@corelia.local'
FROM generate_series(1,9) n;
UPDATE public.profiles SET profile_public = id <> 'efee0000-0000-4000-8000-000000000005'
WHERE id::text LIKE 'efee0000-%';
INSERT INTO public.user_point_ledger(user_id,source,source_key,points)
SELECT id,'lesson_completed','feed-v2-test',100 FROM public.profiles WHERE id::text LIKE 'efee0000-%';
INSERT INTO public.feed_milestones(actor_id,kind,source_key,xp_total,created_at)
SELECT id,'xp_reached','feed-v2-test',100,'2026-09-23 00:00:00+00' FROM public.profiles WHERE id::text LIKE 'efee0000-%';
-- Hidden-card and per-kind opt-out tables were retired by automatic public milestones.
-- Exercise current visibility through private profiles and invalid source state.
UPDATE public.profiles SET profile_public=false WHERE id IN (
 'efee0000-0000-4000-8000-000000000006','efee0000-0000-4000-8000-000000000007');
UPDATE public.feed_milestones SET xp_total=200 WHERE actor_id='efee0000-0000-4000-8000-000000000008';
INSERT INTO public.follows(follower_id,subject_type,subject_id,muted_until) VALUES
('efee0000-0000-4000-8000-000000000001','user','efee0000-0000-4000-8000-000000000003',null),
('efee0000-0000-4000-8000-000000000001','user','efee0000-0000-4000-8000-000000000004',now()+interval '1 day'),
('efee0000-0000-4000-8000-000000000001','user','efee0000-0000-4000-8000-000000000009',now()-interval '1 day');
INSERT INTO public.courses(id,slug,instructor_id,published,data) VALUES
('feed-v2-course','feed-v2-course','efee0000-0000-4000-8000-000000000002',true,'{"title":"Feed test"}');
INSERT INTO public.course_sections(course_id,id,data) VALUES ('feed-v2-course','section','{"title":"Section"}');
INSERT INTO public.course_lessons(course_id,id,section_id,sort_order,published,data)
VALUES ('feed-v2-course','lesson','section',1,true,'{"title":"Lesson","lesson_format":"article","description_markdown":"Test"}');
INSERT INTO public.lesson_progress(id,user_id,course_id,lesson_id,completed_at)
VALUES ('feed-v2-progress','efee0000-0000-4000-8000-000000000002','feed-v2-course','lesson',now());
INSERT INTO public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at,completed_at) VALUES
('feed-v2-enrollment','efee0000-0000-4000-8000-000000000002','feed-v2-course',now(),now(),now())
ON CONFLICT(user_id,course_id) DO UPDATE SET completed_at=excluded.completed_at;
INSERT INTO public.feed_milestones(actor_id,kind,source_key,course_id)
VALUES ('efee0000-0000-4000-8000-000000000002','course_completed','feed-v2-course','feed-v2-course')
ON CONFLICT(actor_id,kind,source_key) DO NOTHING;
INSERT INTO public.follows(follower_id,subject_type,subject_id) VALUES
('efee0000-0000-4000-8000-000000000001','course','feed-v2-course');
-- Same timestamp, multiple pages: use valid synthetic XP milestones.
INSERT INTO public.feed_milestones(actor_id,kind,source_key,xp_total,created_at)
SELECT 'efee0000-0000-4000-8000-000000000002','xp_reached','page-'||n,1,'2026-09-23 00:00:00+00'
FROM generate_series(1,25) n;
SELECT set_config('request.jwt.claim.sub','efee0000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE page1 bigint[]; page2 bigint[]; cursor_row public.feed_milestones;
BEGIN
  IF EXISTS(SELECT 1 FROM public.get_feed_milestones_v2('explore',p_limit=>50) WHERE actor_id <> 'efee0000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Explore leaked self, followed, muted or invisible actor';
  END IF;
  IF (SELECT count(*) FROM public.get_feed_milestones_v2('following')) <> 2 OR EXISTS(
    SELECT 1 FROM public.get_feed_milestones_v2('following') WHERE actor_id NOT IN ('efee0000-0000-4000-8000-000000000003','efee0000-0000-4000-8000-000000000009')
  ) THEN RAISE EXCEPTION 'Following must contain only active followed people'; END IF;
  IF EXISTS(SELECT id FROM public.get_feed_milestones_v2('explore') INTERSECT SELECT id FROM public.get_feed_milestones_v2('following')) THEN
    RAISE EXCEPTION 'Timelines overlap'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.get_feed_milestones_v2('explore',p_limit=>50) WHERE course_id='feed-v2-course') THEN
    RAISE EXCEPTION 'Following a course must not remove its actor from Explore'; END IF;
  SELECT array_agg(id ORDER BY created_at DESC,id DESC) INTO page1 FROM public.get_feed_milestones_v2('explore');
  SELECT * INTO cursor_row FROM public.feed_milestones WHERE id=page1[20];
  SELECT array_agg(id ORDER BY created_at DESC,id DESC) INTO page2 FROM public.get_feed_milestones_v2('explore',cursor_row.created_at,cursor_row.id);
  IF cardinality(page1) <> 20 OR cardinality(page2) <> 7 OR page1 && page2 THEN RAISE EXCEPTION 'Cursor pagination skipped or duplicated rows'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.get_feed_milestones_v1(p_actor_id=>'efee0000-0000-4000-8000-000000000001')) OR
     NOT EXISTS(SELECT 1 FROM public.get_feed_milestones_v1(p_actor_id=>'efee0000-0000-4000-8000-000000000003')) THEN
    RAISE EXCEPTION 'v1 profile activity regressed'; END IF;
  BEGIN
    PERFORM public.get_feed_milestones_v2('bad-mode');
    RAISE EXCEPTION 'Invalid mode accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
-- A successful follow moves the person to Following; unfollow moves them back.
INSERT INTO public.follows(follower_id,subject_type,subject_id) VALUES
('efee0000-0000-4000-8000-000000000001','user','efee0000-0000-4000-8000-000000000002');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.get_feed_milestones_v2('explore')) OR NOT EXISTS(SELECT 1 FROM public.get_feed_milestones_v2('following',p_limit=>50) WHERE actor_id='efee0000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Follow did not move actor'; END IF;
END $$;
DELETE FROM public.follows WHERE follower_id=auth.uid() AND subject_type='user';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.get_feed_milestones_v2('following')) THEN RAISE EXCEPTION 'Following not empty without person follows'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.get_feed_milestones_v2('explore',p_limit=>50) WHERE actor_id='efee0000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'Unfollow did not restore Explore'; END IF;
END $$;
RESET ROLE;
UPDATE public.courses SET published=false WHERE id='feed-v2-course';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.get_feed_milestones_v2('explore',p_limit=>50) WHERE course_id='feed-v2-course') THEN RAISE EXCEPTION 'Unpublished source leaked'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF has_function_privilege('anon','public.get_feed_milestones_v2(text,timestamptz,bigint,integer)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous access granted'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.get_feed_milestones_v2(text,timestamptz,bigint,integer)'::regprocedure) THEN RAISE EXCEPTION 'RPC bypasses RLS'; END IF;
END $$;
ROLLBACK;
