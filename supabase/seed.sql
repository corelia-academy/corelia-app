-- Seed file for local development
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.com', crypt('123456', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name": "Admin Tester"}', now(), now(), '', '', '', ''),
('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@test.com', crypt('123456', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name": "Student Tester"}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Give the first user admin role (assuming there's a trigger that created public.profiles)
UPDATE public.profiles SET role = 'admin' WHERE id = '11111111-1111-1111-1111-111111111111';

-- 1. Create 3 Courses
INSERT INTO public.courses (id, instructor_id, published, slug, data) VALUES
('course-oca', '11111111-1111-1111-1111-111111111111', true, 'course-oca', '{"title": "Khóa học lấy OCA", "description": "Khóa học test OCA"}'),
('course-ocb', '11111111-1111-1111-1111-111111111111', true, 'course-ocb', '{"title": "Khóa học lấy OCB", "description": "Khóa học test OCB"}'),
('course-ms', '11111111-1111-1111-1111-111111111111', true, 'course-ms', '{"title": "Khóa học Milestone", "description": "Khóa học test Milestone"}')
ON CONFLICT (id) DO NOTHING;

-- 2. Create Sections and Lessons
INSERT INTO public.course_sections (id, course_id, sort_order, data) VALUES
('section-oca-1', 'course-oca', 1, '{"title": "Chương 1 OCA"}'),
('section-ocb-1', 'course-ocb', 1, '{"title": "Chương 1 OCB"}'),
('section-ms-1', 'course-ms', 1, '{"title": "Chương 1 Milestone"}')
ON CONFLICT (course_id, id) DO NOTHING;

INSERT INTO public.course_lessons (id, course_id, section_id, sort_order, data) VALUES
('lesson-oca-1', 'course-oca', 'section-oca-1', 1, '{"title": "Read Me OCA", "type": "read", "content": "#"}'),
('lesson-ocb-1', 'course-ocb', 'section-ocb-1', 1, '{"title": "Read Me OCB", "type": "read", "content": "#"}'),
('lesson-ms-1', 'course-ms', 'section-ms-1', 1, '{"title": "Read Me MS", "type": "read", "content": "#"}')
ON CONFLICT (course_id, id) DO NOTHING;

-- 3. Create Credential Templates (uuid requires format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
INSERT INTO public.credential_templates (id, scope_type, course_id, name, description, image_url, achievement_type, identifier_prefix, collection_symbol, trigger_type, is_active) VALUES
('aaaaaaaa-1111-1111-1111-111111111111', 'course', 'course-oca', 'OCA Template', 'OCA Desc', 'https://example.com/oca.png', 'CertificateOfCompletion', 'OCA', NULL, 'auto', true),
('bbbbbbbb-1111-1111-1111-111111111111', 'course', 'course-ocb', 'OCB Template', 'OCB Desc', 'https://example.com/ocb.png', 'Badge', 'OCB', NULL, 'auto', true),
('cccccccc-1111-1111-1111-111111111111', 'course', 'course-ms', 'Milestone Template', 'MS Desc', 'https://example.com/ms.png', 'Award', 'MS', NULL, 'auto', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Issue Credentials to Student (22222222-2222-2222-2222-222222222222)
INSERT INTO public.credential_issuances (id, template_id, user_id, course_id, issuer_reference_id, network, status, minted_at) VALUES
('aaaaaaaa-2222-2222-2222-222222222222', 'aaaaaaaa-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'course-oca', 'REF-OCA-1', 'staging', 'minted', now()),
('bbbbbbbb-2222-2222-2222-222222222222', 'bbbbbbbb-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'course-ocb', 'REF-OCB-1', 'staging', 'minted', now()),
('cccccccc-2222-2222-2222-222222222222', 'cccccccc-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'course-ms', 'REF-MS-1', 'staging', 'minted', now())
ON CONFLICT (id) DO NOTHING;

-- 5. Update Profiles with rich data and test Private Profile toggle
UPDATE public.profiles 
SET 
  bio = 'I am the admin of Corelia. I love to build things.',
  website = 'https://admin.corelia.com',
  instructor_origin = 'corelia',
  instructor_headline = 'Senior Dev',
  instructor_bio = 'I teach blockchain.',
  instructor_organization = 'Corelia Academy',
  instructor_website = 'https://corelia.com',
  instructor_social_links = '{"twitter": "https://twitter.com/admin"}',
  profile_public = true
WHERE id = '11111111-1111-1111-1111-111111111111';

UPDATE public.profiles 
SET 
  bio = 'I am a mysterious student.',
  website = 'https://student.corelia.com',
  instructor_origin = 'external',
  instructor_headline = 'Learner',
  instructor_bio = 'I learn blockchain.',
  instructor_organization = 'Self-taught',
  instructor_website = 'https://student.com',
  instructor_social_links = '{"github": "https://github.com/student"}',
  profile_public = false
WHERE id = '22222222-2222-2222-2222-222222222222';

-- 6. Issue Credentials to Admin (11111111-1111-1111-1111-111111111111)
INSERT INTO public.credential_issuances (id, template_id, user_id, course_id, issuer_reference_id, network, status, minted_at) VALUES
('aaaaaaaa-1111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'course-oca', 'REF-OCA-ADMIN', 'staging', 'minted', now()),
('bbbbbbbb-1111-1111-1111-111111111111', 'bbbbbbbb-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'course-ocb', 'REF-OCB-ADMIN', 'staging', 'minted', now())
ON CONFLICT (id) DO NOTHING;

-- 7. Add Enrollments for Admin and Student
INSERT INTO public.enrollments (id, user_id, course_id, enrolled_at, last_accessed_at) VALUES
('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'course-oca', now(), now()),
('e1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'course-ocb', now(), now()),
('e2222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'course-oca', now(), now()),
('e2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'course-ocb', now(), now()),
('e2222222-2222-2222-2222-222222222223', '22222222-2222-2222-2222-222222222222', 'course-ms', now(), now())
ON CONFLICT (id) DO NOTHING;
