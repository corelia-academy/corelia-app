DO $test$
DECLARE
  other_updated integer;
BEGIN
  BEGIN
    INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
      ('a7920000-0000-4000-8000-000000000001', 'avatar-config-1@corelia.local', '{}'),
      ('a7920000-0000-4000-8000-000000000002', 'avatar-config-2@corelia.local', '{}');

    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id IN ('a7920000-0000-4000-8000-000000000001', 'a7920000-0000-4000-8000-000000000002')
        AND avatar_config <> '{"selections":{},"colors":{}}'::jsonb
    ) THEN RAISE EXCEPTION 'Avatar config default differs from empty config'; END IF;

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', '{"sub":"a7920000-0000-4000-8000-000000000001","role":"authenticated"}', true);
    UPDATE public.profiles
    SET avatar_config = '{"selections":{"head":"fluffy-bob"},"colors":{"hair":"#123456"}}'::jsonb
    WHERE id = 'a7920000-0000-4000-8000-000000000001';
    UPDATE public.profiles
    SET avatar_config = '{"selections":{},"colors":{}}'::jsonb
    WHERE id = 'a7920000-0000-4000-8000-000000000002';
    GET DIAGNOSTICS other_updated = ROW_COUNT;
    IF other_updated <> 0 THEN RAISE EXCEPTION 'Cross-user avatar config update allowed'; END IF;
    RESET ROLE;

    IF (SELECT avatar_config -> 'colors' ->> 'hair' FROM public.public_profiles
        WHERE id = 'a7920000-0000-4000-8000-000000000001') <> '#123456'
    THEN RAISE EXCEPTION 'Public avatar config mirror was not updated'; END IF;

    BEGIN
      UPDATE public.profiles SET avatar_config = '{"selections":[],"colors":{}}'::jsonb
      WHERE id = 'a7920000-0000-4000-8000-000000000001';
      RAISE EXCEPTION 'Invalid avatar config accepted';
    EXCEPTION WHEN check_violation THEN NULL; END;

    RAISE SQLSTATE 'Z0001' USING MESSAGE = 'rollback avatar fixtures';
  EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
  END;
END;
$test$;
