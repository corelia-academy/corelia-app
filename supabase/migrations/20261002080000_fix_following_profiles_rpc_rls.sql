-- QA #661: list_my_feed_following_profiles_v1 returned no rows because the
-- security invoker join on public.profiles is filtered by profiles RLS.
-- Run as definer; rows stay scoped to auth.uid() follows of public student/instructor profiles.
create or replace function public.list_my_feed_following_profiles_v1(
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

revoke all on function public.list_my_feed_following_profiles_v1(timestamptz,uuid,integer) from public,anon;
grant execute on function public.list_my_feed_following_profiles_v1(timestamptz,uuid,integer) to authenticated;
