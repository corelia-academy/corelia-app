-- QA #663 follow-up: Security Advisor rejects a SECURITY DEFINER function in
-- public that authenticated can execute. Move the definer body to private and
-- keep public as an invoker wrapper, matching list_feed_xp_suggestions_v1.
create function private.list_my_feed_following_profiles_v1(
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table(id uuid,username text,ocid text,full_name text,avatar_url text,followed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id,p.username,p.ocid,p.full_name,p.avatar_url,f.created_at
  from public.follows f
  join public.public_profiles p on p.id::text=f.subject_id
  join public.profiles account on account.id=p.id
  where auth.uid() is not null
    and f.follower_id=auth.uid() and f.subject_type='user' and p.profile_public=true
    and account.role in ('student', 'instructor')
    and (p_cursor_at is null or (f.created_at,p.id)<(p_cursor_at,coalesce(p_cursor_id,'00000000-0000-0000-0000-000000000000'::uuid)))
  order by f.created_at desc,p.id desc
  limit least(greatest(coalesce(p_limit,20),1),50)
$$;

revoke all on function private.list_my_feed_following_profiles_v1(timestamptz,uuid,integer) from public, anon, authenticated, service_role;
grant execute on function private.list_my_feed_following_profiles_v1(timestamptz,uuid,integer) to authenticated;

create or replace function public.list_my_feed_following_profiles_v1(
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table(id uuid,username text,ocid text,full_name text,avatar_url text,followed_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from private.list_my_feed_following_profiles_v1(p_cursor_at,p_cursor_id,p_limit);
$$;

revoke all on function public.list_my_feed_following_profiles_v1(timestamptz,uuid,integer) from public, anon, authenticated, service_role;
grant execute on function public.list_my_feed_following_profiles_v1(timestamptz,uuid,integer) to authenticated;
