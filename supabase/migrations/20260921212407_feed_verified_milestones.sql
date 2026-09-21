-- Verified achievements only. No user-authored feed content is accepted.
create table public.feed_share_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_courses boolean not null default true,
  share_xp boolean not null default true,
  share_projects boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.feed_milestones (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('course_completed','xp_reached','project_submitted')),
  source_key text not null,
  course_id text references public.courses(id) on delete cascade,
  hackathon_id text references public.hackathons(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  xp_total integer,
  created_at timestamptz not null default now(),
  unique (actor_id,kind,source_key),
  check (
    (kind='course_completed' and course_id is not null and hackathon_id is null and project_id is null and xp_total is null) or
    (kind='xp_reached' and xp_total is not null and xp_total>0 and course_id is null and hackathon_id is null and project_id is null) or
    (kind='project_submitted' and project_id is not null and hackathon_id is not null and course_id is null and xp_total is null)
  )
);
create index feed_milestones_time_idx on public.feed_milestones (created_at desc,id desc);
create index feed_milestones_actor_idx on public.feed_milestones (actor_id,created_at desc);
create table public.feed_milestone_likes (
  milestone_id bigint not null references public.feed_milestones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (milestone_id,user_id)
);
create table public.feed_hidden_milestones (
  milestone_id bigint not null references public.feed_milestones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (milestone_id,user_id)
);

