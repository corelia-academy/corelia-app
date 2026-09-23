-- Keep v1 intact for profile activity and older frontend artifacts.
create function public.get_feed_milestones_v2(
  p_mode text default 'explore',
  p_cursor_at timestamptz default null,
  p_cursor_id bigint default null,
  p_limit integer default 20
)
returns setof public.feed_milestones
language plpgsql stable security invoker set search_path = '' as $$
declare viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_mode is null or p_mode not in ('explore', 'following') then
    raise exception 'INVALID_FEED_MODE' using errcode = '22023';
  end if;

  return query
  select m.* from public.feed_milestones m
  where m.actor_id <> viewer_id
    and (p_cursor_at is null or (m.created_at, m.id) < (p_cursor_at, coalesce(p_cursor_id, 0)))
    and (
      (p_mode = 'explore' and not exists (
        select 1 from public.follows f
        where f.follower_id = viewer_id and f.subject_type = 'user'
          and f.subject_id = m.actor_id::text
      ))
      or (p_mode = 'following' and exists (
        select 1 from public.follows f
        where f.follower_id = viewer_id and f.subject_type = 'user'
          and f.subject_id = m.actor_id::text
          and (f.muted_until is null or f.muted_until <= now())
      ))
    )
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end $$;
revoke all on function public.get_feed_milestones_v2(text,timestamptz,bigint,integer) from public, anon;
grant execute on function public.get_feed_milestones_v2(text,timestamptz,bigint,integer) to authenticated;
