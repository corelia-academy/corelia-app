-- Execute on the pre/post upgrade fixture, always rollback every probe.
BEGIN;
INSERT INTO public.course_section_questions(id,course_id,section_id,lesson_id,sort_order,data) VALUES('compat-section-question','learning-upgrade-fixture','legacy-section',NULL,1,'{"type":"mcq","question":"Section question","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}');
SELECT set_config('request.jwt.claim.sub','dddd0000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE enforced boolean; result jsonb; BEGIN
 SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='course_lessons' AND column_name='published') INTO enforced;
 BEGIN
  INSERT INTO public.lesson_progress(id,user_id,course_id,lesson_id,completed_at) VALUES('compat-progress','dddd0000-0000-4000-8000-000000000003','learning-upgrade-fixture','legacy-quiz',now());
  IF enforced THEN RAISE EXCEPTION 'LEGACY_QUIZ_COMPLETION_BYPASS'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN IF NOT enforced THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO public.section_question_attempts(id,user_id,course_id,lesson_id,section_id,question_id,selected_index,is_correct) VALUES('compat-attempt','dddd0000-0000-4000-8000-000000000003','learning-upgrade-fixture','legacy-quiz',NULL,'legacy-question',0,true);
  RAISE EXCEPTION 'DIRECT_ATTEMPT_WRITE_BYPASS';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 result:=public.submit_quiz_attempts('[{"course_id":"learning-upgrade-fixture","lesson_id":"legacy-quiz","question_id":"legacy-question","selected_index":0}]');
 IF jsonb_array_length(result)<>1 OR result->0->>'is_correct'<>'true' THEN RAISE EXCEPTION 'LEGACY_BATCH_CONTRACT_FAILED'; END IF;
 IF enforced THEN
  IF result->0->>'attempt_group_id' IS NULL THEN RAISE EXCEPTION 'LEGACY_BATCH_BYPASSED_CANONICAL_GRADING'; END IF;
  IF public.submit_quiz_attempts('[{"course_id":"learning-upgrade-fixture","lesson_id":"legacy-quiz","question_id":"legacy-question","selected_index":0}]') IS DISTINCT FROM result THEN RAISE EXCEPTION 'LEGACY_REPLAY_NOT_IDEMPOTENT'; END IF;
  result:=public.learning_quiz_submit('learning-upgrade-fixture','legacy-quiz','dddd1111-0000-4000-8000-000000000001','{"legacy-question":0}');
  IF result->>'passed'<>'true' OR result->>'completed'<>'true' THEN RAISE EXCEPTION 'NEW_QUIZ_RPC_FAILED: %',result; END IF;
 ELSE
  IF to_regprocedure('public.learning_quiz_submit(text,text,uuid,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'UNEXPECTED_NEW_RPC_ON_BASELINE'; END IF;
 END IF;
 result:=public.submit_quiz_attempts('[{"course_id":"learning-upgrade-fixture","section_id":"legacy-section","question_id":"compat-section-question","selected_index":0}]');
 IF jsonb_array_length(result)<>1 OR result->0->>'is_correct'<>'true' OR result->0->>'lesson_id' IS NOT NULL THEN RAISE EXCEPTION 'SECTION_QUIZ_CONTRACT_CHANGED'; END IF;
 BEGIN
  UPDATE public.final_assignment_submissions SET content='Old client edit' WHERE id='legacy-resubmitted';
  IF enforced THEN RAISE EXCEPTION 'LEGACY_SUBMISSION_SILENT_SUCCESS'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN IF NOT enforced THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claim.sub','dddd0000-0000-4000-8000-000000000001',true);
DO $$ DECLARE enforced boolean; reviewed jsonb; BEGIN
 SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='course_lessons' AND column_name='published') INTO enforced;
 BEGIN
  UPDATE public.final_assignment_submissions SET status='approved',reviewed_at=now() WHERE id='legacy-resubmitted';
  IF enforced THEN RAISE EXCEPTION 'LEGACY_REVIEW_SILENT_SUCCESS'; END IF;
 EXCEPTION WHEN insufficient_privilege THEN IF NOT enforced THEN RAISE; END IF; END;
 IF enforced THEN
  IF to_regprocedure('public.learning_save_course_info(text,jsonb,text,jsonb)') IS NULL THEN RAISE EXCEPTION 'NEW_COURSE_SAVE_RPC_MISSING'; END IF;
  BEGIN
   PERFORM public.learning_save_course_info('learning-upgrade-fixture','{"published":false}','vi','{"short_description":"Atomic compatibility probe"}');
   IF (SELECT published FROM public.courses WHERE id='learning-upgrade-fixture') THEN RAISE EXCEPTION 'NEW_COURSE_SAVE_FAILED'; END IF;
   RAISE EXCEPTION SQLSTATE 'P0002' USING MESSAGE='rollback compatibility probe';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  reviewed:=public.learning_final_review('legacy-resubmitted','approved','Reviewed through RPC');
  IF reviewed->>'status'<>'approved' OR reviewed->>'reviewed_at' IS NULL THEN RAISE EXCEPTION 'NEW_REVIEW_CONTRACT_FAILED'; END IF;
  IF public.learning_final_review('legacy-resubmitted','approved','Reviewed through RPC') IS DISTINCT FROM reviewed THEN RAISE EXCEPTION 'REVIEW_REPLAY_CHANGED_RESULT'; END IF;
 ELSE
  IF to_regprocedure('public.learning_save_course_info(text,jsonb,text,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'UNEXPECTED_COURSE_SAVE_RPC_ON_BASELINE'; END IF;
 END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','dddd0000-0000-4000-8000-000000000003',true);
RESET ROLE;
DO $$ DECLARE before_count bigint; BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='course_lessons' AND column_name='published') THEN RETURN; END IF;
 SELECT count(*) INTO before_count FROM public.section_question_attempts;
 UPDATE public.course_lessons SET data=data||'{"quiz_config":{"allow_retry":false,"passing_ratio":0.7}}'::jsonb WHERE course_id='learning-upgrade-fixture' AND id='legacy-quiz';
 BEGIN
  PERFORM public.submit_quiz_attempts('[{"course_id":"learning-upgrade-fixture","lesson_id":"legacy-quiz","question_id":"legacy-question","selected_index":1}]');
  RAISE EXCEPTION 'LEGACY_BATCH_RETRY_BYPASS';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'RETRY_DISABLED' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.submit_quiz_attempts('[{"course_id":"learning-upgrade-fixture","lesson_id":"legacy-quiz","question_id":"legacy-question","selected_index":0},{"course_id":"other","lesson_id":"legacy-quiz","question_id":"other-question","selected_index":0}]');
  RAISE EXCEPTION 'MIXED_COURSE_BATCH_ACCEPTED';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.submit_quiz_attempts('[{"course_id":"learning-upgrade-fixture","lesson_id":"legacy-quiz","question_id":"legacy-question","selected_index":0},{"course_id":"learning-upgrade-fixture","lesson_id":"legacy-quiz","question_id":"legacy-question","selected_index":0}]');
  RAISE EXCEPTION 'DUPLICATE_BATCH_ACCEPTED';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF (SELECT count(*) FROM public.section_question_attempts)<>before_count THEN RAISE EXCEPTION 'INVALID_BATCH_LEFT_PARTIAL_ATTEMPTS'; END IF;
END $$;
ROLLBACK;