create function private.feed_milestone_visible(p_id bigint,p_viewer uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare m public.feed_milestones%rowtype; pref public.feed_share_preferences%rowtype;
begin
  select * into m from public.feed_milestones where id=p_id;
  if not found then return false; end if;
  if not exists (select 1 from public.profiles p where p.id=m.actor_id and p.profile_public=true) then return false; end if;
  if exists (select 1 from public.feed_hidden_milestones h where h.milestone_id=m.id and h.user_id=m.actor_id) then return false; end if;
  select * into pref from public.feed_share_preferences where user_id=m.actor_id;
  if (m.kind='course_completed' and not coalesce(pref.share_courses,true)) or
     (m.kind='xp_reached' and not coalesce(pref.share_xp,true)) or
     (m.kind='project_submitted' and not coalesce(pref.share_projects,true)) then return false; end if;
  if m.kind='course_completed' then
    return exists(select 1 from public.courses c where c.id=m.course_id and c.published=true and c.archived_at is null)
       and exists(select 1 from public.enrollments e where e.user_id=m.actor_id and e.course_id=m.course_id and e.completed_at is not null);
  elsif m.kind='project_submitted' then
    return exists(select 1 from public.projects p where p.id=m.project_id and p.owner_id=m.actor_id and p.source_type='hackathon' and p.source_id=m.hackathon_id and p.visibility='public' and not coalesce(p.blocked,false))
       and exists(select 1 from public.hackathons h where h.id=m.hackathon_id and h.status in ('published','running','ended','winners_announced'))
       and exists(select 1 from public.hackathon_submissions s where s.user_id=m.actor_id and s.hackathon_id=m.hackathon_id and s.project_id=m.project_id);
  else
    return m.xp_total <= coalesce((select sum(l.points) from public.user_point_ledger l where l.user_id=m.actor_id),0);
  end if;
end $$;
revoke all on function private.feed_milestone_visible(bigint,uuid) from public,anon,authenticated;
grant execute on function private.feed_milestone_visible(bigint,uuid) to anon,authenticated;

create function private.feed_can_share(p_actor uuid,p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=p_actor and p.profile_public=true)
    and not exists(select 1 from public.feed_share_preferences f where f.user_id=p_actor and
      ((p_kind='course_completed' and not f.share_courses) or (p_kind='xp_reached' and not f.share_xp) or (p_kind='project_submitted' and not f.share_projects)))
$$;
revoke all on function private.feed_can_share(uuid,text) from public,anon,authenticated;

create function private.feed_on_course_completed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.completed_at is null or (tg_op='UPDATE' and old.completed_at is not null) or not private.feed_can_share(new.user_id,'course_completed') then return new; end if;
  if exists(select 1 from public.courses c where c.id=new.course_id and c.published=true and c.archived_at is null) then
    insert into public.feed_milestones(actor_id,kind,source_key,course_id,created_at)
    values(new.user_id,'course_completed',new.course_id,new.course_id,coalesce(new.completed_at,now()))
    on conflict(actor_id,kind,source_key) do nothing;
  end if;
  return new;
end $$;
create trigger feed_on_course_completed after insert or update of completed_at on public.enrollments
  for each row execute function private.feed_on_course_completed();
revoke all on function private.feed_on_course_completed() from public,anon,authenticated;

create function private.feed_on_project_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.project_id is null or (tg_op='UPDATE' and old.project_id is not null) or not private.feed_can_share(new.user_id,'project_submitted') then return new; end if;
  if exists(select 1 from public.projects p where p.id=new.project_id and p.owner_id=new.user_id and p.source_type='hackathon' and p.source_id=new.hackathon_id and p.visibility='public' and not coalesce(p.blocked,false))
    and exists(select 1 from public.hackathons h where h.id=new.hackathon_id and h.status in ('published','running')) then
    insert into public.feed_milestones(actor_id,kind,source_key,hackathon_id,project_id)
    values(new.user_id,'project_submitted',new.project_id::text,new.hackathon_id,new.project_id)
    on conflict(actor_id,kind,source_key) do nothing;
  end if;
  return new;
end $$;
create trigger feed_on_project_submitted after insert or update of project_id on public.hackathon_submissions
  for each row execute function private.feed_on_project_submitted();
revoke all on function private.feed_on_project_submitted() from public,anon,authenticated;

create function private.feed_on_xp_awarded()
returns trigger language plpgsql security definer set search_path = '' as $$
declare total_points bigint; previous_points bigint; milestone integer;
begin
  if new.points<=0 or new.source='correction' or not private.feed_can_share(new.user_id,'xp_reached') then return new; end if;
  select coalesce(sum(points),0) into total_points from public.user_point_ledger where user_id=new.user_id;
  previous_points:=total_points-new.points;
  select max(x) into milestone from unnest(array[250,500,1000,2500,5000,10000,25000,50000,100000]) x
  where x>previous_points and x<=total_points;
  if milestone is not null then
    insert into public.feed_milestones(actor_id,kind,source_key,xp_total,created_at)
    values(new.user_id,'xp_reached',milestone::text,milestone,coalesce(new.occurred_at,now()))
    on conflict(actor_id,kind,source_key) do nothing;
  end if;
  return new;
end $$;
create trigger feed_on_xp_awarded after insert on public.user_point_ledger
  for each row execute function private.feed_on_xp_awarded();
revoke all on function private.feed_on_xp_awarded() from public,anon,authenticated;

alter table public.feed_share_preferences enable row level security;
alter table public.feed_milestones enable row level security;
alter table public.feed_milestone_likes enable row level security;
alter table public.feed_hidden_milestones enable row level security;
revoke all on public.feed_share_preferences,public.feed_milestones,public.feed_milestone_likes,public.feed_hidden_milestones from public,anon,authenticated;
grant select,insert,update on public.feed_share_preferences to authenticated;
grant select on public.feed_milestones to anon,authenticated;
grant select on public.feed_milestone_likes to anon;
grant select,insert,delete on public.feed_milestone_likes,public.feed_hidden_milestones to authenticated;
create policy feed_preferences_select on public.feed_share_preferences for select to authenticated using (user_id=(select auth.uid()));
create policy feed_preferences_insert on public.feed_share_preferences for insert to authenticated with check (user_id=(select auth.uid()));
create policy feed_preferences_update on public.feed_share_preferences for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy feed_milestones_select on public.feed_milestones for select to anon,authenticated using (private.feed_milestone_visible(id,(select auth.uid())));
create policy feed_likes_select on public.feed_milestone_likes for select to anon,authenticated using (private.feed_milestone_visible(milestone_id,(select auth.uid())));
create policy feed_likes_insert on public.feed_milestone_likes for insert to authenticated with check (user_id=(select auth.uid()) and private.feed_milestone_visible(milestone_id,(select auth.uid())) and exists(select 1 from public.feed_milestones m where m.id=milestone_id and m.actor_id<>(select auth.uid())));
create policy feed_likes_delete on public.feed_milestone_likes for delete to authenticated using (user_id=(select auth.uid()));
create policy feed_hidden_select on public.feed_hidden_milestones for select to authenticated using (user_id=(select auth.uid()));
create policy feed_hidden_insert on public.feed_hidden_milestones for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.feed_milestones m where m.id=milestone_id and m.actor_id=(select auth.uid())));
create policy feed_hidden_delete on public.feed_hidden_milestones for delete to authenticated using (user_id=(select auth.uid()));

