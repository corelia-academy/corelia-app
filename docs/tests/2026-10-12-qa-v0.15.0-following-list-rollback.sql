-- QA staging v0.15.0 — #671: danh sách "People you follow" chỉ gồm hồ sơ công khai của học viên/giảng viên.
-- Chạy trong SQL Editor của corelia-staging (opoozbmfbezkrpzxsusx). KHÔNG chạy trên Production.
-- Một transaction, kết thúc bằng RAISE EXCEPTION nên tự rollback; kết quả nằm trong thông báo lỗi REPORT.
-- Fixture a6740000-... : 1 người xem (student) theo dõi 6 tài khoản: student công khai, student riêng tư, instructor công khai,
-- support_staff công khai, admin công khai, và một id không có hồ sơ. Kỳ vọng: chỉ student công khai + instructor công khai.

CREATE TEMP TABLE r(ts timestamptz default clock_timestamp(), k text, v text);
GRANT ALL ON r TO authenticated;
INSERT INTO auth.users(id,email) VALUES
 ('a6740000-0000-4000-8000-000000000001','qa674-viewer@corelia.local'),
 ('a6740000-0000-4000-8000-000000000002','qa674-pub-student@corelia.local'),
 ('a6740000-0000-4000-8000-000000000003','qa674-priv-student@corelia.local'),
 ('a6740000-0000-4000-8000-000000000004','qa674-pub-instructor@corelia.local'),
 ('a6740000-0000-4000-8000-000000000005','qa674-pub-support@corelia.local'),
 ('a6740000-0000-4000-8000-000000000006','qa674-pub-admin@corelia.local');
UPDATE public.profiles SET profile_public=true WHERE id IN
 ('a6740000-0000-4000-8000-000000000002','a6740000-0000-4000-8000-000000000004','a6740000-0000-4000-8000-000000000005','a6740000-0000-4000-8000-000000000006');
UPDATE public.profiles SET profile_public=false WHERE id='a6740000-0000-4000-8000-000000000003';
UPDATE public.profiles SET role='instructor' WHERE id='a6740000-0000-4000-8000-000000000004';
UPDATE public.profiles SET role='support_staff' WHERE id='a6740000-0000-4000-8000-000000000005';
UPDATE public.profiles SET role='admin' WHERE id='a6740000-0000-4000-8000-000000000006';
INSERT INTO r(k,v) SELECT 'fixture '||right(id::text,1), role||' public='||profile_public FROM public.profiles WHERE id::text LIKE 'a6740000-%' ORDER BY id;
INSERT INTO public.follows(follower_id,subject_type,subject_id)
SELECT 'a6740000-0000-4000-8000-000000000001','user',id::text FROM public.profiles WHERE id::text LIKE 'a6740000-%' AND id<>'a6740000-0000-4000-8000-000000000001';
INSERT INTO public.follows(follower_id,subject_type,subject_id) VALUES
 ('a6740000-0000-4000-8000-000000000001','user','a6740000-0000-4000-8000-0000000000ff');
SELECT set_config('request.jwt.claim.sub','a6740000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE x record; n int := 0; BEGIN
  FOR x IN SELECT * FROM public.list_my_feed_following_profiles_v1(NULL,NULL,50) LOOP
    n := n + 1; INSERT INTO r(k,v) VALUES('rpc row '||n,'u'||right(x.id::text,1)||' '||coalesce(x.full_name,''));
  END LOOP;
  INSERT INTO r(k,v) VALUES('rpc total rows',n::text);
END $$;
RESET ROLE;
DO $$ BEGIN RAISE EXCEPTION E'REPORT\n%', (SELECT string_agg(k||' => '||v, E'\n' ORDER BY ts) FROM r); END $$;
