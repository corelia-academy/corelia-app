BEGIN;

DO $$ BEGIN
  IF has_function_privilege('anon', 'public.list_feed_xp_suggestions_v1(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous users can list feed suggestions';
  END IF;
END $$;

INSERT INTO auth.users(id, email) VALUES
  ('eebe0000-0000-4000-8000-000000000001', 'feed-viewer@corelia.local'),
  ('eebe0000-0000-4000-8000-000000000002', 'feed-high@corelia.local'),
  ('eebe0000-0000-4000-8000-000000000003', 'feed-low@corelia.local'),
  ('eebe0000-0000-4000-8000-000000000004', 'feed-private@corelia.local'),
  ('eebe0000-0000-4000-8000-000000000005', 'feed-followed@corelia.local');

UPDATE public.profiles
SET full_name = 'Feed Test ' || right(id::text, 1),
  profile_public = id <> 'eebe0000-0000-4000-8000-000000000004'
WHERE id::text LIKE 'eebe0000-%';

INSERT INTO public.user_point_ledger(user_id, source, source_key, points) VALUES
  ('eebe0000-0000-4000-8000-000000000002', 'lesson_completed', 'feed-test-high', 1000000),
  ('eebe0000-0000-4000-8000-000000000003', 'lesson_completed', 'feed-test-low', 50),
  ('eebe0000-0000-4000-8000-000000000004', 'lesson_completed', 'feed-test-private', 2000),
  ('eebe0000-0000-4000-8000-000000000005', 'lesson_completed', 'feed-test-followed', 3000);

INSERT INTO public.follows(follower_id, subject_type, subject_id)
VALUES ('eebe0000-0000-4000-8000-000000000001', 'user', 'eebe0000-0000-4000-8000-000000000005');

SELECT set_config('request.jwt.claim.sub', 'eebe0000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.list_feed_xp_suggestions_v1(8)
    WHERE id = 'eebe0000-0000-4000-8000-000000000002' AND total_xp = 1000000
  ) THEN
    RAISE EXCEPTION 'high-XP eligible user was not suggested';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.list_feed_xp_suggestions_v1(1) WHERE total_xp < 250
  ) THEN
    RAISE EXCEPTION 'lower-XP user was preferred over high-XP candidates';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.list_feed_xp_suggestions_v1(8)
    WHERE id IN (
      'eebe0000-0000-4000-8000-000000000001',
      'eebe0000-0000-4000-8000-000000000004',
      'eebe0000-0000-4000-8000-000000000005'
    )
  ) THEN
    RAISE EXCEPTION 'self, private, or followed user was suggested';
  END IF;
END $$;

RESET ROLE;
ROLLBACK;
