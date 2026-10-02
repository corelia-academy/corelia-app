-- QA #661 regression: quiz XP threshold (B-07), project card after hackathon
-- transfer (B-08), wallet re-link results (B-03), per-user XP milestone lock (H-01).
BEGIN;

INSERT INTO auth.users(id,email) VALUES
  ('a6610000-0000-4000-8000-000000000001','qa661-learner@corelia.local'),
  ('a6610000-0000-4000-8000-000000000002','qa661-instructor@corelia.local'),
  ('a6610000-0000-4000-8000-000000000003','qa661-staff@corelia.local'),
  ('a6610000-0000-4000-8000-000000000004','qa661-other@corelia.local');
UPDATE public.profiles SET role='support_staff' WHERE id='a6610000-0000-4000-8000-000000000003';
UPDATE public.profiles SET profile_public=true WHERE id='a6610000-0000-4000-8000-000000000001';

-- B-07 fixtures: three quiz lessons with thresholds 0.7 (default), 0.8 and 0.9, ten questions each.
INSERT INTO public.courses(id,instructor_id,slug,published,data)
VALUES('qa661-course','a6610000-0000-4000-8000-000000000002','qa661-course',true,'{"title":"QA661"}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('qa661-course','s1','{"title":"S"}');
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES
  ('qa661-course','q70','s1',true,'{"title":"Q70","lesson_format":"quiz"}'),
  ('qa661-course','q80','s1',true,'{"title":"Q80","lesson_format":"quiz","quiz_config":{"passing_ratio":0.8}}'),
  ('qa661-course','q90','s1',true,'{"title":"Q90","lesson_format":"quiz","quiz_config":{"passing_ratio":0.9}}');
INSERT INTO public.course_section_questions(id,course_id,section_id,lesson_id,sort_order,data)
SELECT l||'-'||n,'qa661-course',NULL,l,n,
  '{"type":"mcq","question":"Q","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}'::jsonb
FROM unnest(ARRAY['q70','q80','q90']) l, generate_series(1,10) n;
INSERT INTO public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at)
VALUES('a6610000-0000-4000-8000-000000000001_qa661-course','a6610000-0000-4000-8000-000000000001','qa661-course',now(),now());

CREATE FUNCTION pg_temp.answers(p_lesson text,p_correct int) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_object_agg(p_lesson||'-'||n, CASE WHEN n<=p_correct THEN 0 ELSE 1 END) FROM generate_series(1,10) n
$$;
GRANT EXECUTE ON FUNCTION pg_temp.answers(text,int) TO authenticated;

SELECT set_config('request.jwt.claim.sub','a6610000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.learning_quiz_submit('qa661-course','q70',gen_random_uuid(),pg_temp.answers('q70',7),0);
SELECT public.learning_quiz_submit('qa661-course','q80',gen_random_uuid(),pg_temp.answers('q80',7),0);
SELECT public.learning_quiz_submit('qa661-course','q90',gen_random_uuid(),pg_temp.answers('q90',8),0);
RESET ROLE;

DO $$
DECLARE xp int;
BEGIN
  SELECT coalesce(sum(points),0) INTO xp FROM public.user_point_ledger
  WHERE user_id='a6610000-0000-4000-8000-000000000001' AND source_key IN ('quiz_passed:qa661-course:q70','lesson_completed:qa661-course:q70');
  IF xp<>30 THEN RAISE EXCEPTION 'B-07: 7/10 on a 0.7 quiz must award 30 XP, got %',xp; END IF;
  IF EXISTS(SELECT 1 FROM public.user_point_ledger WHERE user_id='a6610000-0000-4000-8000-000000000001'
    AND source_key IN ('quiz_passed:qa661-course:q80','lesson_completed:qa661-course:q80','quiz_passed:qa661-course:q90','lesson_completed:qa661-course:q90')) THEN
    RAISE EXCEPTION 'B-07: failed attempt below its own threshold awarded XP';
  END IF;
END $$;

-- At/above threshold: 8/10 on 0.8 and 9/10 on 0.9 award; resubmitting does not duplicate.
SELECT set_config('request.jwt.claim.sub','a6610000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.learning_quiz_submit('qa661-course','q80',gen_random_uuid(),pg_temp.answers('q80',8),0);
SELECT public.learning_quiz_submit('qa661-course','q90',gen_random_uuid(),pg_temp.answers('q90',9),0);
SELECT public.learning_quiz_submit('qa661-course','q90',gen_random_uuid(),pg_temp.answers('q90',10),0);
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.user_point_ledger WHERE user_id='a6610000-0000-4000-8000-000000000001'
        AND source_key LIKE 'quiz_passed:qa661-course:%')<>3
     OR (SELECT coalesce(sum(points),0) FROM public.user_point_ledger WHERE user_id='a6610000-0000-4000-8000-000000000001'
        AND source_key LIKE '%:qa661-course:%')<>90 THEN
    RAISE EXCEPTION 'B-07: boundary or duplicate award wrong';
  END IF;
END $$;

-- H-01: the milestone trigger takes a per-user advisory lock (two-session overlap is checked manually).
DO $$ BEGIN
  IF pg_get_functiondef('private.feed_on_xp_awarded()'::regprocedure) NOT LIKE '%pg_advisory_xact_lock%' THEN
    RAISE EXCEPTION 'H-01: feed_on_xp_awarded does not serialize per user';
  END IF;
END $$;

-- B-08: transfer moves the existing project card to the destination hackathon.
INSERT INTO public.hackathons(id,status,document) VALUES
  ('qa661-src','published','{"tracks":[{"id":"t","name":"T"}],"sectors":[{"id":"s","name":"S"}],"tech_stacks":[{"id":"k","name":"K"}]}'),
  ('qa661-dst','published','{"tracks":[{"id":"t","name":"T"}],"sectors":[{"id":"s","name":"S"}],"tech_stacks":[{"id":"k","name":"K"}]}');
INSERT INTO public.projects(id,owner_id,slug,title,source_type,visibility)
VALUES('a6610000-0000-4000-8000-0000000000a1','a6610000-0000-4000-8000-000000000001','qa661-project','QA661 project','standalone','public');
SET LOCAL ROLE service_role;
SELECT public.transfer_project_hackathon('a6610000-0000-4000-8000-000000000003','a6610000-0000-4000-8000-0000000000a1','qa661-src',ARRAY['t'],'QA661 import');
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.feed_milestones WHERE kind='project_submitted' AND project_id='a6610000-0000-4000-8000-0000000000a1' AND hackathon_id='qa661-src')<>1 THEN
    RAISE EXCEPTION 'B-08: initial card missing';
  END IF;
