-- QA staging v0.15.0 — kịch bản XP quiz / instructor exclusion / wallet / OCID / GitHub.
-- Chạy trong SQL Editor của corelia-staging (opoozbmfbezkrpzxsusx). KHÔNG chạy trên Production.
-- Toàn bộ nằm trong một transaction và kết thúc bằng RAISE EXCEPTION nên tự rollback:
-- không để lại dữ liệu. Kết quả nằm trong thông báo lỗi "QA672_REPORT".
-- Dựa trên scripts/db/tests/qa661-xp-feed-wallet.integration.sql (fixture user a6720000-..., chỉ dùng cho test).
-- Mapping case: TC-XP-02 (quiz 0.7, retry), TC-XP-03 (instructor/co-instructor, unpublished/archived),
-- #664 (học viên chưa đăng ký), TC-WALLET-01/02/03, ví/OCID/GitHub không thưởng lại, khoá advisory của milestone (TC-EVENT-01, mức hàm).
-- Hộp thoại "Potential issue detected" của Supabase có thể hiện: chọn Run query.

CREATE TEMP TABLE r(ts timestamptz default clock_timestamp(), k text, v text);
GRANT ALL ON r TO authenticated, service_role;
INSERT INTO auth.users(id,email) VALUES
 ('a6720000-0000-4000-8000-000000000001','qa672-learner@corelia.local'),
 ('a6720000-0000-4000-8000-000000000002','qa672-instructor@corelia.local'),
 ('a6720000-0000-4000-8000-000000000003','qa672-coinstructor@corelia.local'),
 ('a6720000-0000-4000-8000-000000000004','qa672-other@corelia.local');
UPDATE public.profiles SET profile_public=true WHERE id='a6720000-0000-4000-8000-000000000001';
UPDATE public.profiles SET role='instructor' WHERE id IN ('a6720000-0000-4000-8000-000000000002','a6720000-0000-4000-8000-000000000003');
INSERT INTO public.courses(id,instructor_id,slug,published,archived_at,data) VALUES
 ('qa672-pub','a6720000-0000-4000-8000-000000000002','qa672-pub',true,NULL,'{"title":"QA672 pub","co_instructor_permissions":{"a6720000-0000-4000-8000-000000000003":["edit"]}}'),
 ('qa672-unpub','a6720000-0000-4000-8000-000000000002','qa672-unpub',false,NULL,'{"title":"QA672 unpub"}'),
 ('qa672-arch','a6720000-0000-4000-8000-000000000002','qa672-arch',true,now(),'{"title":"QA672 arch"}');
INSERT INTO public.course_sections(course_id,id,data) SELECT c,'s1','{"title":"S"}' FROM unnest(ARRAY['qa672-pub','qa672-unpub','qa672-arch']) c;
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) SELECT c,l,'s1',true,
  CASE WHEN l='q80' THEN '{"title":"Q80","lesson_format":"quiz","quiz_config":{"passing_ratio":0.8}}'::jsonb ELSE '{"title":"Q70","lesson_format":"quiz"}'::jsonb END
 FROM unnest(ARRAY['qa672-pub','qa672-unpub','qa672-arch']) c, unnest(ARRAY['q70','q80']) l WHERE NOT (c<>'qa672-pub' AND l='q80');
INSERT INTO public.course_section_questions(id,course_id,section_id,lesson_id,sort_order,data)
SELECT c||':'||l||'-'||n,c,NULL,l,n,'{"type":"mcq","question":"Q","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}'::jsonb
FROM unnest(ARRAY['qa672-pub','qa672-unpub','qa672-arch']) c, unnest(ARRAY['q70','q80']) l, generate_series(1,10) n WHERE NOT (c<>'qa672-pub' AND l='q80');
INSERT INTO public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at)
SELECT u||'_'||c,u::uuid,c,now(),now() FROM (VALUES
 ('a6720000-0000-4000-8000-000000000001','qa672-pub'),('a6720000-0000-4000-8000-000000000001','qa672-unpub'),('a6720000-0000-4000-8000-000000000001','qa672-arch'),
 ('a6720000-0000-4000-8000-000000000002','qa672-pub'),('a6720000-0000-4000-8000-000000000003','qa672-pub')) e(u,c);
CREATE FUNCTION pg_temp.answers(p_course text,p_lesson text,p_correct int) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_object_agg(p_course||':'||p_lesson||'-'||n, CASE WHEN n<=p_correct THEN 0 ELSE 1 END) FROM generate_series(1,10) n $$;
GRANT EXECUTE ON FUNCTION pg_temp.answers(text,text,int) TO authenticated;
CREATE FUNCTION pg_temp.sub(u uuid,c text,l text,k int) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.learning_quiz_submit(c,l,gen_random_uuid(),pg_temp.answers(c,l,k),0);
    INSERT INTO r(k,v) VALUES('submit '||c||'/'||l||' '||k||'/10 by u'||right(u::text,1),'ok');
  EXCEPTION WHEN others THEN
    INSERT INTO r(k,v) VALUES('submit '||c||'/'||l||' '||k||'/10 by u'||right(u::text,1),'ERR '||sqlerrm);
  END;
  RESET ROLE;
