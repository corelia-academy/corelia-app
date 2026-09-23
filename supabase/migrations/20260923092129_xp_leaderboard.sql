-- Read-only aggregate boundary. Individual award history stays private.
create function private.xp_leaderboard_v1(p_period text default 'week')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  viewer_id uuid := auth.uid();
  calculated_at timestamptz := statement_timestamp();
  week_start timestamptz := date_trunc('week', statement_timestamp() at time zone 'UTC') at time zone 'UTC';
  result jsonb;
begin
  if viewer_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  if p_period is null or p_period not in ('week', 'all_time') then
    raise exception 'INVALID_XP_PERIOD' using errcode = '22023';
  end if;

  with totals as materialized (
    select p.id, p.profile_public, p.role,
      coalesce(sum(l.points), 0)::bigint as total_xp,
      coalesce(sum(l.points) filter (where
        (case when l.reverses_id is not null then original.occurred_at else l.occurred_at end) >= week_start
        and (case when l.reverses_id is not null then original.occurred_at else l.occurred_at end) <= calculated_at
      ), 0)::bigint as week_xp
    from public.profiles p
    left join public.user_point_ledger l on l.user_id = p.id
    left join public.user_point_ledger original on original.id = l.reverses_id
    where (p.profile_public = true and p.role in ('student', 'instructor')) or p.id = viewer_id
    group by p.id
  ), scored as materialized (
    select t.*, case when p_period = 'week' then t.week_xp else t.total_xp end as period_xp
    from totals t
  ), ranked as materialized (
    select s.id, s.total_xp, s.period_xp, rank() over (order by s.period_xp desc) as position
    from scored s
    where s.profile_public = true and s.role in ('student', 'instructor') and s.period_xp > 0
  ), top_people as (
    select r.*, pp.username, pp.ocid, pp.full_name, pp.avatar_url, pp.avatar_seed
    from (select * from ranked order by period_xp desc, id limit 100) r
    join public.public_profiles pp on pp.id = r.id
  )
  select jsonb_build_object(
    'period', p_period,
    'calculated_at', calculated_at,
    'period_start', case when p_period = 'week' then week_start else null end,
    'period_end', case when p_period = 'week' then week_start + interval '7 days' else null end,
    'eligible_count', (select count(*) from ranked),
    'rows', coalesce((select jsonb_agg(to_jsonb(t) order by t.period_xp desc, t.id) from top_people t), '[]'::jsonb),
    'viewer', coalesce((
      select jsonb_build_object('position', r.position, 'total_xp', s.total_xp, 'period_xp', s.period_xp,
        'reason', case when s.role not in ('student','instructor') then 'ineligible_role'
          when s.profile_public is distinct from true then 'private_profile'
          when s.period_xp <= 0 then 'no_xp' else null end)
      from scored s left join ranked r on r.id = s.id where s.id = viewer_id
    ), jsonb_build_object('position', null, 'total_xp', null, 'period_xp', null, 'reason', 'missing_profile'))
  ) into result;
  return result;
end $$;
revoke all on function private.xp_leaderboard_v1(text) from public, anon, authenticated, service_role;
grant execute on function private.xp_leaderboard_v1(text) to authenticated;

create function public.xp_leaderboard_v1(p_period text default 'week')
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.xp_leaderboard_v1(p_period);
$$;
revoke all on function public.xp_leaderboard_v1(text) from public, anon, authenticated, service_role;
grant execute on function public.xp_leaderboard_v1(text) to authenticated;
