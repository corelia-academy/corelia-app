begin;

create schema if not exists internal;
revoke all on schema internal from public;

create or replace function internal.sync_public_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.public_profiles (
    id,
    username,
    ocid,
    role,
    full_name,
    avatar_url,
    bio,
    website,
    instructor_origin,
    instructor_headline,
    instructor_bio,
    instructor_organization,
    instructor_website,
    profile_public,
    created_at,
    updated_at
  )
  values (
    new.id,
    nullif(new.username, ''),
    nullif(new.ocid, ''),
    coalesce(nullif(new.role, ''), 'student'),
    new.full_name,
    new.avatar_url,
    new.bio,
    new.website,
    new.instructor_origin,
    new.instructor_headline,
    new.instructor_bio,
    new.instructor_organization,
    new.instructor_website,
    coalesce(new.profile_public, true),
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update set
    username = excluded.username,
    ocid = excluded.ocid,
    role = excluded.role,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    bio = excluded.bio,
    website = excluded.website,
    instructor_origin = excluded.instructor_origin,
    instructor_headline = excluded.instructor_headline,
    instructor_bio = excluded.instructor_bio,
    instructor_organization = excluded.instructor_organization,
    instructor_website = excluded.instructor_website,
    profile_public = excluded.profile_public,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

create or replace function internal.delete_public_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.public_profiles where id = old.id;
  return old;
end;
$$;

drop trigger if exists sync_public_profile_on_profiles on public.profiles;
create trigger sync_public_profile_on_profiles
  after insert or update on public.profiles
  for each row
  execute function internal.sync_public_profile();

drop trigger if exists delete_public_profile_on_profiles on public.profiles;
create trigger delete_public_profile_on_profiles
  after delete on public.profiles
  for each row
  execute function internal.delete_public_profile();

revoke execute on function public.sync_public_profile() from anon, authenticated;
revoke execute on function public.delete_public_profile() from anon, authenticated;

drop function if exists public.sync_public_profile();
drop function if exists public.delete_public_profile();

commit;