END $$;
SET LOCAL ROLE service_role;
SELECT public.transfer_project_hackathon('a6610000-0000-4000-8000-000000000003','a6610000-0000-4000-8000-0000000000a1','qa661-dst',ARRAY['t'],'QA661 move');
RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.feed_milestones WHERE kind='project_submitted' AND project_id='a6610000-0000-4000-8000-0000000000a1')<>1
     OR NOT EXISTS(SELECT 1 FROM public.feed_milestones WHERE kind='project_submitted' AND project_id='a6610000-0000-4000-8000-0000000000a1' AND hackathon_id='qa661-dst')
     OR NOT EXISTS(SELECT 1 FROM public.feed_milestones m WHERE m.project_id='a6610000-0000-4000-8000-0000000000a1' AND private.feed_milestone_visible(m.id,NULL)) THEN
    RAISE EXCEPTION 'B-08: card did not follow the transferred project';
  END IF;
END $$;

-- B-03: own re-link, foreign-owned wallet and expired challenge give three distinct results.
INSERT INTO public.wallet_link_challenges(id,user_id,chain,address,message,expires_at) VALUES
  ('a6610000-0000-4000-8000-0000000000c1','a6610000-0000-4000-8000-000000000001','ethereum','0xqa661','m',now()+interval '5 minutes'),
  ('a6610000-0000-4000-8000-0000000000c2','a6610000-0000-4000-8000-000000000001','ethereum','0xqa661','m',now()+interval '5 minutes'),
  ('a6610000-0000-4000-8000-0000000000c3','a6610000-0000-4000-8000-000000000004','ethereum','0xqa661','m',now()+interval '5 minutes'),
  ('a6610000-0000-4000-8000-0000000000c4','a6610000-0000-4000-8000-000000000001','ethereum','0xqa661-old','m',now()-interval '1 minute');
SET LOCAL ROLE service_role;
DO $$
DECLARE r jsonb;
BEGIN
  r:=public.xp_consume_wallet_challenge('a6610000-0000-4000-8000-0000000000c1','a6610000-0000-4000-8000-000000000001');
  IF r->>'linked'<>'true' OR r->>'awarded'<>'true' THEN RAISE EXCEPTION 'B-03: first link wrong %',r; END IF;
  r:=public.xp_consume_wallet_challenge('a6610000-0000-4000-8000-0000000000c2','a6610000-0000-4000-8000-000000000001');
  IF r->>'linked'<>'true' OR r->>'awarded'<>'false' THEN RAISE EXCEPTION 'B-03: own re-link wrong %',r; END IF;
  r:=public.xp_consume_wallet_challenge('a6610000-0000-4000-8000-0000000000c3','a6610000-0000-4000-8000-000000000004');
  IF r->>'linked'<>'false' OR r->>'reason'<>'wallet_taken' THEN RAISE EXCEPTION 'B-03: foreign wallet wrong %',r; END IF;
  r:=public.xp_consume_wallet_challenge('a6610000-0000-4000-8000-0000000000c4','a6610000-0000-4000-8000-000000000001');
  IF r->>'linked'<>'false' OR r->>'reason'<>'challenge_expired' THEN RAISE EXCEPTION 'B-03: expired challenge wrong %',r; END IF;