END $$;
-- TC-XP-02: học viên đã đăng ký, ngưỡng mặc định 0.7 (fail 6/10, đạt 7/10, nộp lại không cộng trùng); q80 7/10 phải trượt.
SELECT pg_temp.sub('a6720000-0000-4000-8000-000000000001','qa672-pub','q70',6);
SELECT pg_temp.sub('a6720000-0000-4000-8000-000000000001','qa672-pub','q80',7);
SELECT pg_temp.sub('a6720000-0000-4000-8000-000000000001','qa672-pub','q70',7);
SELECT pg_temp.sub('a6720000-0000-4000-8000-000000000001','qa672-pub','q70',7);
SELECT pg_temp.sub('a6720000-0000-4000-8000-000000000001','qa672-pub','q70',10);
-- TC-XP-03: giảng viên / đồng giảng viên không nhận XP; course unpublished / archived không nhận XP.
SELECT pg_temp.sub('a6720000-0000-4000-8000-000000000002','qa672-pub','q70',8);
SELECT pg_temp.sub('a6720000-0000-4000-8000-000000000003','qa672-pub','q70',8);
SELECT pg_temp.sub('a6720000-0000-4000-8000-000000000001','qa672-unpub','q70',8);
SELECT pg_temp.sub('a6720000-0000-4000-8000-000000000001','qa672-arch','q70',8);
-- #664: học viên chưa đăng ký đậu lần đầu (ghi nhận hành vi thực tế).
SELECT pg_temp.sub('a6720000-0000-4000-8000-000000000004','qa672-pub','q70',8);
INSERT INTO r(k,v) SELECT 'ledger u'||right(user_id::text,1)||' '||source_key, points::text FROM public.user_point_ledger WHERE user_id::text LIKE 'a6720000-%' AND source IN ('quiz_passed','lesson_completed','course_completed');
INSERT INTO r(k,v) SELECT 'enrollment u4 after submit', count(*)::text FROM public.enrollments WHERE user_id='a6720000-0000-4000-8000-000000000004';
-- TC-WALLET-01/02/03: thưởng lần đầu, relink, ví của tài khoản khác, challenge hết hạn / đã dùng, unlink bởi người không sở hữu.
INSERT INTO public.wallet_link_challenges(id,user_id,chain,address,message,expires_at) VALUES
 ('a6720000-0000-4000-8000-0000000000c1','a6720000-0000-4000-8000-000000000001','ethereum','0xqa672','m',now()+interval '5 minutes'),
 ('a6720000-0000-4000-8000-0000000000c2','a6720000-0000-4000-8000-000000000001','ethereum','0xqa672','m',now()+interval '5 minutes'),
 ('a6720000-0000-4000-8000-0000000000c3','a6720000-0000-4000-8000-000000000004','ethereum','0xqa672','m',now()+interval '5 minutes'),
 ('a6720000-0000-4000-8000-0000000000c4','a6720000-0000-4000-8000-000000000001','ethereum','0xqa672-old','m',now()-interval '1 minute');
SET LOCAL ROLE service_role;
DO $$ DECLARE x jsonb; BEGIN
  x:=public.xp_consume_wallet_challenge('a6720000-0000-4000-8000-0000000000c1','a6720000-0000-4000-8000-000000000001'); INSERT INTO r(k,v) VALUES('wallet first link u1',x::text);
  x:=public.xp_consume_wallet_challenge('a6720000-0000-4000-8000-0000000000c2','a6720000-0000-4000-8000-000000000001'); INSERT INTO r(k,v) VALUES('wallet own re-link u1',x::text);
  x:=public.xp_consume_wallet_challenge('a6720000-0000-4000-8000-0000000000c3','a6720000-0000-4000-8000-000000000004'); INSERT INTO r(k,v) VALUES('wallet foreign address u4',x::text);
  x:=public.xp_consume_wallet_challenge('a6720000-0000-4000-8000-0000000000c4','a6720000-0000-4000-8000-000000000001'); INSERT INTO r(k,v) VALUES('wallet expired challenge u1',x::text);
  x:=public.xp_consume_wallet_challenge('a6720000-0000-4000-8000-0000000000c1','a6720000-0000-4000-8000-000000000001'); INSERT INTO r(k,v) VALUES('wallet replay used challenge u1',x::text);
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a6720000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN INSERT INTO r(k,v) VALUES('unlink by non-owner u4',public.xp_unlink_wallet('ethereum','0xqa672')::text); END $$;
RESET ROLE;
INSERT INTO r(k,v) SELECT 'wallet still owned by u1 after non-owner unlink', count(*)::text FROM public.connected_wallets WHERE address='0xqa672' AND user_id='a6720000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claim.sub','a6720000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN INSERT INTO r(k,v) VALUES('unlink by owner u1',public.xp_unlink_wallet('ethereum','0xqa672')::text); END $$;
RESET ROLE;
INSERT INTO r(k,v) SELECT 'wallet rows after owner unlink', count(*)::text FROM public.connected_wallets WHERE address='0xqa672';
INSERT INTO public.wallet_link_challenges(id,user_id,chain,address,message,expires_at) VALUES
 ('a6720000-0000-4000-8000-0000000000c5','a6720000-0000-4000-8000-000000000004','ethereum','0xqa672','m',now()+interval '5 minutes'),
 ('a6720000-0000-4000-8000-0000000000c6','a6720000-0000-4000-8000-000000000001','ethereum','0xqa672','m',now()+interval '5 minutes');
