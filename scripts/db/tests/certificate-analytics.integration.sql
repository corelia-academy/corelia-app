BEGIN;

DO $$ BEGIN
  IF has_function_privilege('anon', 'public.admin_certificate_analytics(text,date,date,text,integer,integer)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.admin_certificate_analytics(text,date,date,text,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Certificate analytics RPC grants are incorrect';
  END IF;
END $$;

INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
  ('caaa0000-0000-4000-8000-000000000001', 'cert-admin@corelia.local', '{}'),
  ('caaa0000-0000-4000-8000-000000000002', 'cert-one@corelia.local', '{"full_name":"Learner One"}'),
  ('caaa0000-0000-4000-8000-000000000003', 'cert-two@corelia.local', '{"full_name":"Learner Two"}'),
  ('caaa0000-0000-4000-8000-000000000004', 'cert-three@corelia.local', '{"full_name":"Learner Three"}');
UPDATE public.profiles SET role = 'admin' WHERE id = 'caaa0000-0000-4000-8000-000000000001';

INSERT INTO public.courses(id, instructor_id, slug, published, data) VALUES
  ('certificate-analytics-test', 'caaa0000-0000-4000-8000-000000000001', 'certificate-analytics-test', false,
    '{"title":"Certificate analytics test","has_certificate":true}'),
  ('certificate-analytics-ocb-only', 'caaa0000-0000-4000-8000-000000000001', 'certificate-analytics-ocb-only', false,
    '{"title":"OCB only test","has_certificate":false}');

-- Seed historical completion snapshots without replaying the course curriculum.
ALTER TABLE public.enrollments DISABLE TRIGGER trg_guard_enrollment_completion_mutation;
INSERT INTO public.enrollments(id, user_id, course_id, enrolled_at, last_accessed_at, completed_at, certificate_issued_at) VALUES
  ('caaa0000-0000-4000-8000-000000000002_certificate-analytics-test', 'caaa0000-0000-4000-8000-000000000002', 'certificate-analytics-test', now() - interval '2 days', now(), now() - interval '1 day', now() - interval '1 day'),
  ('caaa0000-0000-4000-8000-000000000003_certificate-analytics-test', 'caaa0000-0000-4000-8000-000000000003', 'certificate-analytics-test', now() - interval '2 days', now(), now() - interval '1 day', null),
  ('caaa0000-0000-4000-8000-000000000004_certificate-analytics-test', 'caaa0000-0000-4000-8000-000000000004', 'certificate-analytics-test', now() - interval '2 days', now(), now() - interval '1 day', null),
  ('caaa0000-0000-4000-8000-000000000004_certificate-analytics-ocb-only', 'caaa0000-0000-4000-8000-000000000004', 'certificate-analytics-ocb-only', now() - interval '2 days', now(), now() - interval '1 day', null);
ALTER TABLE public.enrollments ENABLE TRIGGER trg_guard_enrollment_completion_mutation;

INSERT INTO public.credential_templates(
  id, scope_type, course_id, name, description, image_url, achievement_type,
  identifier_prefix, collection_symbol, trigger_type, trigger_rule, is_active
) VALUES (
  'caaa0000-0000-4000-8000-000000000010', 'course', 'certificate-analytics-test',
  'OCA test', 'OCA test', 'https://corelia.local/certificate.png', 'Badge',
  'corelia:analytics-test', null, 'auto', '{}', false
), (
  'caaa0000-0000-4000-8000-000000000020', 'course', 'certificate-analytics-ocb-only',
  'OCB test', 'OCB test', 'https://corelia.local/badge.png', 'Badge',
  'corelia:analytics-badge', 'ocbadge', 'auto', '{}', false
);

INSERT INTO public.credential_issuances(
  id, template_id, user_id, course_id, issuer_reference_id, network, status,
  oc_credential_id, minted_at, error_message
) VALUES
  ('caaa0000-0000-4000-8000-000000000011', 'caaa0000-0000-4000-8000-000000000010', 'caaa0000-0000-4000-8000-000000000002', 'certificate-analytics-test', 'cert-analytics-staging', 'staging', 'failed', null, null, 'API_AUTH_FAILED'),
  ('caaa0000-0000-4000-8000-000000000012', 'caaa0000-0000-4000-8000-000000000010', 'caaa0000-0000-4000-8000-000000000002', 'certificate-analytics-test', 'cert-analytics-mainnet', 'mainnet', 'minted', '123456', now() - interval '1 day', null),
  ('caaa0000-0000-4000-8000-000000000013', 'caaa0000-0000-4000-8000-000000000010', 'caaa0000-0000-4000-8000-000000000003', 'certificate-analytics-test', 'cert-analytics-pending', 'mainnet', 'pending', null, null, 'awaiting_holder_id'),
  ('caaa0000-0000-4000-8000-000000000021', 'caaa0000-0000-4000-8000-000000000020', 'caaa0000-0000-4000-8000-000000000004', 'certificate-analytics-ocb-only', 'badge-analytics-mainnet', 'mainnet', 'minted', 'badge-123', now(), null);

INSERT INTO public.credential_mint_attempts(issuance_id, outcome, provider_http_status) VALUES
  ('caaa0000-0000-4000-8000-000000000011', 'rejected', 401),
  ('caaa0000-0000-4000-8000-000000000012', 'accepted', 200),
  ('caaa0000-0000-4000-8000-000000000021', 'accepted', 200);

INSERT INTO public.email_delivery_attempts(mail_type, recipient_email, provider_status, context_type, context_id) VALUES
  ('certificate_issued', 'cert-one@corelia.local', 'provider_error', 'corelia_certificate',
    (SELECT id FROM public.certificate_records WHERE course_id = 'certificate-analytics-test' AND user_id = 'caaa0000-0000-4000-8000-000000000002')),
  ('credential_minted', 'cert-one@corelia.local', 'accepted', 'oc_issuance', 'caaa0000-0000-4000-8000-000000000012');

INSERT INTO public.user_notifications(user_id, type, payload) VALUES
  ('caaa0000-0000-4000-8000-000000000002', 'oc_credential_minted', '{"issuance_id":"caaa0000-0000-4000-8000-000000000012","oc_credential_id":"123456"}');

SELECT set_config('request.jwt.claim.sub', 'caaa0000-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v jsonb; one_row jsonb; no_oca_row jsonb;
BEGIN
  v := public.admin_certificate_analytics('certificate-analytics-test', null, null, null, 0, 25);
  IF (v->>'total')::int <> 3 OR (v->'summary'->>'completed')::int <> 3
    OR (v->'summary'->>'corelia_issued')::int <> 1
    OR (v->'summary'->>'oca_minted')::int <> 1
    OR (v->'summary'->>'oca_pending')::int <> 1
    OR (v->'summary'->>'oca_failed')::int <> 0
    OR (v->>'mint_attempts_logged')::int <> 2 THEN
    RAISE EXCEPTION 'Unexpected aggregate: %', v;
  END IF;
  IF (public.admin_certificate_analytics('certificate-analytics-ocb-only')->>'total')::int <> 0 THEN
    RAISE EXCEPTION 'OCB-only course leaked into certificate analytics';
  END IF;
  SELECT value INTO one_row FROM jsonb_array_elements(v->'rows')
    WHERE value->>'user_id' = 'caaa0000-0000-4000-8000-000000000002';
  SELECT value INTO no_oca_row FROM jsonb_array_elements(v->'rows')
    WHERE value->>'user_id' = 'caaa0000-0000-4000-8000-000000000004';
  IF one_row->>'oc_email' <> 'accepted'
    OR one_row->>'core_email' <> 'provider_error'
    OR (one_row->>'oc_notification')::boolean IS NOT TRUE
    OR (one_row->>'core_notification')::boolean IS NOT FALSE
    OR no_oca_row->>'issuance_id' IS NOT NULL
    OR no_oca_row->>'core_email' IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected delivery state: %', v->'rows';
  END IF;
  v := public.admin_certificate_analytics('certificate-analytics-test', null, null, 'staging', 0, 1);
  IF (v->>'total')::int <> 1 OR (v->'summary'->>'oca_failed')::int <> 1
    OR jsonb_array_length(v->'rows') <> 1 THEN
    RAISE EXCEPTION 'Unexpected staging filter/page: %', v;
  END IF;
  v := public.admin_certificate_analytics('certificate-analytics-test', current_date + 2, null, null, 0, 1);
  IF (v->>'total')::int <> 0 THEN RAISE EXCEPTION 'Date filter failed: %', v; END IF;
  v := public.admin_certificate_analytics('certificate-analytics-test', null, null, null, 1, 1);
  IF (v->>'total')::int <> 3 OR jsonb_array_length(v->'rows') <> 1 THEN
    RAISE EXCEPTION 'Pagination failed: %', v;
  END IF;
END $$;
RESET ROLE;

UPDATE public.certificate_records SET revoked_at = now(), revoked_reason = 'test'
  WHERE course_id = 'certificate-analytics-test';
SET LOCAL ROLE authenticated;
DO $$
DECLARE v jsonb;
BEGIN
  v := public.admin_certificate_analytics('certificate-analytics-test');
  IF (v->'summary'->>'corelia_issued')::int <> 0 OR (v->'summary'->>'corelia_revoked')::int <> 1 THEN
    RAISE EXCEPTION 'Revocation was not reflected: %', v;
  END IF;
END $$;
RESET ROLE;

UPDATE public.profiles SET role = 'support_staff' WHERE id = 'caaa0000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.admin_certificate_analytics();
  RAISE EXCEPTION 'Support staff was allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;
ROLLBACK;
