import { execFileSync } from "node:child_process";

const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;

const learnerId = "eeee0000-0000-4000-8000-000000000333";
const courseId = "khoa-hoc-hoan-tac-333";
const courseSlug = "khoa-hoc-hoan-tac-333";
const sectionId = "section-1";
const lesson1Id = "lesson-1";
const lesson2Id = "lesson-2";

const courseData = {
  title: "Khóa học thử nghiệm hoàn tác #333",
  description: "Khóa học mẫu dùng để kiểm thử tính năng hoàn tác hoàn thành và bảo lưu chứng nhận.",
  short_description: "Kiểm thử Issue #333",
  level: "beginner",
  thumbnail_url: "",
  instructor_name: "Corelia Tester",
  instructors: [],
  has_certificate: true,
  has_sections: true,
  total_duration_seconds: 3600,
  skills: ["Corelia", "Testing", "Undo Completion"],
  learning_outcomes: ["Kiểm thử hoàn tác bài học gần nhất", "Kiểm thử reset toàn bộ khóa học"],
  i18n: {
    supported_locales: ["vi", "en"],
    primary_content_locale: "vi",
  },
};

const statements = [
  "BEGIN;",
  // 1. Tạo hoặc đảm bảo user learner tồn tại
  `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (
    ${quote(learnerId)},
    'learner333@corelia.local',
    '{"full_name":"Học viên Thử nghiệm 333"}'
  ) ON CONFLICT (id) DO NOTHING;`,
  `UPDATE auth.users SET
    instance_id = '00000000-0000-0000-0000-000000000000',
    aud = 'authenticated',
    role = 'authenticated',
    encrypted_password = crypt('Corelia123!', gen_salt('bf', 10)),
    email_confirmed_at = now(),
    created_at = COALESCE(created_at, now()),
    updated_at = now(),
    last_sign_in_at = now(),
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change = '',
    is_super_admin = false,
    is_sso_user = false
  WHERE id = ${quote(learnerId)};`,
  `INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    ${quote(learnerId)},
    ${quote(learnerId)},
    jsonb_build_object('sub', ${quote(learnerId)}, 'email', 'learner333@corelia.local', 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  ) ON CONFLICT (provider_id, provider) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = EXCLUDED.updated_at;`,
  `INSERT INTO public.profiles (id, full_name, username, role) VALUES (
    ${quote(learnerId)},
    'Học viên Thử nghiệm 333',
    'learner333',
    'student'
  ) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;`,

  // 2. Tạo khóa học
  `INSERT INTO public.courses (id, instructor_id, slug, published, data) VALUES (
    ${quote(courseId)},
    ${quote(learnerId)},
    ${quote(courseSlug)},
    true,
    ${json(courseData)}
  ) ON CONFLICT (id) DO UPDATE SET published = true, data = EXCLUDED.data;`,

  // 3. Section
  `INSERT INTO public.course_sections (course_id, id, sort_order, data) VALUES (
    ${quote(courseId)},
    ${quote(sectionId)},
    1,
    ${json({ title: "Chương 1: Kiểm thử thực địa" })}
  ) ON CONFLICT (course_id, id) DO NOTHING;`,

  // 4. Bài học 1 & 2
  `INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, published, data) VALUES (
    ${quote(courseId)},
    ${quote(lesson1Id)},
    ${quote(sectionId)},
    1,
    true,
    ${json({
      title: "Bài 1: Giới thiệu kiến trúc Corelia",
      lesson_format: "article",
      description_markdown: "# Bài 1\nNội dung giới thiệu kiến trúc Corelia.",
      duration_seconds: 1800,
    })}
  ) ON CONFLICT (course_id, id) DO NOTHING;`,

  `INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, published, data) VALUES (
    ${quote(courseId)},
    ${quote(lesson2Id)},
    ${quote(sectionId)},
    2,
    true,
    ${json({
      title: "Bài 2: Thực hành hoàn tác trạng thái",
      lesson_format: "article",
      description_markdown: "# Bài 2\nNội dung thực hành hoàn tác trạng thái hoàn thành.",
      duration_seconds: 1800,
    })}
  ) ON CONFLICT (course_id, id) DO NOTHING;`,

  // 5. Tiến độ hoàn thành bài 1 & bài 2
  `INSERT INTO public.lesson_progress (id, user_id, course_id, lesson_id, completed_at) VALUES (
    ${quote(`${learnerId}_${courseId}_${lesson1Id}`)},
    ${quote(learnerId)},
    ${quote(courseId)},
    ${quote(lesson1Id)},
    now() - interval '2 days'
  ) ON CONFLICT (id) DO UPDATE SET completed_at = EXCLUDED.completed_at;`,

  `INSERT INTO public.lesson_progress (id, user_id, course_id, lesson_id, completed_at) VALUES (
    ${quote(`${learnerId}_${courseId}_${lesson2Id}`)},
    ${quote(learnerId)},
    ${quote(courseId)},
    ${quote(lesson2Id)},
    now() - interval '1 day'
  ) ON CONFLICT (id) DO UPDATE SET completed_at = EXCLUDED.completed_at;`,

  // 6. Ghi danh hoàn thành 100% kèm chứng nhận đã cấp
  `INSERT INTO public.enrollments (id, user_id, course_id, enrolled_at, last_accessed_at, completed_at, certificate_issued_at) VALUES (
    ${quote(`${learnerId}_${courseId}`)},
    ${quote(learnerId)},
    ${quote(courseId)},
    now() - interval '3 days',
    now() - interval '1 hour',
    now() - interval '1 day',
    now() - interval '1 day'
  ) ON CONFLICT (id) DO UPDATE SET
    last_accessed_at = EXCLUDED.last_accessed_at,
    completed_at = EXCLUDED.completed_at,
    certificate_issued_at = EXCLUDED.certificate_issued_at;`,

  // 7. Bản ghi chứng nhận trong certificate_records
  `INSERT INTO public.certificate_records (
    id, code, user_id, course_id, holder_name, course_title, instructor_name, issued_at
  ) VALUES (
    gen_random_uuid(),
    'CERT-333-TEST',
    ${quote(learnerId)},
    ${quote(courseId)},
    'Học viên Thử nghiệm 333',
    'Khóa học thử nghiệm hoàn tác #333',
    'Corelia Tester',
    now() - interval '1 day'
  ) ON CONFLICT (user_id, course_id) DO NOTHING;`,

  "COMMIT;",
];

try {
  execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_corelia-app", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"],
    { input: statements.join("\n"), stdio: ["pipe", "pipe", "pipe"] },
  );
  console.log(`[SEED_SUCCESS] Đã nạp thành công dữ liệu thử nghiệm #333:`);
  console.log(`- User: learner333@corelia.local (${learnerId})`);
  console.log(`- Course ID/Slug: ${courseSlug}`);
  console.log(`- Tiến độ: 2/2 bài học hoàn thành (100%), đã có chứng nhận CERT-333-TEST.`);
  console.log(`- URL kiểm thử: /courses/${courseSlug} và /learn/${courseSlug}`);
} catch (error) {
  console.error(error.stderr?.toString() ?? error.message);
  process.exitCode = 1;
}
