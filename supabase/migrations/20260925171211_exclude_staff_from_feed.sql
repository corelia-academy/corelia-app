-- Feed participants match the XP leaderboard: public learners and instructors.
-- This also hides previously recorded staff milestones through the existing RLS
-- visibility function and prevents new staff milestones from being produced.
create or replace function private.feed_actor_public(p_actor uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.profiles p
    where p.id = p_actor and p.profile_public = true
      and p.role in ('student', 'instructor')
  )
$$;

create or replace function private.list_feed_xp_suggestions_v1(p_limit integer default 4)
returns table (
  id uuid,
  username text,
  ocid text,
  full_name text,
  avatar_url text,
  avatar_seed uuid,
  total_xp bigint
)
language plpgsql volatile security definer set search_path = '' as $$
declare viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  return query
  with ranked as materialized (
    select pp.id, pp.username, pp.ocid, pp.full_name, pp.avatar_url,
      pp.avatar_seed,
      coalesce((select sum(l.points) from public.user_point_ledger l
        where l.user_id = pp.id), 0)::bigint as total_xp
    from public.public_profiles pp
    join public.profiles p on p.id = pp.id
    where pp.profile_public = true and p.profile_public = true
      and p.role in ('student', 'instructor')
      and pp.id <> viewer_id
      and (nullif(btrim(pp.username), '') is not null
        or nullif(btrim(pp.ocid), '') is not null
        or nullif(btrim(pp.full_name), '') is not null)
      and not exists (
        select 1 from public.follows f
        where f.follower_id = viewer_id and f.subject_type = 'user'
          and f.subject_id = pp.id::text
      )
    order by 7 desc, pp.id
    limit 20
  )
  select ranked.id, ranked.username, ranked.ocid, ranked.full_name,
    ranked.avatar_url, ranked.avatar_seed, ranked.total_xp
  from ranked
  order by (ranked.total_xp >= 250) desc, (ranked.total_xp > 0) desc, random()
  limit least(greatest(coalesce(p_limit, 4), 1), 8);
end $$;

create or replace function public.list_my_feed_following_profiles_v1(
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table(id uuid,username text,ocid text,full_name text,avatar_url text,followed_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select p.id,p.username,p.ocid,p.full_name,p.avatar_url,f.created_at
  from public.follows f
  join public.public_profiles p on p.id::text=f.subject_id
  join public.profiles account on account.id=p.id
  where f.follower_id=auth.uid() and f.subject_type='user' and p.profile_public=true
    and account.role in ('student', 'instructor')
    and (p_cursor_at is null or (f.created_at,p.id)<(p_cursor_at,coalesce(p_cursor_id,'00000000-0000-0000-0000-000000000000'::uuid)))
  order by f.created_at desc,p.id desc
  limit least(greatest(coalesce(p_limit,20),1),50)
$$;
