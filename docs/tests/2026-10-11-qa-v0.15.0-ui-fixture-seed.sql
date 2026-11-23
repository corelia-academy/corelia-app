-- Fixture UI cho TC-XP-02/03, #664, TC-WALLET-01 trên corelia-staging (opoozbmfbezkrpzxsusx). KHÔNG chạy trên Production.
-- 4 user không có mật khẩu: m tự đặt trong Supabase Dashboard > Authentication > Users > (user) > Update user > Password.
--   x1 = học viên đã đăng ký (public)       x2 = học viên CHƯA đăng ký (#664)
--   x3 = giảng viên chủ course             x4 = đồng giảng viên
-- Course: qa673-pub (published, quiz 10 câu, ngưỡng mặc định 0.7; correct_index = 0 => chọn "A"), qa673-unpub, qa673-arch.
-- Dọn bằng 2026-10-11-qa-v0.15.0-ui-fixture-cleanup.sql.

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', ('a6730000-0000-4000-8000-00000000000'||n)::uuid, 'authenticated','authenticated','qa-temp-v014-x'||n||'@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb, ('{"full_name":"QA Temp X'||n||'"}')::jsonb, now(), now() from generate_series(1,4) n;
update public.profiles p set username='qa-temp-v014-x'||substr(p.email,15,1), full_name='QA Temp X'||substr(p.email,15,1), profile_public=true, onboarding_completed=true,
  role=case when substr(p.email,15,1) in ('3','4') then 'instructor' else p.role end
where p.email like 'qa-temp-v014-x_@example.invalid';
insert into public.courses(id,instructor_id,slug,published,archived_at,data) values
 ('qa673-pub','a6730000-0000-4000-8000-000000000003','qa673-pub',true,NULL,'{"title":"QA Temp Quiz 0.7","co_instructor_permissions":{"a6730000-0000-4000-8000-000000000004":["edit"]}}'),
 ('qa673-unpub','a6730000-0000-4000-8000-000000000003','qa673-unpub',false,NULL,'{"title":"QA Temp Unpublished"}'),
 ('qa673-arch','a6730000-0000-4000-8000-000000000003','qa673-arch',true,now(),'{"title":"QA Temp Archived"}');
insert into public.course_sections(course_id,id,data) select c,'s1','{"title":"S"}' from unnest(array['qa673-pub','qa673-unpub','qa673-arch']) c;
insert into public.course_lessons(course_id,id,section_id,published,data) select c,'q70','s1',true,'{"title":"Quiz 70","lesson_format":"quiz"}'::jsonb from unnest(array['qa673-pub','qa673-unpub','qa673-arch']) c;
insert into public.course_section_questions(id,course_id,section_id,lesson_id,sort_order,data)
select c||':q70-'||n,c,NULL,'q70',n,('{"type":"mcq","question":"Q'||n||': chọn A","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}')::jsonb
from unnest(array['qa673-pub','qa673-unpub','qa673-arch']) c, generate_series(1,10) n;
insert into public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at)
select u||'_'||c,u::uuid,c,now(),now() from (values
 ('a6730000-0000-4000-8000-000000000001','qa673-pub'),('a6730000-0000-4000-8000-000000000001','qa673-unpub'),('a6730000-0000-4000-8000-000000000001','qa673-arch'),
 ('a6730000-0000-4000-8000-000000000003','qa673-pub'),('a6730000-0000-4000-8000-000000000004','qa673-pub')) e(u,c);
select 'U' k, email||' '||role v from public.profiles where email like 'qa-temp-v014-x_@example.invalid'
union all select 'C', id||' pub='||published||' arch='||(archived_at is not null) from public.courses where id like 'qa673-%'
union all select 'E', count(*)::text from public.enrollments where user_id::text like 'a6730000-%' order by 1,2;
