-- Allow the public applicant avatar row to fill wide cards and detail pages.
create or replace function private.list_public_hackathon_applicant_previews(p_hackathon_ids text[])
returns table (
  hackathon_id text,
  user_id uuid,
  username text,
  full_name text,
  avatar_seed uuid,
  avatar_config jsonb
)
language sql stable security definer set search_path = ''
as $$
  with requested as (
    select distinct btrim(id) as id
    from unnest(coalesce(p_hackathon_ids, array[]::text[])) as input(id)
    where nullif(btrim(id), '') is not null
    limit 20
  )
  select requested.id, applicant.user_id, applicant.username,
    applicant.full_name, applicant.avatar_seed, applicant.avatar_config
  from requested
  join public.hackathons h on h.id = requested.id
    and h.status in ('published', 'running', 'ended')
  cross join lateral (
    select r.user_id, p.username, p.full_name, p.avatar_seed, p.avatar_config
    from public.hackathon_registrations r
    join public.public_profiles p on p.id = r.user_id and p.profile_public = true
    where r.hackathon_id = requested.id
    order by r.user_id
    limit 48
  ) applicant
$$;
