begin;

-- Import pgTAP
create extension if not exists pgtap;

-- Plan 1 test
select plan(1);

-- Insert a mock published hackathon
insert into public.hackathons (id, status, document)
values ('00000000-0000-0000-0000-000000000001', 'published', '{"created_by": "creator-uid"}'::jsonb);

-- Insert a mock score
insert into public.hackathon_scores (id, hackathon_id, document)
values ('score-1', '00000000-0000-0000-0000-000000000001', '{}'::jsonb);

-- Set role to authenticated
set local role authenticated;
-- Mock a regular user
select set_config('request.jwt.claims', '{"sub": "regular-user-uid", "role": "authenticated"}', true);

-- Verify that the regular user cannot see any scores
select is_empty(
    'select * from public.hackathon_scores where hackathon_id = ''00000000-0000-0000-0000-000000000001''',
    'Authenticated regular user should not see raw scores even if hackathon is published'
);

-- Finish tests
select * from finish();

rollback;
