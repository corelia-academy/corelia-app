-- Local-only seed for the Certificate + Open Campus Credential scenarios.
--
-- Prerequisites:
--   1. Supabase local is running.
--   2. Upload the four image files to the exact CDN paths referenced below.
--
-- Run:
--   docker cp scripts/seed-local-credential-scenarios.sql supabase_db_corelia-app:/tmp/seed-local-credential-scenarios.sql
--   docker exec supabase_db_corelia-app psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/seed-local-credential-scenarios.sql
--
-- This script is idempotent. It only deletes/recreates data whose course ID
-- starts with `seed-occ-`; it does not touch other local courses or users.

BEGIN;

-- Existing local development admin from supabase/seed.sql. It is deliberately
-- also the learner so all five achievement items appear in one profile.
UPDATE public.profiles
SET
  full_name = 'Admin Tester',
  username = 'admin_tester',
  ocid = 'admin-tester',
  profile_public = true
WHERE id = '11111111-1111-1111-1111-111111111111';

-- Remove only the two original Admin Tester credential rows created by the
-- repository's default supabase/seed.sql. Keeping them would show seven items
-- in this profile instead of this fixture's intended five.
DELETE FROM public.credential_issuances
WHERE id IN (
  'aaaaaaaa-1111-1111-1111-111111111111',
  'bbbbbbbb-1111-1111-1111-111111111111'
)
  AND user_id = '11111111-1111-1111-1111-111111111111';

-- Reset only this fixture set so reruns produce the same profile state.
DELETE FROM public.credential_issuances
WHERE course_id IN (
  'seed-occ-oca-only',
  'seed-occ-oca-certificate',
  'seed-occ-certificate-only',
  'seed-occ-ocb-only'
);

DELETE FROM public.credential_templates
WHERE course_id IN (
  'seed-occ-oca-only',
  'seed-occ-oca-certificate',
  'seed-occ-certificate-only',
  'seed-occ-ocb-only'
);

INSERT INTO public.courses (id, instructor_id, published, slug, data)
VALUES
  (
    'seed-occ-oca-only',
    '11111111-1111-1111-1111-111111111111',
    true,
    'seed-occ-oca-only',
    jsonb_build_object(
      'title', 'Seed OCC — OCA Only',
      'description', 'Khoá seed chỉ cấp Open Campus Achievement, không có PDF certificate.',
      'short_description', 'OCA-only local fixture.',
      'instructor_name', 'Admin Tester',
      'level', 'beginner',
      'access_model', 'free',
      'has_certificate', false,
      'onchain_certificate_template_url', 'http://127.0.0.1:54321/storage/v1/object/public/cdn/certificate-templates/seed-occ-oca-only/seed-onchain.png',
      'onchain_certificate_template_path', 'certificate-templates/seed-occ-oca-only/seed-onchain.png'
    )
  ),
  (
    'seed-occ-oca-certificate',
    '11111111-1111-1111-1111-111111111111',
    true,
    'seed-occ-oca-certificate',
    jsonb_build_object(
      'title', 'Seed OCC — OCA + Certificate',
      'description', 'Khoá seed có PDF certificate và OCA claim qua card certificate.',
      'short_description', 'Certificate + OCA local fixture.',
      'instructor_name', 'Admin Tester',
      'level', 'intermediate',
      'access_model', 'free',
      'has_certificate', true,
      'certificate_template_url', 'http://127.0.0.1:54321/storage/v1/object/public/cdn/certificate-templates/seed-occ-oca-certificate/seed-certificate.png',
      'certificate_template_path', 'certificate-templates/seed-occ-oca-certificate/seed-certificate.png',
      'certificate_name_x_percent', 50,
      'certificate_name_y_percent', 50,
      'certificate_name_color', '#172554',
      'onchain_certificate_template_url', 'http://127.0.0.1:54321/storage/v1/object/public/cdn/certificate-templates/seed-occ-oca-certificate/seed-onchain.png',
      'onchain_certificate_template_path', 'certificate-templates/seed-occ-oca-certificate/seed-onchain.png'
    )
  ),
  (
    'seed-occ-certificate-only',
    '11111111-1111-1111-1111-111111111111',
    true,
    'seed-occ-certificate-only',
    jsonb_build_object(
      'title', 'Seed OCC — Certificate Only',
      'description', 'Khoá seed chỉ cấp PDF certificate, không tạo Open Campus credential.',
      'short_description', 'Certificate-only local fixture.',
      'instructor_name', 'Admin Tester',
      'level', 'beginner',
      'access_model', 'free',
      'has_certificate', true,
      'certificate_template_url', 'http://127.0.0.1:54321/storage/v1/object/public/cdn/certificate-templates/seed-occ-certificate-only/seed-certificate.png',
      'certificate_template_path', 'certificate-templates/seed-occ-certificate-only/seed-certificate.png',
      'certificate_name_x_percent', 50,
      'certificate_name_y_percent', 50,
      'certificate_name_color', '#172554'
    )
  ),
  (
    'seed-occ-ocb-only',
    '11111111-1111-1111-1111-111111111111',
    true,
    'seed-occ-ocb-only',
    jsonb_build_object(
      'title', 'Seed OCC — OCB Only',
      'description', 'Khoá seed chỉ cấp Open Campus Badge, không có PDF certificate.',
      'short_description', 'OCB-only local fixture.',
      'instructor_name', 'Admin Tester',
      'level', 'advanced',
      'access_model', 'free',
      'has_certificate', false
    )
  )
