-- Suggest public, unfollowed profiles from the highest-XP pool, then vary the
-- small preview within that pool. The client never reads the private ledger.
create function private.list_feed_xp_suggestions_v1(p_limit integer default 4)
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
revoke all on function private.list_feed_xp_suggestions_v1(integer) from public, anon, authenticated, service_role;
grant execute on function private.list_feed_xp_suggestions_v1(integer) to authenticated;

create function public.list_feed_xp_suggestions_v1(p_limit integer default 4)
returns table (
  id uuid,
  username text,
  ocid text,
  full_name text,
  avatar_url text,
  avatar_seed uuid,
  total_xp bigint
)
language sql volatile security invoker set search_path = '' as $$
  select * from private.list_feed_xp_suggestions_v1(p_limit);
$$;
revoke all on function public.list_feed_xp_suggestions_v1(integer) from public, anon, authenticated, service_role;
grant execute on function public.list_feed_xp_suggestions_v1(integer) to authenticated;
