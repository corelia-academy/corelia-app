DO $test$
BEGIN
 BEGIN
INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
 ('a7900000-0000-4000-8000-000000000001','profile-integrity-1@corelia.local',jsonb_build_object('full_name','Terran ' || repeat(chr(65526),2000))),
 ('a7900000-0000-4000-8000-000000000002','profile-integrity-2@corelia.local','{}');
BEGIN
 IF (SELECT full_name FROM public.profiles WHERE id='a7900000-0000-4000-8000-000000000001') <> 'Terran' THEN RAISE EXCEPTION 'Signup normalization failed'; END IF;
 IF EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC') AND privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER')) THEN RAISE EXCEPTION 'Client retains table DDL grants'; END IF;
 IF private.valid_profile_name(' ') OR private.valid_profile_name(repeat('a',161)) OR private.valid_profile_name(chr(65526)) THEN RAISE EXCEPTION 'Invalid name accepted'; END IF;
 IF NOT private.valid_profile_name('Nguyễn Thị Ánh') THEN RAISE EXCEPTION 'Vietnamese rejected'; END IF;
 IF has_table_privilege('anon','public.profiles','UPDATE') OR has_table_privilege('authenticated','public_profiles','UPDATE') OR has_table_privilege('authenticated','private.profile_name_recovery','SELECT') THEN RAISE EXCEPTION 'Unsafe grant'; END IF;
END;
SET LOCAL ROLE authenticated;
PERFORM set_config('request.jwt.claims','{"sub":"a7900000-0000-4000-8000-000000000001","role":"authenticated"}',true);
UPDATE public.profiles SET full_name='Nguyễn Thị Ánh' WHERE id='a7900000-0000-4000-8000-000000000001';
DECLARE affected int; BEGIN
 UPDATE public.profiles SET full_name='attacker' WHERE id='a7900000-0000-4000-8000-000000000002';
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'Cross-user write allowed'; END IF;
 BEGIN
  UPDATE public.profiles SET full_name='Terran' || chr(65526) WHERE id='a7900000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Hidden payload accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.profiles SET full_name=repeat('x',161) WHERE id='a7900000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Overlong name accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.profiles SET bio=repeat('x',16385) WHERE id='a7900000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Overlong biography accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.profiles SET username='hidden' || chr(8203) WHERE id='a7900000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Hidden username accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE public.profiles SET role='admin',tier='pro',instructor_origin='corelia' WHERE id='a7900000-0000-4000-8000-000000000001';
 IF (SELECT role FROM public.profiles WHERE id='a7900000-0000-4000-8000-000000000001') <> 'student' THEN RAISE EXCEPTION 'Role escalation allowed'; END IF;
 IF (SELECT instructor_origin FROM public.profiles WHERE id='a7900000-0000-4000-8000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'Instructor origin escalation allowed'; END IF;
END;
RESET ROLE;
-- Simulate an account whose profile is missing; self INSERT must not elevate.
DELETE FROM public.profiles WHERE id='a7900000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
PERFORM set_config('request.jwt.claims','{"sub":"a7900000-0000-4000-8000-000000000002","role":"authenticated"}',true);
INSERT INTO public.profiles(id,role,tier,instructor_origin) VALUES ('a7900000-0000-4000-8000-000000000002','admin','pro','corelia');
BEGIN
 IF (SELECT role <> 'student' OR tier <> 'free' OR instructor_origin IS NOT NULL FROM public.profiles WHERE id='a7900000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Insert escalation allowed'; END IF;
END;
RESET ROLE;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM private.profile_name_audit WHERE profile_id='a7900000-0000-4000-8000-000000000001' AND actor_id=profile_id AND new_name='Nguyễn Thị Ánh') THEN RAISE EXCEPTION 'Missing name audit'; END IF;
 IF (SELECT full_name FROM public.public_profiles WHERE id='a7900000-0000-4000-8000-000000000001') <> 'Nguyễn Thị Ánh' THEN RAISE EXCEPTION 'Mirror not updated'; END IF;
END;


 PERFORM set_config('request.jwt.claims','{}',true);
 -- Staff can still authorize an instructor; that instructor cannot self-certify origin.
 UPDATE public.profiles SET role='admin' WHERE id='a7900000-0000-4000-8000-000000000001';
 SET LOCAL ROLE authenticated;
 PERFORM set_config('request.jwt.claims','{"sub":"a7900000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 UPDATE public.profiles SET role='instructor',instructor_origin='external' WHERE id='a7900000-0000-4000-8000-000000000002';
 PERFORM set_config('request.jwt.claims','{"sub":"a7900000-0000-4000-8000-000000000002","role":"authenticated"}',true);
 UPDATE public.profiles SET instructor_origin='corelia' WHERE id='a7900000-0000-4000-8000-000000000002';
 IF (SELECT role <> 'instructor' OR instructor_origin <> 'external' FROM public.profiles WHERE id='a7900000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Staff/instructor boundary failed'; END IF;
 RESET ROLE;
 RAISE SQLSTATE 'Z0001' USING MESSAGE='rollback test fixtures';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
 END;
END;
$test$;
