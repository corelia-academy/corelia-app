-- Realtime ping for issue #96 after running seed-activity-feed-demo.sql.
--
-- Open /feed as feed-demo-student1@corelia.test first, then run:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f scripts/seed-activity-feed-realtime-ping.sql
--
-- Expected UI: /feed shows the "new activity" indicator because Student 1
-- follows Student 2 and the demo course.

INSERT INTO public.lesson_progress (
  id,
  user_id,
  course_id,
  lesson_id,
  completed_at,
  watch_seconds
)
VALUES (
  'feed-demo-realtime-progress-' || replace(gen_random_uuid()::text, '-', ''),
  '22222222-2222-4222-8222-222222222222',
  'feed-demo-course',
  'lesson-1',
  now(),
  240
);

SELECT 'activity feed realtime ping inserted' AS result;
