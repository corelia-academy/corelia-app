DO $test$
BEGIN
  BEGIN
    INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
      ('a7910000-0000-4000-8000-000000000001', 'avatar-seed-1@corelia.local', '{}'),
      ('a7910000-0000-4000-8000-000000000002', 'avatar-seed-2@corelia.local', '{}');

    IF EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id IN (
        'a7910000-0000-4000-8000-000000000001',
        'a7910000-0000-4000-8000-000000000002'
      )
      AND avatar_seed IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Existing/new profiles must default to an ID-derived avatar';
    END IF;

    SET LOCAL ROLE authenticated;
    PERFORM set_config(
      'request.jwt.claims',
      '{"sub":"a7910000-0000-4000-8000-000000000001","role":"authenticated"}',
      true
    );

    UPDATE public.profiles
    SET
      avatar_seed = 'a7910000-0000-4000-8000-000000000099',
      avatar_url = NULL
    WHERE id = 'a7910000-0000-4000-8000-000000000001';

    DECLARE affected integer;
    BEGIN
      UPDATE public.profiles
      SET avatar_seed = 'a7910000-0000-4000-8000-000000000098'
      WHERE id = 'a7910000-0000-4000-8000-000000000002';
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> 0 THEN
        RAISE EXCEPTION 'Cross-user avatar seed update allowed';
      END IF;
    END;

    RESET ROLE;

    IF (
      SELECT avatar_seed
      FROM public.public_profiles
      WHERE id = 'a7910000-0000-4000-8000-000000000001'
    ) <> 'a7910000-0000-4000-8000-000000000099'::uuid THEN
      RAISE EXCEPTION 'Public avatar seed mirror was not updated';
    END IF;

    IF has_table_privilege('anon', 'public.profiles', 'UPDATE')
      OR has_table_privilege('authenticated', 'public.public_profiles', 'UPDATE') THEN
      RAISE EXCEPTION 'Unsafe avatar seed update grant';
    END IF;

    RAISE SQLSTATE 'Z0001' USING MESSAGE = 'rollback test fixtures';
  EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
  END;
END;
$test$;
