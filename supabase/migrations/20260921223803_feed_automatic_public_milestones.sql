-- Public profiles share verified milestones automatically. Remove per-type opt-outs
-- and hidden-card state now that the feed has no matching controls.
create function private.feed_actor_public(p_actor uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id=p_actor and p.profile_public=true)
$$;
revoke all on function private.feed_actor_public(uuid) from public,anon,authenticated;

create or replace function private.feed_milestone_visible(p_id bigint,p_viewer uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare m public.feed_milestones%rowtype;
begin
  select * into m from public.feed_milestones where id=p_id;
  if not found or not private.feed_actor_public(m.actor_id) then return false; end if;
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

create or replace function private.feed_on_course_completed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.completed_at is null or (tg_op='UPDATE' and old.completed_at is not null) or not private.feed_actor_public(new.user_id) then return new; end if;
  if exists(select 1 from public.courses c where c.id=new.course_id and c.published=true and c.archived_at is null) then
    insert into public.feed_milestones(actor_id,kind,source_key,course_id,created_at)
    values(new.user_id,'course_completed',new.course_id,new.course_id,coalesce(new.completed_at,now()))
    on conflict(actor_id,kind,source_key) do nothing;
  end if;
  return new;
end $$;

create or replace function private.feed_on_project_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.project_id is null or (tg_op='UPDATE' and old.project_id is not null) or not private.feed_actor_public(new.user_id) then return new; end if;
  if exists(select 1 from public.projects p where p.id=new.project_id and p.owner_id=new.user_id and p.source_type='hackathon' and p.source_id=new.hackathon_id and p.visibility='public' and not coalesce(p.blocked,false))
    and exists(select 1 from public.hackathons h where h.id=new.hackathon_id and h.status in ('published','running')) then
    insert into public.feed_milestones(actor_id,kind,source_key,hackathon_id,project_id)
    values(new.user_id,'project_submitted',new.project_id::text,new.hackathon_id,new.project_id)
    on conflict(actor_id,kind,source_key) do nothing;
  end if;
  return new;
end $$;

create or replace function private.feed_on_xp_awarded()
returns trigger language plpgsql security definer set search_path = '' as $$
declare total_points bigint; previous_points bigint; milestone integer;
begin
  if new.points<=0 or new.source='correction' or not private.feed_actor_public(new.user_id) then return new; end if;
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

drop function private.feed_can_share(uuid,text);
drop table public.feed_hidden_milestones;
drop table public.feed_share_preferences;
