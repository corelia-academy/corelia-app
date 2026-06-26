-- Enable Supabase Realtime for credential_issuances
alter publication supabase_realtime add table public.credential_issuances;

-- Set replica identity to full to ensure payload.old is fully populated
alter table public.credential_issuances replica identity full;