END $$;
RESET ROLE;

-- B-02: only the owner unlinks; the address can then move to another account without a second reward.
SELECT set_config('request.jwt.claim.sub','a6610000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.xp_unlink_wallet('ethereum','0xqa661') THEN RAISE EXCEPTION 'B-02: non-owner unlinked a wallet'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.connected_wallets WHERE chain='ethereum' AND address='0xqa661' AND user_id='a6610000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'B-02: wallet removed by non-owner';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','a6610000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT public.xp_unlink_wallet('ethereum','0xqa661') THEN RAISE EXCEPTION 'B-02: owner could not unlink'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.wallet_link_challenges(id,user_id,chain,address,message,expires_at) VALUES
  ('a6610000-0000-4000-8000-0000000000c5','a6610000-0000-4000-8000-000000000004','ethereum','0xqa661','m',now()+interval '5 minutes'),
  ('a6610000-0000-4000-8000-0000000000c6','a6610000-0000-4000-8000-000000000001','ethereum','0xqa661','m',now()+interval '5 minutes');
SET LOCAL ROLE service_role;
DO $$
DECLARE r jsonb;
BEGIN
  r:=public.xp_consume_wallet_challenge('a6610000-0000-4000-8000-0000000000c5','a6610000-0000-4000-8000-000000000004');
  IF r->>'linked'<>'true' OR r->>'awarded'<>'false' THEN RAISE EXCEPTION 'B-02: moved wallet must link without a second reward %',r; END IF;
  r:=public.xp_consume_wallet_challenge('a6610000-0000-4000-8000-0000000000c6','a6610000-0000-4000-8000-000000000001');
  IF r->>'linked'<>'false' OR r->>'reason'<>'wallet_taken' THEN RAISE EXCEPTION 'B-02: previous owner re-link must see wallet_taken %',r; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT coalesce(sum(points),0) FROM public.user_point_ledger WHERE user_id='a6610000-0000-4000-8000-000000000004' AND source='ethereum_wallet')<>0
     OR (SELECT coalesce(sum(points),0) FROM public.user_point_ledger WHERE user_id='a6610000-0000-4000-8000-000000000001' AND source='ethereum_wallet')<>30 THEN
    RAISE EXCEPTION 'B-02/B-10: wallet XP must be granted once to the first account only';
  END IF;
END $$;

-- B-10: one OCID and one GitHub identity reward in total, across accounts, including through sync.
SET LOCAL ROLE service_role;
DO $$
BEGIN
  IF NOT public.xp_link_verified_ocid('a6610000-0000-4000-8000-000000000001','qa661-ocid',NULL) THEN RAISE EXCEPTION 'B-10: first OCID link must reward'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a6610000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.xp_unlink_ocid();
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
BEGIN
  IF public.xp_link_verified_ocid('a6610000-0000-4000-8000-000000000004','qa661-ocid',NULL) THEN RAISE EXCEPTION 'B-10: same OCID rewarded on a second account'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a6610000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT public.xp_sync_connections();
RESET ROLE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.user_point_ledger WHERE user_id='a6610000-0000-4000-8000-000000000004' AND source='ocid_connected') THEN
    RAISE EXCEPTION 'B-10: sync rewarded an already rewarded OCID';
  END IF;
  IF (SELECT coalesce(sum(points),0) FROM public.user_point_ledger WHERE user_id='a6610000-0000-4000-8000-000000000001' AND source='ocid_connected')<>50 THEN
    RAISE EXCEPTION 'B-10: first account lost or duplicated its OCID reward';
  END IF;
END $$;
INSERT INTO auth.identities(provider_id,user_id,identity_data,provider)
VALUES('qa661-gh','a6610000-0000-4000-8000-000000000001','{"sub":"qa661-gh"}','github');
SELECT set_config('request.jwt.claim.sub','a6610000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.xp_sync_connections();
RESET ROLE;
DELETE FROM auth.identities WHERE provider_id='qa661-gh';
INSERT INTO auth.identities(provider_id,user_id,identity_data,provider)
VALUES('qa661-gh','a6610000-0000-4000-8000-000000000004','{"sub":"qa661-gh"}','github');
SELECT set_config('request.jwt.claim.sub','a6610000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT public.xp_sync_connections();
RESET ROLE;
DO $$ BEGIN
  IF (SELECT coalesce(sum(points),0) FROM public.user_point_ledger WHERE source='github_connected' AND user_id IN ('a6610000-0000-4000-8000-000000000001','a6610000-0000-4000-8000-000000000004'))<>50 THEN
    RAISE EXCEPTION 'B-10: GitHub identity rewarded more than once';
  END IF;
END $$;

ROLLBACK;
