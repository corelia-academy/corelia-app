-- Local-only seed for the course skill configuration flow.
--
-- Run from the repository root while Supabase local is running:
--   docker cp scripts/seed-local-course-skills.sql supabase_db_corelia-app:/tmp/seed-local-course-skills.sql
--   docker exec supabase_db_corelia-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed-local-course-skills.sql
--
-- It creates two published courses:
--   1. seed-course-skills-demo: three course-level skills.
--   2. seed-course-skills-legacy: no skills, for backward-compatibility testing.
--
-- The instructor is resolved from the first local auth user, so the seed does
-- not depend on a particular UUID from supabase/seed.sql.
--
-- The script only removes/recreates rows belonging to these two course IDs.

BEGIN;

DELETE FROM public.enrollments
WHERE course_id IN ('seed-course-skills-demo', 'seed-course-skills-legacy');

DELETE FROM public.courses
WHERE id IN ('seed-course-skills-demo', 'seed-course-skills-legacy');

INSERT INTO public.courses (id, instructor_id, published, slug, data)
VALUES
  (
    'seed-course-skills-demo',
    (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
    true,
    'seed-course-skills-demo',
    jsonb_build_object(
      'title', 'Seed — Web3 Foundations',
      'short_description', 'Local fixture để kiểm tra skill hiển thị theo khoá học.',
      'description', 'Khoá học local dùng để kiểm tra việc cấu hình nhiều skill ở form tạo/sửa và hiển thị trước khi học viên bắt đầu.',
      'learning_outcomes', jsonb_build_array(
        'Hiểu cách ví Web3 và giao dịch on-chain hoạt động.',
        'Nhận biết các khái niệm nền tảng của blockchain.',
        'Phân biệt các ứng dụng DeFi phổ biến.'
      ),
      'skills', jsonb_build_array(
        'Web3',
        'Blockchain',
        'DeFi'
      ),
      'instructor_name', 'Admin Tester',
      'level', 'beginner',
      'total_duration_seconds', 2700,
      'access_model', 'free',
      'has_sections', true,
      'i18n', jsonb_build_object(
        'supported_locales', jsonb_build_array('vi', 'en'),
        'primary_content_locale', 'vi',
        'default_video_primary_locale', 'vi',
        'subtitle_note_policy', 'suggest'
      )
    )
  ),
  (
    'seed-course-skills-legacy',
    (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
    true,
    'seed-course-skills-legacy',
    jsonb_build_object(
      'title', 'Seed — Legacy Course Without Skills',
      'short_description', 'Local fixture cho khoá cũ chưa có skill.',
      'description', 'Khoá học này cố ý không có trường skills để kiểm tra backward compatibility.',
      'learning_outcomes', jsonb_build_array('Kiểm tra trạng thái không có skill.'),
      'instructor_name', 'Admin Tester',
      'level', 'all',
      'total_duration_seconds', 900,
      'access_model', 'free',
      'has_sections', true
    )
  );

INSERT INTO public.course_sections (course_id, id, sort_order, data)
VALUES
  ('seed-course-skills-demo', 'intro', 1, jsonb_build_object('title', 'Web3 foundations')),
  ('seed-course-skills-demo', 'ecosystem', 2, jsonb_build_object('title', 'Web3 ecosystem')),
  ('seed-course-skills-legacy', 'intro', 1, jsonb_build_object('title', 'Legacy course intro'));

INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, data)
VALUES
  (
    'seed-course-skills-demo',
    'web3-basics',
    'intro',
    1,
    jsonb_build_object('title', 'Web3 basics', 'format', 'article', 'markdown', 'Local seed lesson.')
  ),
  (
    'seed-course-skills-demo',
    'ecosystem-basics',
    'ecosystem',
    1,
    jsonb_build_object('title', 'Web3 ecosystem', 'format', 'article', 'markdown', 'Local seed lesson.')
  ),
  (
    'seed-course-skills-legacy',
    'legacy-intro',
    'intro',
    1,
    jsonb_build_object('title', 'Legacy introduction', 'format', 'article', 'markdown', 'Local seed lesson.')
  );

INSERT INTO public.enrollments (
  id,
  user_id,
  course_id,
  enrolled_at,
  last_accessed_at,
  completed_at
)
SELECT
  'seed-course-skills-demo-enrollment',
  id,
  'seed-course-skills-demo',
  now() - interval '7 days',
  now() - interval '1 day',
  now() - interval '1 day'
FROM auth.users
ORDER BY created_at
LIMIT 1
ON CONFLICT (user_id, course_id) DO UPDATE
SET
  last_accessed_at = EXCLUDED.last_accessed_at,
  completed_at = EXCLUDED.completed_at;

COMMIT;

SELECT
  id,
  slug,
  data->>'title' AS title,
  data->'skills' AS skills
FROM public.courses
WHERE id IN ('seed-course-skills-demo', 'seed-course-skills-legacy')
ORDER BY id;