create function public.get_feed_milestones_v1(p_following boolean default false,p_cursor_at timestamptz default null,p_cursor_id bigint default null,p_limit integer default 20,p_actor_id uuid default null)
returns setof public.feed_milestones language sql stable security invoker set search_path = '' as $$
  select m.* from public.feed_milestones m
  where (p_cursor_at is null or (m.created_at,m.id)<(p_cursor_at,coalesce(p_cursor_id,0)))
    and (p_actor_id is null or m.actor_id=p_actor_id)
    and (not p_following or m.actor_id=auth.uid() or exists(select 1 from public.follows f where f.follower_id=auth.uid() and (f.muted_until is null or f.muted_until<now()) and
      ((f.subject_type='user' and f.subject_id=m.actor_id::text) or (f.subject_type='course' and f.subject_id=m.course_id) or (f.subject_type='project' and f.subject_id=m.project_id::text) or (f.subject_type='hackathon' and f.subject_id=m.hackathon_id))))
  order by m.created_at desc,m.id desc limit least(greatest(coalesce(p_limit,20),1),50)
$$;
revoke all on function public.get_feed_milestones_v1(boolean,timestamptz,bigint,integer,uuid) from public,anon;
grant execute on function public.get_feed_milestones_v1(boolean,timestamptz,bigint,integer,uuid) to anon,authenticated;

-- The feed sidebar reads only the signed-in user's followed public profiles.
-- Unlike the public profile preview, this also works when the viewer's own profile is private.
create function public.list_my_feed_following_profiles_v1(
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table(id uuid,username text,ocid text,full_name text,avatar_url text,followed_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select p.id,p.username,p.ocid,p.full_name,p.avatar_url,f.created_at
  from public.follows f
  join public.public_profiles p on p.id::text=f.subject_id
  where f.follower_id=auth.uid() and f.subject_type='user' and p.profile_public=true
    and (p_cursor_at is null or (f.created_at,p.id)<(p_cursor_at,coalesce(p_cursor_id,'00000000-0000-0000-0000-000000000000'::uuid)))
  order by f.created_at desc,p.id desc
  limit least(greatest(coalesce(p_limit,20),1),50)
$$;
revoke all on function public.list_my_feed_following_profiles_v1(timestamptz,uuid,integer) from public,anon;
grant execute on function public.list_my_feed_following_profiles_v1(timestamptz,uuid,integer) to authenticated;

-- Retire social activity producers, while keeping learning.* telemetry and reports.
drop trigger if exists trg_activity_enrollment_insert on public.enrollments;
drop trigger if exists trg_activity_course_completion on public.enrollments;
drop trigger if exists trg_activity_lesson_completion on public.lesson_progress;
drop trigger if exists trg_activity_hackathon_registration_insert on public.hackathon_registrations;
drop trigger if exists trg_activity_hackathon_submission_insert on public.hackathon_submissions;
drop trigger if exists trg_activity_hackathon_status_change on public.hackathons;
drop trigger if exists trg_activity_project_publish on public.projects;
drop trigger if exists trg_activity_project_collaborator_insert on public.project_collaborators;
drop trigger if exists trg_activity_credential_issuance on public.credential_issuances;
drop trigger if exists trg_activity_course_publish on public.courses;
drop trigger if exists trg_activity_course_section_insert on public.course_sections;
drop trigger if exists trg_activity_project_hearts_milestone on public.project_hearts;
drop trigger if exists trg_follows_emit_activity on public.follows;
drop trigger if exists trg_auto_follow_enrollment on public.enrollments;
drop trigger if exists trg_auto_follow_hackathon_registration on public.hackathon_registrations;
revoke select on public.activity_events from anon,authenticated;
revoke execute on function public.get_feed_v1(timestamptz,integer,text[]) from authenticated;
alter publication supabase_realtime add table public.feed_milestones;
