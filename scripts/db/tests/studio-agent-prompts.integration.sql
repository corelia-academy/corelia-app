BEGIN;

DO $$
DECLARE pinned_count integer;
BEGIN
  SELECT count(*) INTO pinned_count
  FROM (VALUES
    ('a1-catalog-research',7,'A1'),
    ('a2-brief',9,'A2'),
    ('a2-research',13,'A2'),
    ('a3-curriculum',19,'A3'),
    ('a4-curriculum-review',17,'A4'),
    ('a5-lesson',20,'A5'),
    ('a6-lesson-review',18,'A6')
  ) expected(prompt_key,version,agent_role)
  JOIN public.studio_agent_prompts actual USING (prompt_key,version,agent_role);
  IF pinned_count <> 7 THEN
    RAISE EXCEPTION 'Expected 7 pinned Studio prompt rows; found %', pinned_count;
  END IF;
  IF has_table_privilege('anon','public.studio_agent_prompts','SELECT') THEN
    RAISE EXCEPTION 'anon has direct SELECT privilege on studio_agent_prompts';
  END IF;
  IF has_table_privilege('service_role','public.studio_agent_prompts','INSERT')
     OR has_table_privilege('service_role','public.studio_agent_prompts','UPDATE')
     OR has_table_privilege('service_role','public.studio_agent_prompts','DELETE')
     OR has_table_privilege('service_role','public.studio_agent_prompts','TRUNCATE') THEN
    RAISE EXCEPTION 'service_role has a mutation privilege on studio_agent_prompts';
  END IF;
END $$;

-- anon has no SELECT grant, so even a prompt-key probe is denied.
SET LOCAL ROLE anon;
DO $$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM 1 FROM public.studio_agent_prompts LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'anon could read studio_agent_prompts'; END IF;
END $$;
RESET ROLE;

-- Record expected prompt count using postgres role before testing restricted roles.
SELECT set_config('test.expected_prompts', count(*)::text, true) FROM public.studio_agent_prompts;

-- An authenticated user with no admin profile can query but RLS returns no rows.
SELECT set_config('request.jwt.claim.sub','eeee5555-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.studio_agent_prompts;
  IF visible_count <> 0 THEN RAISE EXCEPTION 'non-admin authenticated user read % prompts', visible_count; END IF;
END $$;
RESET ROLE;

-- A real auth user whose profile is admin can read all seeded prompts.
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','',true);
INSERT INTO auth.users(id,email,instance_id,aud,role,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change)
VALUES('eeee5555-0000-4000-8000-000000000001','studio-prompts-test@corelia.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),'','','','');
UPDATE public.profiles SET role='admin' WHERE id='eeee5555-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claim.sub','eeee5555-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  visible_count integer;
  expected_count integer := current_setting('test.expected_prompts')::integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.studio_agent_prompts;
  IF visible_count <> expected_count THEN RAISE EXCEPTION 'admin read % prompts, expected %', visible_count, expected_count; END IF;
END $$;
RESET ROLE;

-- service_role can read prompts but is not granted writes. RLS bypass does not disable triggers.
SET LOCAL ROLE service_role;
DO $$
DECLARE
  visible_count integer;
  expected_count integer := current_setting('test.expected_prompts')::integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.studio_agent_prompts;
  IF visible_count <> expected_count THEN RAISE EXCEPTION 'service_role read % prompts, expected %', visible_count, expected_count; END IF;
END $$;
RESET ROLE;

-- Exercise numeric ordering without mutating any durable seed row.
INSERT INTO public.studio_agent_prompts(prompt_key,version,agent_role,system_prompt)
VALUES('__numeric-version-test',9,'A2','v9'),('__numeric-version-test',10,'A2','v10');
DO $$
DECLARE newest_version integer;
BEGIN
  SELECT version INTO newest_version FROM public.studio_agent_prompts
  WHERE prompt_key='__numeric-version-test' ORDER BY version DESC LIMIT 1;
  IF newest_version <> 10 THEN RAISE EXCEPTION 'numeric version ordering returned % instead of 10', newest_version; END IF;
END $$;

-- Temporarily grant mutation privileges so the immutable triggers are the denying control.
GRANT UPDATE, DELETE, TRUNCATE ON TABLE public.studio_agent_prompts TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE blocked boolean;
BEGIN
  blocked := false;
  BEGIN
    UPDATE public.studio_agent_prompts SET system_prompt='changed' WHERE prompt_key='a1-catalog-research' AND version=7;
  EXCEPTION WHEN SQLSTATE '55000' THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'service_role UPDATE was not blocked by immutable trigger'; END IF;

  blocked := false;
  BEGIN
    DELETE FROM public.studio_agent_prompts WHERE prompt_key='a1-catalog-research' AND version=7;
  EXCEPTION WHEN SQLSTATE '55000' THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'service_role DELETE was not blocked by immutable trigger'; END IF;

  blocked := false;
  BEGIN
    EXECUTE 'TRUNCATE public.studio_agent_prompts';
  EXCEPTION WHEN SQLSTATE '55000' THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'service_role TRUNCATE was not blocked by immutable trigger'; END IF;
END $$;
RESET ROLE;

ROLLBACK;