SET LOCAL ROLE service_role;
DO $$ DECLARE x jsonb; BEGIN
  x:=public.xp_consume_wallet_challenge('a6720000-0000-4000-8000-0000000000c5','a6720000-0000-4000-8000-000000000004'); INSERT INTO r(k,v) VALUES('wallet moved to u4 after unlink',x::text);
  x:=public.xp_consume_wallet_challenge('a6720000-0000-4000-8000-0000000000c6','a6720000-0000-4000-8000-000000000001'); INSERT INTO r(k,v) VALUES('previous owner u1 re-link',x::text);
END $$;
RESET ROLE;
INSERT INTO r(k,v) SELECT 'ethereum_wallet xp u'||right(user_id::text,1), sum(points)::text FROM public.user_point_ledger WHERE user_id::text LIKE 'a6720000-%' AND source='ethereum_wallet' GROUP BY user_id;
-- OCID / GitHub: một danh tính chỉ thưởng một lần, kể cả qua sync.
SET LOCAL ROLE service_role;
DO $$ BEGIN INSERT INTO r(k,v) VALUES('ocid first link u1 rewarded',public.xp_link_verified_ocid('a6720000-0000-4000-8000-000000000001','qa672-ocid',NULL)::text); END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a6720000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.xp_unlink_ocid();
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN INSERT INTO r(k,v) VALUES('ocid same identity on u4 rewarded',public.xp_link_verified_ocid('a6720000-0000-4000-8000-000000000004','qa672-ocid',NULL)::text); END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a6720000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT public.xp_sync_connections();
RESET ROLE;
INSERT INTO auth.identities(provider_id,user_id,identity_data,provider) VALUES('qa672-gh','a6720000-0000-4000-8000-000000000001','{"sub":"qa672-gh"}','github');
SELECT set_config('request.jwt.claim.sub','a6720000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.xp_sync_connections();
RESET ROLE;
UPDATE auth.identities SET user_id='a6720000-0000-4000-8000-000000000004' WHERE provider_id='qa672-gh';
SELECT set_config('request.jwt.claim.sub','a6720000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT public.xp_sync_connections();
RESET ROLE;
INSERT INTO r(k,v) SELECT 'ocid/github xp u'||right(user_id::text,1)||' '||source, sum(points)::text FROM public.user_point_ledger WHERE user_id::text LIKE 'a6720000-%' AND source IN ('ocid_connected','github_connected') GROUP BY user_id,source;
INSERT INTO r(k,v) VALUES('feed_on_xp_awarded has advisory lock', (pg_get_functiondef('private.feed_on_xp_awarded()'::regprocedure) LIKE '%pg_advisory_xact_lock%')::text);
-- Ghi chú: lần chạy 2026-10-11 bản đầu lỗi trùng khoá `q70-1` (id câu hỏi dùng chung giữa các course); đã sửa id thành course:lesson-n. Chưa chạy lại bản sửa.
-- Kết thúc: lỗi cố ý để rollback toàn bộ; đọc báo cáo trong thông báo lỗi.
DO $$ BEGIN RAISE EXCEPTION E'QA672_REPORT\n%', (SELECT string_agg(k||' => '||v, E'\n' ORDER BY ts) FROM r); END $$;

-- Kỳ vọng (theo trigger xp_quiz_passed / feed_on_xp_awarded và test qa661):
--   u1 q70 6/10: không XP; q80 7/10: không XP; q70 7/10: quiz_passed +20 và lesson_completed +10; nộp lại: không thêm.
--   u2 (giảng viên), u3 (đồng giảng viên), unpublished, archived: không XP.
--   u4 chưa đăng ký (#664): theo bug đang OPEN, dự kiến không có XP — ghi nhận thực tế.
--   wallet: first link linked=true awarded=true; own re-link awarded=false; ví của u4 -> wallet_taken; challenge hết hạn -> challenge_expired;
--           replay -> bị từ chối; non-owner unlink=false; owner unlink=true; ví chuyển sang u4 không thưởng lại; ethereum_wallet XP tổng 30 ở u1, 0 ở u4.
--   OCID/GitHub: tổng thưởng đúng một lần giữa các tài khoản.