ON CONFLICT (id) DO UPDATE
SET
  instructor_id = EXCLUDED.instructor_id,
  published = EXCLUDED.published,
  slug = EXCLUDED.slug,
  data = EXCLUDED.data;

-- The two certificate courses receive their off-chain certificate through the
-- enrollment state. OCA-only and OCB-only intentionally keep this NULL.
INSERT INTO public.enrollments (
  id,
  user_id,
  course_id,
  enrolled_at,
  last_accessed_at,
  completed_at,
  certificate_issued_at
)
VALUES
  ('seed-occ-enrollment-oca-only', '11111111-1111-1111-1111-111111111111', 'seed-occ-oca-only', now() - interval '12 days', now() - interval '2 days', now() - interval '2 days', NULL),
  ('seed-occ-enrollment-oca-certificate', '11111111-1111-1111-1111-111111111111', 'seed-occ-oca-certificate', now() - interval '11 days', now() - interval '3 days', now() - interval '3 days', now() - interval '3 days'),
  ('seed-occ-enrollment-certificate-only', '11111111-1111-1111-1111-111111111111', 'seed-occ-certificate-only', now() - interval '10 days', now() - interval '4 days', now() - interval '4 days', now() - interval '4 days'),
  ('seed-occ-enrollment-ocb-only', '11111111-1111-1111-1111-111111111111', 'seed-occ-ocb-only', now() - interval '9 days', now() - interval '5 days', now() - interval '5 days', NULL)
ON CONFLICT (user_id, course_id) DO UPDATE
SET
  last_accessed_at = EXCLUDED.last_accessed_at,
  completed_at = EXCLUDED.completed_at,
  certificate_issued_at = EXCLUDED.certificate_issued_at;

-- OCA templates use collection_symbol NULL + CertificateOfCompletion.
-- OCB uses collection_symbol='ocbadge' + Badge. There is intentionally no
-- template for certificate-only, matching the frontend's three-way behavior.
INSERT INTO public.credential_templates (
  id,
  scope_type,
  course_id,
  name,
  description,
  image_url,
  thumbnail_url,
  achievement_type,
  identifier_prefix,
  collection_symbol,
  custom_metadata,
  trigger_type,
  trigger_rule,
  network_override,
  is_active
)
VALUES
  (
    'ca000001-0000-4000-8000-000000000001',
    'course',
    'seed-occ-oca-only',
    'OCA Only — Blockchain Foundations',
    'Open Campus Achievement dành cho fixture OCA-only.',
    'http://127.0.0.1:54321/storage/v1/object/public/cdn/certificate-templates/seed-occ-oca-only/seed-onchain.png',
    'http://127.0.0.1:54321/storage/v1/object/public/cdn/certificate-templates/seed-occ-oca-only/seed-onchain.png',
    'CertificateOfCompletion',
    'seed:occ:oca-only',
    NULL,
    jsonb_build_object('seed', true, 'scenario', 'oca_only'),
    'auto',
    jsonb_build_object('completion_pct', 100, 'require_assignment_pass', false, 'min_assignment_score', 70),
    'staging',
    true
  ),
  (
    'ca000002-0000-4000-8000-000000000002',
    'course',
    'seed-occ-oca-certificate',
    'OCA + Certificate — Product Builder',
    'Open Campus Achievement được claim qua PDF certificate fixture.',
    'http://127.0.0.1:54321/storage/v1/object/public/cdn/certificate-templates/seed-occ-oca-certificate/seed-onchain.png',
    'http://127.0.0.1:54321/storage/v1/object/public/cdn/certificate-templates/seed-occ-oca-certificate/seed-onchain.png',
    'CertificateOfCompletion',
    'seed:occ:oca-certificate',
    NULL,
    jsonb_build_object('seed', true, 'scenario', 'oca_certificate'),
    'auto',
    jsonb_build_object('completion_pct', 100, 'require_assignment_pass', false, 'min_assignment_score', 70),
    'staging',
    true
  ),
  (
    'cb000003-0000-4000-8000-000000000003',
    'course',
    'seed-occ-ocb-only',
    'OCB Only — Community Contributor',
    'Open Campus Badge dành cho fixture OCB-only.',
    'http://127.0.0.1:54321/storage/v1/object/public/cdn/credential-badges/course/seed-occ-ocb-only/seed-badge.png',
    'http://127.0.0.1:54321/storage/v1/object/public/cdn/credential-badges/course/seed-occ-ocb-only/seed-badge.png',
    'Badge',
    'seed:occ:ocb-only',
    'ocbadge',
    jsonb_build_object('seed', true, 'scenario', 'ocb_only'),
    'auto',
    jsonb_build_object('completion_pct', 100, 'require_assignment_pass', false, 'min_assignment_score', 70),
    'staging',
    true
  );

