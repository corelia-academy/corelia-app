do $$
begin
  -- Ensure supabase_realtime publication exists
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  -- Add table to publication if not already present
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    where p.pubname = 'supabase_realtime' and c.relname = 'credential_issuances'
  ) then
    alter publication supabase_realtime add table public.credential_issuances;
  end if;
end $$;

-- Set replica identity to full to ensure payload.old is fully populated
alter table public.credential_issuances replica identity full;
