-- Run against isolated local Supabase only. Fixture changes are rolled back.
begin;
create temp table feed_fixture (key text primary key, value text);
grant select,insert on feed_fixture to authenticated;
do $$
declare suffix text:=substr(md5(random()::text),1,8); actor uuid:=gen_random_uuid(); viewer uuid:=gen_random_uuid(); instructor uuid:=gen_random_uuid(); project uuid; course text:='milestone-course-'||suffix; hackathon text:='milestone-hackathon-'||suffix;
begin
  insert into feed_fixture values ('actor',actor::text),('viewer',viewer::text),('course',course),('hackathon',hackathon);
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
    (actor,'authenticated','authenticated','milestone-actor-'||suffix||'@example.test','',now(),now(),now()),
    (viewer,'authenticated','authenticated','milestone-viewer-'||suffix||'@example.test','',now(),now(),now()),
    (instructor,'authenticated','authenticated','milestone-instructor-'||suffix||'@example.test','',now(),now(),now());
  insert into public.profiles(id,role,email,username,full_name,profile_public) values
    (actor,'student','milestone-actor-'||suffix||'@example.test','milestone-actor-'||suffix,'Milestone Actor',true),
    (viewer,'student','milestone-viewer-'||suffix||'@example.test','milestone-viewer-'||suffix,'Milestone Viewer',true),
    (instructor,'instructor','milestone-instructor-'||suffix||'@example.test','milestone-instructor-'||suffix,'Milestone Instructor',true)
  on conflict(id) do update set profile_public=true;
  insert into public.courses(id,instructor_id,published,slug,data) values(course,instructor,true,course,jsonb_build_object('title','Milestone Course'));
  insert into public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at) values('milestone-enrollment-'||suffix,actor,course,now(),now());
  insert into public.course_sections(course_id,id,sort_order,data) values(course,'intro',1,'{"title":"Intro"}');
  insert into public.course_lessons(course_id,id,section_id,sort_order,published,data) values(course,'lesson-1','intro',1,true,'{"title":"Lesson","lesson_format":"article","description_markdown":"Verified lesson content."}');
  insert into public.lesson_progress(id,user_id,course_id,lesson_id,completed_at,watch_seconds) values('milestone-progress-'||suffix,actor,course,'lesson-1',now(),120);
  update public.enrollments set completed_at=now() where user_id=actor and course_id=course and completed_at is null;
  insert into public.hackathons(id,status,document) values(hackathon,'published',jsonb_build_object('title','Milestone Hackathon','slug',hackathon,'created_by',instructor::text,'tracks',jsonb_build_array(jsonb_build_object('id','main','name','Main')),'sectors',jsonb_build_array(jsonb_build_object('id','software','name','Software')),'tech_stacks',jsonb_build_array(jsonb_build_object('id','react','name','React'))));
  insert into public.hackathon_registrations(id,hackathon_id,user_id,document) values('milestone-registration-'||suffix,hackathon,actor,'{"status":"registered"}');
  insert into public.projects(slug,owner_id,title,summary,visibility,source_type,source_id,source_submission_id,hackathon_track_ids,hackathon_sector_ids,hackathon_tech_stack_ids)
  values('milestone-project-'||suffix,actor,'Milestone Project','A verified project.','public','hackathon',hackathon,'milestone-submission-'||suffix,array['main'],array['software'],array['react']) returning id into project;
  insert into feed_fixture values('project',project::text);
  insert into public.hackathon_submissions(id,hackathon_id,user_id,project_id,document)
  values('milestone-submission-'||suffix,hackathon,actor,project,'{}');
  -- Use the trusted XP award helper to exercise the ledger trigger.
  perform private.xp_award(actor,'lesson_completed','milestone-fixture-xp:'||suffix,300,'lesson','fixture',now());
end $$;
update public.feed_milestones set created_at='2026-09-21 00:00:00+00' where actor_id=(select value::uuid from feed_fixture where key='actor');
do $$ begin
  if exists(select 1 from pg_trigger where not tgisinternal and tgname like 'trg_activity_%') then raise exception 'legacy social activity trigger remains'; end if;
  if has_table_privilege('authenticated','public.feed_milestones','INSERT') or has_table_privilege('authenticated','public.feed_milestones','UPDATE') then raise exception 'browser can forge milestone'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select value from feed_fixture where key='viewer'),true);
do $$ begin
  if (select count(*) from public.get_feed_milestones_v1())<>3 then raise exception 'expected three verified milestone cards'; end if;
  if has_table_privilege('authenticated','public.activity_events','SELECT') then raise exception 'legacy social events remain readable'; end if;
  if (select count(distinct id) from public.get_feed_milestones_v1(false,null,null,1))<>1 then raise exception 'first page invalid'; end if;
  if (select count(*) from (select id from public.get_feed_milestones_v1(false,null,null,1) union select id from public.get_feed_milestones_v1(false,'2026-09-21 00:00:00+00',(select max(id) from public.feed_milestones),2)) x)<>3 then raise exception 'same-timestamp pagination lost a row'; end if;
end $$;
insert into public.feed_milestone_likes(milestone_id,user_id)
select id,(select value::uuid from feed_fixture where key='viewer') from public.get_feed_milestones_v1() limit 1;
do $$ begin
  if (select count(*) from public.feed_milestone_likes where user_id=(select value::uuid from feed_fixture where key='viewer'))<>1 then raise exception 'like not stored'; end if;
end $$;
insert into public.follows(follower_id,subject_type,subject_id)
values((select value::uuid from feed_fixture where key='viewer'),'user',(select value from feed_fixture where key='actor'));
do $$ begin
  if (select count(*) from public.get_feed_milestones_v1(true))<>3 then raise exception 'following feed incorrect'; end if;
end $$;
reset role;
update public.profiles set profile_public=false where id=(select value::uuid from feed_fixture where key='viewer');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select value from feed_fixture where key='viewer'),true);
do $$ begin
  if (select count(*) from public.list_my_feed_following_profiles_v1())<>1 then raise exception 'private viewer lost own following list'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select value from feed_fixture where key='actor'),true);
do $$ begin
  if exists(select 1 from public.list_my_feed_following_profiles_v1()) then raise exception 'another user following list leaked'; end if;
end $$;
do $$ begin
  begin
    insert into public.feed_milestone_likes(milestone_id,user_id)
    select id,(select value::uuid from feed_fixture where key='actor') from public.get_feed_milestones_v1() limit 1;
    raise exception 'self-like unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
update public.profiles set profile_public=false where id=(select value::uuid from feed_fixture where key='actor');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select value from feed_fixture where key='viewer'),true);
do $$ begin
  if exists(select 1 from public.get_feed_milestones_v1()) then raise exception 'private actor milestones leaked'; end if;
end $$;
reset role;
update public.profiles set profile_public=true where id=(select value::uuid from feed_fixture where key='actor');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select value from feed_fixture where key='viewer'),true);
do $$ begin
  if (select count(*) from public.get_feed_milestones_v1())<>3 then raise exception 'public actor milestones not restored'; end if;
end $$;
reset role;
update public.projects set visibility='private' where id=(select value::uuid from feed_fixture where key='project');
set local role authenticated;
select set_config('request.jwt.claim.sub',(select value from feed_fixture where key='viewer'),true);
do $$ begin
  if exists(select 1 from public.get_feed_milestones_v1() where kind='project_submitted') then raise exception 'private project milestone leaked'; end if;
end $$;
select 'feed milestone smoke passed' as result;
rollback;