-- Three minted on-chain records + two enrollment certificate_issued_at values
-- above yield exactly five achievement items in Admin Tester's profile.
INSERT INTO public.credential_issuances (
  id,
  template_id,
  user_id,
  course_id,
  issuer_reference_id,
  network,
  status,
  oc_request_payload,
  oc_response,
  oc_credential_id,
  minted_at,
  granted_by,
  granted_reason
)
VALUES
  (
    'da000001-0000-4000-8000-000000000001',
    'ca000001-0000-4000-8000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'seed-occ-oca-only',
    'local-seed-occ-oca-only-v1',
    'staging',
    'minted',
    jsonb_build_object('credentialSubject', jsonb_build_object('name', 'Admin Tester')),
    jsonb_build_object('credentialId', '900001', 'seed', true),
    '900001',
    now() - interval '2 days',
    '11111111-1111-1111-1111-111111111111',
    'Local seed: OCA-only already claimed.'
  ),
  (
    'da000002-0000-4000-8000-000000000002',
    'ca000002-0000-4000-8000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'seed-occ-oca-certificate',
    'local-seed-occ-oca-certificate-v1',
    'staging',
    'minted',
    jsonb_build_object('credentialSubject', jsonb_build_object('name', 'Admin Tester')),
    jsonb_build_object('credentialId', '900002', 'seed', true),
    '900002',
    now() - interval '3 days',
    '11111111-1111-1111-1111-111111111111',
    'Local seed: OCA issued from the certificate + OCA course.'
  ),
  (
    'db000003-0000-4000-8000-000000000003',
    'cb000003-0000-4000-8000-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'seed-occ-ocb-only',
    'local-seed-occ-ocb-only-v1',
    'staging',
    'minted',
    jsonb_build_object('credentialSubject', jsonb_build_object('id', 'admin-tester.edu')),
    jsonb_build_object('credentialId', '900003', 'seed', true),
    '900003',
    now() - interval '5 days',
    '11111111-1111-1111-1111-111111111111',
    'Local seed: OCB-only already minted.'
  );

COMMIT;

-- Expected after running:
--   certificates: 2 rows (oca-certificate + certificate-only)
--   on-chain:     3 minted rows (2 OCA + 1 OCB)
SELECT
  c.id AS course_id,
  c.data->>'title' AS course_title,
  e.certificate_issued_at IS NOT NULL AS has_pdf_certificate,
  t.collection_symbol,
  t.achievement_type,
  ci.status AS issuance_status,
  ci.oc_credential_id
FROM public.courses AS c
LEFT JOIN public.enrollments AS e
  ON e.course_id = c.id
 AND e.user_id = '11111111-1111-1111-1111-111111111111'
LEFT JOIN public.credential_templates AS t
  ON t.course_id = c.id
LEFT JOIN public.credential_issuances AS ci
  ON ci.course_id = c.id
 AND ci.user_id = '11111111-1111-1111-1111-111111111111'
WHERE c.id LIKE 'seed-occ-%'
ORDER BY c.id;
