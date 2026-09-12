BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('eeee0000-0000-4000-8000-000000000001','learning-admin@corelia.local','{"full_name":"Learning Admin"}'),
 ('eeee0000-0000-4000-8000-000000000002','learning-user@corelia.local','{"full_name":"Learning User"}'),
 ('eeee0000-0000-4000-8000-000000000003','learning-instructor@corelia.local','{"full_name":"Learning Instructor"}');
UPDATE public.profiles SET role='admin' WHERE id='eeee0000-0000-4000-8000-000000000001';
UPDATE public.profiles SET role='instructor' WHERE id='eeee0000-0000-4000-8000-000000000003';
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES('learning-test','eeee0000-0000-4000-8000-000000000003','learning-test',false,'{"title":"Learning test","final_assignment_title":"Project","final_assignment_instructions":"Submit GitHub","final_assignment_fields":["github_url"]}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('learning-test','learning-section','{"title":"Section"}');
-- A second course deliberately reuses a lesson ID: reporting must stay scoped.
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES('learning-other','eeee0000-0000-4000-8000-000000000001','learning-other',false,'{"title":"Other course"}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('learning-other','other-section','{"title":"Section"}');
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('learning-other','learning-quiz','other-section',true,'{"title":"Other article","lesson_format":"article","description_markdown":"Read this."}');
UPDATE public.courses SET published=true WHERE id='learning-other';
-- Reference projects are public content, never project templates.
INSERT INTO public.projects(id,owner_id,slug,title,visibility,blocked,source_type) VALUES
 ('eeee8888-0000-4000-8000-000000000001','eeee0000-0000-4000-8000-000000000003','learning-public-reference','Reference','public',false,'standalone'),
 ('eeee8888-0000-4000-8000-000000000002','eeee0000-0000-4000-8000-000000000003','learning-private-reference','Private','private',false,'standalone'),
 ('eeee8888-0000-4000-8000-000000000003','eeee0000-0000-4000-8000-000000000003','learning-blocked-reference','Blocked','private',true,'standalone');
DO $$ DECLARE config jsonb; reference_id text; BEGIN
 config:='{"title":"Practice","lesson_format":"practice","description_markdown":"Instructions","practice_config":{"mode":"instruction"}}';
 FOREACH reference_id IN ARRAY ARRAY['eeee8888-0000-4000-8000-000000000002','eeee8888-0000-4000-8000-000000000003','eeee8888-0000-4000-8000-000000000004'] LOOP
  IF NOT ('invalid_related_project'=ANY(private.learning_lesson_errors('project-reference',jsonb_set(config,'{practice_config,related_project_id}',to_jsonb(reference_id)),'learning-test'))) THEN RAISE EXCEPTION 'inaccessible project accepted: %',reference_id; END IF;
 END LOOP;
 IF cardinality(private.learning_lesson_errors('project-reference',jsonb_set(config,'{practice_config,related_project_id}','"eeee8888-0000-4000-8000-000000000001"'),'learning-test'))<>0 THEN RAISE EXCEPTION 'public project rejected'; END IF;
END $$;
DO $$ DECLARE bad jsonb; BEGIN
 IF NOT private.learning_locale_copy_valid('{"code_exercise_locale":{"hints":["Hint"],"blank_feedback":{"a":"Try"},"test_copy":{"t":{"hint":"Read"}}},"has_subtitle":false,"subtitle_locales":["vi","en"]}') THEN RAISE EXCEPTION 'valid copy rejected'; END IF;
 FOR bad IN SELECT value FROM jsonb_array_elements('[{"code_exercise_locale":null},{"code_exercise_locale":{"hints":{}}},{"code_exercise_locale":{"hints":[1]}},{"code_exercise_locale":{"blank_feedback":{"a":null}}},{"code_exercise_locale":{"test_copy":{"t":{"hint":[]}}}},{"has_subtitle":"false"},{"subtitle_locales":["fr"]},{"video_primary_locale":1}]') LOOP
  IF private.learning_locale_copy_valid(bad) THEN RAISE EXCEPTION 'bad copy accepted: %',bad; END IF;
  IF NOT ('invalid_locale_copy'=ANY(private.learning_lesson_errors('copy-check','{"title":"Article","lesson_format":"article","description_markdown":"Read"}'::jsonb||bad,'learning-test'))) THEN RAISE EXCEPTION 'publication bypass: %',bad; END IF;
 END LOOP;
END $$;
SAVEPOINT publication_locations;
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES('learning-location','eeee0000-0000-4000-8000-000000000001','learning-location',false,'{"title":"","final_assignment_title":"Final"}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('learning-location','location-section','{"title":"Section"}');
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('learning-location','location-lesson','location-section',true,'{"title":"Article","lesson_format":"article","description_markdown":"Read"}');
INSERT INTO public.course_lesson_locales(course_id,lesson_id,locale,data) VALUES('learning-location','location-lesson','en','{"title":"English","resources":[{"title":"Resource","url":""}]}');
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE report jsonb; BEGIN
 report:=public.learning_publish_report('learning-location');
 IF NOT report @> '[{"panel":"info","field":"title","fieldPath":["title"],"code":"title_required"}]'::jsonb THEN RAISE EXCEPTION 'course location missing: %',report; END IF;
 IF NOT report @> '[{"panel":"assignments","field":"final_assignment_instructions","code":"final_instructions_required"}]'::jsonb THEN RAISE EXCEPTION 'final location missing: %',report; END IF;
 IF NOT report @> '[{"lessonId":"location-lesson","locale":"en","panel":"content","field":"resource-0-url","fieldPath":["resources",0,"url"],"code":"resource_url_invalid"}]'::jsonb THEN RAISE EXCEPTION 'localized resource location missing: %',report; END IF;
END $$;
ROLLBACK TO SAVEPOINT publication_locations;
RELEASE SAVEPOINT publication_locations;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;

SELECT public.learning_save_lesson('learning-test','{"id":"learning-quiz","section_id":"learning-section","order":0,"published":true,"title":"Quiz","lesson_format":"quiz","quiz_config":{"passing_ratio":1,"allow_retry":true}}','[{"id":"learning-question","order":0,"type":"mcq","question":"Which?","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}]','{"en":{"title":"Quiz English","question_copy":{"learning-question":{"question":"Which option?"}}}}');
SELECT public.learning_save_lesson('learning-test','{"id":"learning-draft","section_id":"learning-section","order":1,"published":false,"title":"Draft","lesson_format":"article","description_markdown":"draft"}');
DO $$ DECLARE detail text; BEGIN
 BEGIN
  PERFORM public.learning_save_lesson('learning-test','{"id":"learning-draft","section_id":"learning-section","published":false,"title":"Must roll back","lesson_format":"article","description_markdown":"Read"}',NULL,'{"en":{"code_exercise_locale":{"hints":{}},"subtitle_locales":["en"]}}');
  RAISE EXCEPTION 'malformed draft locale accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'INVALID_LOCALE_COPY' THEN RAISE; END IF;
  GET STACKED DIAGNOSTICS detail=PG_EXCEPTION_DETAIL;
  IF NOT detail::jsonb @> '{"issues":[{"lessonId":"learning-draft","locale":"en","field":"locale_copy","code":"invalid_locale_copy"}]}' THEN RAISE EXCEPTION 'copy field location missing'; END IF;
 END;
 IF (SELECT data->>'title' FROM public.course_lessons WHERE course_id='learning-test' AND id='learning-draft')<>'Draft' THEN RAISE EXCEPTION 'copy validation did not rollback lesson'; END IF;
 BEGIN
  UPDATE public.course_lessons SET data=data||'{"has_subtitle":"false"}'::jsonb WHERE course_id='learning-test' AND id='learning-draft';
  RAISE EXCEPTION 'direct malformed subtitle write accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_LOCALE_COPY' THEN RAISE; END IF; END;
END $$;
DO $$ DECLARE detail text; BEGIN
 BEGIN
  PERFORM public.learning_save_lesson('learning-test','{"id":"learning-draft","section_id":"learning-section","order":1,"published":true,"title":"Unsaved change","lesson_format":"article","description_markdown":"Read"}',NULL,'{"en":{"title":"English","resources":[{"title":"Missing URL","url":""}]}}');
  RAISE EXCEPTION 'invalid candidate saved';
 EXCEPTION WHEN raise_exception THEN
  GET STACKED DIAGNOSTICS detail = PG_EXCEPTION_DETAIL;
  IF detail IS NULL OR detail='' OR NOT (detail::jsonb @> '{"issues":[{"lessonId":"learning-draft","locale":"en","field":"resource-0-url","code":"resource_url_invalid"}]}') THEN RAISE EXCEPTION 'candidate issue detail missing: %',detail; END IF;
 END;
 IF (SELECT data->>'title' FROM public.course_lessons WHERE course_id='learning-test' AND id='learning-draft')<>'Draft' THEN RAISE EXCEPTION 'failed save changed persisted lesson'; END IF;
 IF EXISTS(SELECT 1 FROM public.course_lesson_locales WHERE course_id='learning-test' AND lesson_id='learning-draft' AND locale='en') THEN RAISE EXCEPTION 'failed save persisted candidate locale'; END IF;
END $$;
UPDATE public.courses SET published=true WHERE id='learning-test';
SET CONSTRAINTS ALL IMMEDIATE;

-- Legacy section question writes preserve IDs/history and rollback as a unit.
SELECT public.learning_save_section_questions('learning-test','learning-section','[{"id":"section-vi-1","type":"mcq","question":"VI one","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0},{"id":"section-vi-2","type":"mcq","question":"VI two","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":1}]','vi');
SELECT public.learning_save_section_questions('learning-test','learning-section','[{"id":"section-en-1","type":"mcq","question":"EN one","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}]','en');
RESET ROLE;
INSERT INTO public.section_question_attempts(user_id,course_id,section_id,question_id,selected_index,is_correct)
VALUES('eeee0000-0000-4000-8000-000000000002','learning-test','learning-section','section-vi-2',1,true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE before_rows jsonb; after_rows jsonb; BEGIN
 SELECT jsonb_agg(to_jsonb(q) ORDER BY id) INTO before_rows FROM public.course_section_questions q WHERE section_id='learning-section' AND lesson_id IS NULL;
 BEGIN
  PERFORM public.learning_save_section_questions('learning-test','learning-section','[{"id":"section-vi-1","type":"mcq","question":"bad","options":[],"correct_index":0}]','vi');
  RAISE EXCEPTION 'invalid section quiz saved';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_QUESTION_OPTIONS' THEN RAISE; END IF; END;
 SELECT jsonb_agg(to_jsonb(q) ORDER BY id) INTO after_rows FROM public.course_section_questions q WHERE section_id='learning-section' AND lesson_id IS NULL;
 IF before_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'failed section save changed rows'; END IF;
 BEGIN
  PERFORM public.learning_save_section_questions('learning-test','learning-section','[{"id":"learning-question","type":"mcq","question":"stolen","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}]','vi');
  RAISE EXCEPTION 'section save stole lesson question';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'QUESTION_SCOPE_MISMATCH' THEN RAISE; END IF; END;
 PERFORM public.learning_save_section_questions('learning-test','learning-section','[{"id":"section-vi-1","type":"mcq","question":"VI updated","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":1}]','vi');
 IF NOT EXISTS(SELECT 1 FROM public.course_section_questions WHERE id='section-vi-2' AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'section removal did not archive'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.course_section_questions WHERE id='section-vi-1' AND data->>'question'='VI updated' AND archived_at IS NULL) THEN RAISE EXCEPTION 'section stable ID update failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.course_section_questions WHERE id='section-en-1' AND archived_at IS NULL) THEN RAISE EXCEPTION 'section locale save removed another locale'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.section_question_attempts WHERE question_id='section-vi-2') THEN RAISE EXCEPTION 'section save lost historical attempt'; END IF;
END $$;
-- Remove only this isolated assertion fixture before the existing aggregate tests.
DELETE FROM public.section_question_attempts WHERE question_id='section-vi-2';
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.learning_save_section_questions('learning-test','learning-section','[]','vi');
  RAISE EXCEPTION 'learner mutated section questions';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000001',true);

-- Practice requirements must map to required course final fields on both mutation paths.
DO $$ DECLARE original jsonb; BEGIN
 SELECT data INTO original FROM public.courses WHERE id='learning-test';
 PERFORM public.learning_save_lesson('learning-test','{"id":"practice-mapping","section_id":"learning-section","published":false,"title":"Project prep","description_markdown":"Submit notes","lesson_format":"practice","practice_config":{"mode":"submission","submission_fields":["notes"]}}');
 BEGIN
   UPDATE public.course_lessons SET published=true WHERE course_id='learning-test' AND id='practice-mapping';
   RAISE EXCEPTION 'unmapped practice published';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%invalid_final_artifact_mapping%' THEN RAISE; END IF; END;
 UPDATE public.courses SET data=jsonb_set(data,'{final_assignment_fields}','["github_url","notes"]') WHERE id='learning-test';
 UPDATE public.course_lessons SET published=true WHERE course_id='learning-test' AND id='practice-mapping';
 BEGIN
   UPDATE public.courses SET data=original WHERE id='learning-test';
   RAISE EXCEPTION 'course removed field required by published practice';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%invalid_final_artifact_mapping%' THEN RAISE; END IF; END;
 UPDATE public.courses SET published=false WHERE id='learning-test';
 BEGIN
   UPDATE public.courses SET data=original WHERE id='learning-test';
   RAISE EXCEPTION 'draft course bypassed published practice mapping';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%invalid_final_artifact_mapping%' THEN RAISE; END IF; END;
 BEGIN
   UPDATE public.courses SET data=data-'final_assignment_title' WHERE id='learning-test';
   RAISE EXCEPTION 'course removed final assignment required by published practice';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%final_assignment_required%' THEN RAISE; END IF; END;
 UPDATE public.course_lessons SET published=false WHERE course_id='learning-test' AND id='practice-mapping';
 UPDATE public.courses SET data=original,published=true WHERE id='learning-test';
 DELETE FROM public.course_lessons WHERE course_id='learning-test' AND id='practice-mapping';
END $$;

-- Curriculum readiness evaluates drafts too, using publication rules.
SELECT public.learning_save_lesson('learning-test','{"id":"readiness-quiz","section_id":"learning-section","published":false,"title":"Empty quiz","lesson_format":"quiz"}','[]');
SELECT public.learning_save_lesson('learning-test','{"id":"readiness-archived","section_id":"learning-section","published":false,"archived_at":"2026-09-11T00:00:00Z","title":"Archived","lesson_format":"article"}');
DO $$ DECLARE report jsonb; errors jsonb; BEGIN
 report:=public.learning_curriculum_readiness('learning-test');
 SELECT value->'issues' INTO errors FROM jsonb_array_elements(report) WHERE value->>'lessonId'='learning-draft';
 IF errors IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION 'valid draft not ready: %',errors; END IF;
 SELECT value->'issues' INTO errors FROM jsonb_array_elements(report) WHERE value->>'lessonId'='readiness-quiz';
 IF NOT errors ? 'invalid_questions' THEN RAISE EXCEPTION 'empty quiz was marked ready: %',errors; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(report) WHERE value->>'lessonId'='readiness-archived') THEN RAISE EXCEPTION 'archived lesson in readiness'; END IF;
END $$;
UPDATE public.course_lessons SET archived_at=NULL WHERE course_id='learning-test' AND id='readiness-archived';
DELETE FROM public.course_lessons WHERE course_id='learning-test' AND id IN ('readiness-quiz','readiness-archived');

-- Section deletion is atomic, course scoped, and uses instructor content rights.
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES
 ('delete-scope-a','eeee0000-0000-4000-8000-000000000003','delete-scope-a',false,'{"title":"Delete A"}'),
 ('delete-scope-b','eeee0000-0000-4000-8000-000000000001','delete-scope-b',false,'{"title":"Delete B"}');
INSERT INTO public.course_sections(course_id,id,data) VALUES
 ('delete-scope-a','shared-section','{"title":"A"}'), ('delete-scope-b','shared-section','{"title":"B"}');
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES
 ('delete-scope-a','delete-draft','shared-section',false,'{"title":"Draft","lesson_format":"article"}'),
 ('delete-scope-a','delete-protected','shared-section',true,'{"title":"Published","lesson_format":"article","description_markdown":"Read"}'),
 ('delete-scope-b','delete-draft','shared-section',false,'{"title":"Other draft","lesson_format":"article"}');
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
 BEGIN
   PERFORM public.learning_delete_section('delete-scope-b','shared-section');
   RAISE EXCEPTION 'instructor deleted another owner section';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.learning_delete_section('delete-scope-a','shared-section');
   RAISE EXCEPTION 'section deleted published lesson';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'ARCHIVE_LESSON_REQUIRED' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.course_lessons WHERE course_id='delete-scope-a')<>2 OR NOT EXISTS(SELECT 1 FROM public.course_sections WHERE course_id='delete-scope-a' AND id='shared-section') THEN
   RAISE EXCEPTION 'failed section delete removed part of its content';
 END IF;
 UPDATE public.course_lessons SET published=false,archived_at=now() WHERE course_id='delete-scope-a' AND id='delete-protected';
 BEGIN
   PERFORM public.learning_delete_section('delete-scope-a','shared-section');
   RAISE EXCEPTION 'section deleted archived lesson';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'ARCHIVE_LESSON_REQUIRED' THEN RAISE; END IF;
 END;
 UPDATE public.course_lessons SET archived_at=NULL WHERE course_id='delete-scope-a' AND id='delete-protected';
 PERFORM public.learning_delete_section('delete-scope-a','shared-section');
 IF EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id='delete-scope-a') OR EXISTS(SELECT 1 FROM public.course_sections WHERE course_id='delete-scope-a') THEN RAISE EXCEPTION 'draft section delete incomplete'; END IF;
 BEGIN
   PERFORM public.learning_delete_section('delete-scope-a','shared-section');
   RAISE EXCEPTION 'missing section reported successful delete';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'SECTION_NOT_FOUND' THEN RAISE; END IF;
 END;
END $$;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id='delete-scope-b' AND id='delete-draft') THEN RAISE EXCEPTION 'same-ID lesson in another course was removed'; END IF;
 -- Direct deletion of a draft course also cascades through a nonempty section.
 DELETE FROM public.courses WHERE id IN ('delete-scope-a','delete-scope-b');
 IF EXISTS(SELECT 1 FROM public.course_sections WHERE course_id='delete-scope-b') OR EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id='delete-scope-b') THEN RAISE EXCEPTION 'draft course cascade incomplete'; END IF;
END $$;

-- Reporting format fallback matches the client for legacy rows without a format.
DO $$ DECLARE report jsonb; fixture record; actual text; BEGIN
 FOR fixture IN SELECT * FROM (VALUES
   ('legacy-empty','{}'::jsonb,'video'),
   ('legacy-video','{"youtube_url":"https://youtu.be/example","description_markdown":"Text"}'::jsonb,'video'),
   ('legacy-article','{"description_markdown":"Text"}'::jsonb,'article'),
   ('legacy-summary','{"short_description":"Summary"}'::jsonb,'article'),
   ('legacy-whitespace',jsonb_build_object('youtube_url',E' \n\t','description_markdown',E' \n\t'),'video'),
   ('explicit-article','{"lesson_format":"article","youtube_url":"https://youtu.be/example"}'::jsonb,'article')
 ) AS f(id,data,expected) LOOP
   INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('learning-test',fixture.id,'learning-section',false,fixture.data||'{"title":"Legacy format fixture"}');
   report:=public.learning_report('learning-test');
   SELECT value->>'format' INTO actual FROM jsonb_array_elements(report->'lessons') WHERE value->>'id'=fixture.id;
   IF actual IS DISTINCT FROM fixture.expected THEN RAISE EXCEPTION 'format mismatch for %: %',fixture.id,actual; END IF;
   DELETE FROM public.course_lessons WHERE course_id='learning-test' AND id=fixture.id;
 END LOOP;
END $$;

-- Moving the sole question away must validate the old published quiz too.
DO $$ BEGIN
 BEGIN
   UPDATE public.course_section_questions SET lesson_id='learning-draft' WHERE course_id='learning-test' AND id='learning-question';
   RAISE EXCEPTION 'question move left a published quiz empty';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE '%invalid_questions%' THEN RAISE; END IF;
 END;
 IF NOT EXISTS(SELECT 1 FROM public.course_section_questions WHERE course_id='learning-test' AND id='learning-question' AND lesson_id='learning-quiz') THEN RAISE EXCEPTION 'failed move did not roll back'; END IF;
END $$;

-- Machine-only code revisions are authoritative even on direct updates.
DO $$ DECLARE r jsonb; BEGIN
 r:=public.learning_save_lesson('learning-test','{"id":"code-revision-test","section_id":"learning-section","published":false,"title":"Code","lesson_format":"code_exercise","code_exercise_config":{"schema_version":1,"revision":99,"language":"rust","mode":"fill","file":{"path":"lib.rs","starter_source":"let {{blank:mutable}} count = 0;"},"reference_solution":"let mut count = 0;","blanks":[{"id":"mutable","accepted_answers":["mut"]}]}}');
 IF r->'data'->'code_exercise_config'->>'revision'<>'1' THEN RAISE EXCEPTION 'code initial revision is not canonical'; END IF;
 UPDATE public.course_lessons SET data=jsonb_set(data,'{code_exercise_config,hints}','["Hint copy"]') WHERE course_id='learning-test' AND id='code-revision-test';
 UPDATE public.course_lessons SET data=jsonb_set(data,'{code_exercise_config,blanks,0,feedback}','"New feedback"') WHERE course_id='learning-test' AND id='code-revision-test';
 SELECT data INTO r FROM public.course_lessons WHERE course_id='learning-test' AND id='code-revision-test';
 IF r->'code_exercise_config'->>'revision'<>'1' THEN RAISE EXCEPTION 'code display copy invalidated draft'; END IF;
 UPDATE public.course_lessons SET data=jsonb_set(data,'{code_exercise_config,blanks,0,accepted_answers}','["mut","ref"]') WHERE course_id='learning-test' AND id='code-revision-test';
 UPDATE public.course_lessons SET data=jsonb_set(data,'{code_exercise_config,revision}','999') WHERE course_id='learning-test' AND id='code-revision-test';
 SELECT data INTO r FROM public.course_lessons WHERE course_id='learning-test' AND id='code-revision-test';
 IF r->'code_exercise_config'->>'revision'<>'2' THEN RAISE EXCEPTION 'code machine change or revision spoof mishandled'; END IF;
 r:=public.learning_save_lesson('learning-test',r||'{"id":"code-revision-test","section_id":"learning-section","published":false}');
 IF r->'data'->'code_exercise_config'->>'revision'<>'2' THEN RAISE EXCEPTION 'RPC incremented unchanged code revision'; END IF;
 r:=public.learning_save_lesson('learning-test','{"id":"code-edit-revision-test","section_id":"learning-section","published":false,"title":"Edit","lesson_format":"code_exercise","code_exercise_config":{"schema_version":1,"revision":1,"language":"rust","mode":"edit","file":{"path":"lib.rs","starter_source":"fn add() {}"},"reference_solution":"fn add() { 1 + 2; }","tests":[{"id":"sum","type":"contains","value":"1 + 2","required":true,"description":"Add numbers"}]}}');
 UPDATE public.course_lessons SET data=jsonb_set(data,'{code_exercise_config,tests,0,description}','"Reworded description"') WHERE course_id='learning-test' AND id='code-edit-revision-test';
 SELECT data INTO r FROM public.course_lessons WHERE course_id='learning-test' AND id='code-edit-revision-test';
 IF r->'code_exercise_config'->>'revision'<>'1' THEN RAISE EXCEPTION 'test copy invalidated draft'; END IF;
 UPDATE public.course_lessons SET data=jsonb_set(data,'{code_exercise_config,tests,0,value}','"2 + 3"') WHERE course_id='learning-test' AND id='code-edit-revision-test';
 SELECT data INTO r FROM public.course_lessons WHERE course_id='learning-test' AND id='code-edit-revision-test';
 IF r->'code_exercise_config'->>'revision'<>'2' THEN RAISE EXCEPTION 'test rule change did not increment revision'; END IF;
 DELETE FROM public.course_lessons WHERE course_id='learning-test' AND id IN ('code-revision-test','code-edit-revision-test');
END $$;

-- Revision is canonical across RPC and direct data writes; display copy keeps local drafts.
DO $$ DECLARE r jsonb; BEGIN
 r:=public.learning_save_lesson('learning-test','{"id":"practice-revision-test","section_id":"learning-section","published":false,"title":"Practice","lesson_format":"practice","practice_config":{"mode":"checklist","revision":90,"checklist_items":[{"id":"step","label":"Run tests"}]}}');
 IF r->'data'->'practice_config'->>'revision'<>'1' THEN RAISE EXCEPTION 'initial practice revision is not canonical'; END IF;
 r:=public.learning_save_lesson('learning-test','{"id":"practice-revision-test","section_id":"learning-section","published":false,"title":"Practice renamed","lesson_format":"practice","practice_config":{"mode":"checklist","revision":91,"checklist_items":[{"id":"step","label":"Run all tests"}]}}',NULL,'{"en":{"title":"Practice English","practice_copy":{"step":{"label":"Translated label"}}}}');
 IF r->'data'->'practice_config'->>'revision'<>'1' THEN RAISE EXCEPTION 'copy edit invalidated practice draft'; END IF;
 UPDATE public.course_lessons SET data=jsonb_set(data,'{practice_config,checklist_items}','[{"id":"step","label":"Run all tests"},{"id":"second","label":"Add tests"}]') WHERE course_id='learning-test' AND id='practice-revision-test';
 SELECT data INTO r FROM public.course_lessons WHERE course_id='learning-test' AND id='practice-revision-test';
 IF r->'practice_config'->>'revision'<>'2' THEN RAISE EXCEPTION 'direct checklist change did not increment revision'; END IF;
 UPDATE public.course_lessons SET data=jsonb_set(data,'{practice_config,revision}','900') WHERE course_id='learning-test' AND id='practice-revision-test';
 SELECT data INTO r FROM public.course_lessons WHERE course_id='learning-test' AND id='practice-revision-test';
 IF r->'practice_config'->>'revision'<>'2' THEN RAISE EXCEPTION 'direct revision spoof accepted'; END IF;
 r:=public.learning_save_lesson('learning-test','{"id":"practice-revision-test","section_id":"learning-section","published":false,"title":"Practice","lesson_format":"practice","practice_config":{"mode":"guided_project","project_steps":[{"id":"step","title":"Build","instructions_markdown":"First copy","order":0,"verification":"self_check"}]}}');
 IF r->'data'->'practice_config'->>'revision'<>'3' THEN RAISE EXCEPTION 'mode change did not increment revision'; END IF;
 UPDATE public.course_lessons SET data=jsonb_set(data,'{practice_config,project_steps,0,title}','"Build the CLI"') WHERE course_id='learning-test' AND id='practice-revision-test';
 UPDATE public.course_lessons SET data=jsonb_set(data,'{practice_config,project_steps,0,instructions_markdown}','"Clarified instructions"') WHERE course_id='learning-test' AND id='practice-revision-test';
 SELECT data INTO r FROM public.course_lessons WHERE course_id='learning-test' AND id='practice-revision-test';
 IF r->'practice_config'->>'revision'<>'3' THEN RAISE EXCEPTION 'guided copy change invalidated draft'; END IF;
 UPDATE public.course_lessons SET data=jsonb_set(data,'{practice_config,submission_fields}','["github_url"]') WHERE course_id='learning-test' AND id='practice-revision-test';
 SELECT data INTO r FROM public.course_lessons WHERE course_id='learning-test' AND id='practice-revision-test';
 IF r->'practice_config'->>'revision'<>'4' THEN RAISE EXCEPTION 'artifact requirements did not increment revision'; END IF;
 DELETE FROM public.course_lessons WHERE course_id='learning-test' AND id='practice-revision-test';
END $$;

-- Reconstruct pre-enforcement rows only during fixture setup. All checks below
-- run with normal triggers and instructor/admin RLS enabled.
RESET ROLE;
SET LOCAL session_replication_role=replica;
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES
 ('learning-test','legacy-invalid-practice','learning-section',false,'{"title":"Legacy practice","lesson_format":"practice","description_markdown":"Instructions","practice_config":{"mode":"checklist","checklist_items":{}}}'),
 ('learning-test','legacy-invalid-code','learning-section',true,'{"title":"Legacy code","lesson_format":"code_exercise","code_exercise_config":{}}'),
 ('learning-test','legacy-invalid-shape','learning-section',true,'{"title":"Legacy article","lesson_format":"article","description_markdown":"Read","resources":null}');
SET LOCAL session_replication_role=origin;
SET LOCAL ROLE authenticated;
DO $$ DECLARE report jsonb; issues jsonb; BEGIN
 report:=public.learning_curriculum_readiness('learning-test');
 SELECT value->'issues' INTO issues FROM jsonb_array_elements(report) WHERE value->>'lessonId'='legacy-invalid-practice';
 IF issues IS DISTINCT FROM '["invalid_config"]'::jsonb THEN RAISE EXCEPTION 'malformed practice diagnostic missing: %',issues; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(report) WHERE value->>'lessonId'='learning-quiz') THEN RAISE EXCEPTION 'malformed row hid valid lesson readiness'; END IF;
 BEGIN
   UPDATE public.course_lessons SET published=true WHERE course_id='learning-test' AND id='legacy-invalid-practice';
   RAISE EXCEPTION 'malformed practice was published';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'INVALID_PRACTICE_CONFIG' THEN RAISE; END IF;
 END;
 DELETE FROM public.course_lessons WHERE course_id='learning-test' AND id='legacy-invalid-practice';
END $$;
DO $$ DECLARE d jsonb; BEGIN
 SELECT data INTO d FROM public.course_lessons WHERE course_id='learning-test' AND id='legacy-invalid-code';
 UPDATE public.course_lessons SET published=false,archived_at=now() WHERE course_id='learning-test' AND id='legacy-invalid-code';
 IF (SELECT data FROM public.course_lessons WHERE course_id='learning-test' AND id='legacy-invalid-code') IS DISTINCT FROM d THEN RAISE EXCEPTION 'archive rewrote legacy code'; END IF;
 UPDATE public.course_lessons SET archived_at=NULL WHERE course_id='learning-test' AND id='legacy-invalid-code';
 BEGIN
   UPDATE public.course_lessons SET published=true WHERE course_id='learning-test' AND id='legacy-invalid-code';
   RAISE EXCEPTION 'legacy code republished invalid';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'INVALID_CODE_CONFIG:%' THEN RAISE; END IF;
 END;
 BEGIN
   UPDATE public.course_lessons SET data=data||'{"title":"Changed but still malformed"}' WHERE course_id='learning-test' AND id='legacy-invalid-code';
   RAISE EXCEPTION 'invalid changed draft saved';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'INVALID_CODE_CONFIG:%' THEN RAISE; END IF;
 END;
 -- Explicit recovery uses the same authoring RPC as the instructor editor.
 PERFORM public.learning_save_lesson('learning-test',d||'{"id":"legacy-invalid-code","section_id":"learning-section","published":false,"code_exercise_config":{"schema_version":1,"revision":1,"language":"rust","mode":"fill","file":{"path":"lib.rs","starter_source":"let {{blank:mutable}} count = 0;"},"reference_solution":"let mut count = 0;","blanks":[{"id":"mutable","accepted_answers":["mut"]}]}}');
 IF (SELECT published OR data->>'title' IS DISTINCT FROM d->>'title' OR data#>>'{code_exercise_config,revision}' IS DISTINCT FROM '2' FROM public.course_lessons WHERE course_id='learning-test' AND id='legacy-invalid-code') THEN RAISE EXCEPTION 'legacy code recovery lost metadata, published, or reused revision'; END IF;
 UPDATE public.course_lessons SET published=false,archived_at=now() WHERE course_id='learning-test' AND id='legacy-invalid-shape';
 UPDATE public.course_lessons SET archived_at=NULL WHERE course_id='learning-test' AND id='legacy-invalid-shape';
 BEGIN
   UPDATE public.course_lessons SET published=true WHERE course_id='learning-test' AND id='legacy-invalid-shape';
   RAISE EXCEPTION 'malformed resource republished';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'INVALID_RESOURCES' THEN RAISE; END IF;
 END;
 UPDATE public.course_lessons SET data=data-'resources' WHERE course_id='learning-test' AND id='legacy-invalid-shape';
 UPDATE public.course_lessons SET published=true WHERE course_id='learning-test' AND id='legacy-invalid-shape';
 UPDATE public.course_lessons SET published=false WHERE course_id='learning-test' AND id='legacy-invalid-shape';
 DELETE FROM public.course_lessons WHERE course_id='learning-test' AND id IN ('legacy-invalid-code','legacy-invalid-shape');
END $$;

-- Direct writes and publication of a draft must validate master and all locale resources.
DO $$ BEGIN
 BEGIN
   UPDATE public.course_lessons SET data=data||'{"resources":[{"title":"","url":"https://example.com"}]}' WHERE course_id='learning-test' AND id='learning-quiz';
   RAISE EXCEPTION 'published resource title bypass';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE '%resource_title_required%' THEN RAISE; END IF;
 END;
 BEGIN
   UPDATE public.course_lesson_locales SET data=data||'{"resources":[{"title":"English link","url":""}]}' WHERE course_id='learning-test' AND lesson_id='learning-quiz' AND locale='en';
   RAISE EXCEPTION 'published locale URL bypass';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE '%resource_url_invalid%' THEN RAISE; END IF;
 END;
 UPDATE public.course_lessons SET data=data||'{"resources":[{"title":"","url":""}]}' WHERE course_id='learning-test' AND id='learning-draft';
 BEGIN
   UPDATE public.course_lessons SET published=true WHERE course_id='learning-test' AND id='learning-draft';
   RAISE EXCEPTION 'draft published with incomplete resource';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE '%resource_title_required%' THEN RAISE; END IF;
 END;
 UPDATE public.course_lessons SET data=data-'resources' WHERE course_id='learning-test' AND id='learning-draft';
 INSERT INTO public.course_lesson_locales(course_id,lesson_id,locale,data) VALUES('learning-test','learning-draft','en','{"title":"Draft English","resources":[{"title":"English link","url":""}]}');
 BEGIN
   UPDATE public.course_lessons SET published=true WHERE course_id='learning-test' AND id='learning-draft';
   RAISE EXCEPTION 'draft published with previously saved invalid locale';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE '%resource_url_invalid%' THEN RAISE; END IF;
 END;
 UPDATE public.course_lesson_locales SET data=data||'{"resources":[{"title":"English link","url":"https://example.com/reference"}]}' WHERE course_id='learning-test' AND lesson_id='learning-draft' AND locale='en';
 UPDATE public.course_lessons SET published=true WHERE course_id='learning-test' AND id='learning-draft';
 UPDATE public.course_lessons SET published=false WHERE course_id='learning-test' AND id='learning-draft';
END $$;
RESET ROLE;

-- No-retry attempts in one course must not block a different course with the same lesson ID.
SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES('retry-scope-a','eeee0000-0000-4000-8000-000000000003','retry-scope-a',false,'{"title":"Retry scope"}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('retry-scope-a','section','{"title":"Section"}');
SELECT public.learning_save_lesson('retry-scope-a','{"id":"shared-quiz","section_id":"section","published":true,"title":"Quiz","lesson_format":"quiz","quiz_config":{"allow_retry":false}}','[{"id":"retry-scope-a-q","order":0,"type":"mcq","question":"Pick A","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}]');
UPDATE public.courses SET published=true WHERE id='retry-scope-a';
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES('retry-scope-b','eeee0000-0000-4000-8000-000000000003','retry-scope-b',false,'{"title":"Retry scope"}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('retry-scope-b','section','{"title":"Section"}');
SELECT public.learning_save_lesson('retry-scope-b','{"id":"shared-quiz","section_id":"section","published":true,"title":"Quiz","lesson_format":"quiz","quiz_config":{"allow_retry":false}}','[{"id":"retry-scope-b-q","order":0,"type":"mcq","question":"Pick A","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}]');
UPDATE public.courses SET published=true WHERE id='retry-scope-b';
SET CONSTRAINTS ALL IMMEDIATE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.learning_quiz_submit('retry-scope-a','shared-quiz',gen_random_uuid(),'{"retry-scope-a-q":0}');
 IF r->>'passed'<>'true' THEN RAISE EXCEPTION 'first course quiz failed'; END IF;
 r:=public.learning_quiz_submit('retry-scope-b','shared-quiz',gen_random_uuid(),'{"retry-scope-b-q":0}');
 IF r->>'passed'<>'true' THEN RAISE EXCEPTION 'second course blocked by unrelated attempts'; END IF;
 BEGIN
  PERFORM public.learning_quiz_submit('retry-scope-b','shared-quiz',gen_random_uuid(),'{"retry-scope-b-q":0}');
  RAISE EXCEPTION 'same-course retry bypassed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'RETRY_DISABLED' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE public.courses SET published=false WHERE id IN ('retry-scope-a','retry-scope-b');
DELETE FROM public.section_question_attempts WHERE course_id IN ('retry-scope-a','retry-scope-b');
DELETE FROM public.lesson_progress WHERE course_id IN ('retry-scope-a','retry-scope-b');
DELETE FROM public.enrollments WHERE course_id IN ('retry-scope-a','retry-scope-b');
UPDATE public.course_lessons SET published=false WHERE course_id IN ('retry-scope-a','retry-scope-b');
DELETE FROM public.course_lessons WHERE course_id IN ('retry-scope-a','retry-scope-b');
DELETE FROM public.courses WHERE id IN ('retry-scope-a','retry-scope-b');

SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
 PERFORM public.learning_event('learning-other','learning-quiz','lesson_started');
 PERFORM public.learning_event('learning-test','learning-quiz','lesson_started');
 PERFORM public.learning_event('learning-test','learning-quiz','lesson_started');
 INSERT INTO public.lesson_progress(id,user_id,course_id,lesson_id,completed_at) VALUES('other-completion',auth.uid(),'learning-other','learning-quiz',now());
 BEGIN
   PERFORM public.learning_curriculum_readiness('learning-test');
   RAISE EXCEPTION 'learner read content readiness';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.learning_report('learning-test');
   RAISE EXCEPTION 'learner read private report';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.course_lessons WHERE id='learning-draft') THEN RAISE EXCEPTION 'draft leaked'; END IF;
 BEGIN
   INSERT INTO public.lesson_progress(id,user_id,course_id,lesson_id,completed_at) VALUES('bypass','eeee0000-0000-4000-8000-000000000002','learning-test','learning-quiz',now());
   RAISE EXCEPTION 'quiz completion bypassed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 r:=public.learning_quiz_submit('learning-test','learning-quiz','eeee1111-0000-4000-8000-000000000001','{"learning-question":1}');
 IF (r->>'completed')::boolean THEN RAISE EXCEPTION 'failed result claimed completion'; END IF;
 IF (r->>'passed')::boolean THEN RAISE EXCEPTION 'wrong answer passed'; END IF;
 IF EXISTS(SELECT 1 FROM public.lesson_progress WHERE course_id='learning-test' AND lesson_id='learning-quiz' AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'failed quiz completed'; END IF;
 r:=public.learning_quiz_submit('learning-test','learning-quiz','eeee1111-0000-4000-8000-000000000002','{"learning-question":0}');
 IF NOT (r->>'passed')::boolean THEN RAISE EXCEPTION 'correct answer failed'; END IF;
 PERFORM public.learning_quiz_submit('learning-test','learning-quiz','eeee1111-0000-4000-8000-000000000002','{"learning-question":0}');
 IF (SELECT count(*) FROM public.section_question_attempts WHERE lesson_id='learning-quiz')<>2 THEN RAISE EXCEPTION 'duplicate attempt'; END IF;
 IF EXISTS(SELECT 1 FROM public.enrollments WHERE course_id='learning-test' AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'completed before final review'; END IF;
 -- Required artifacts are sufficient; legacy text remains optional for this course.
 r:=public.learning_final_submit('learning-test','','[]','{"github_url":"https://github.com/example/project"}','eeee2222-0000-4000-8000-000000000001');
 IF r->>'content' IS DISTINCT FROM '' OR r->>'status'<>'pending' THEN RAISE EXCEPTION 'artifact-only submission failed'; END IF;
 BEGIN
   PERFORM public.learning_final_review('eeee2222-0000-4000-8000-000000000001','approved',NULL);
   RAISE EXCEPTION 'self review allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; l jsonb; BEGIN
 r:=public.learning_report('learning-test');
 SELECT value INTO l FROM jsonb_array_elements(r->'lessons') WHERE value->>'id'='learning-quiz';
 IF (r->>'started')::int<>1 OR (l->>'started')::int<>1 OR (l->>'completed')::int<>1 OR (l->>'dropoff')::int<>0 OR (l->>'quiz_attempts')::int<>2 OR (l->>'quiz_passes')::int<>1 THEN RAISE EXCEPTION 'course report counts incorrect: %',r; END IF;
 BEGIN
  PERFORM public.learning_report('learning-other');
  RAISE EXCEPTION 'instructor read another course report';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
DO $$ BEGIN
 PERFORM public.learning_save_lesson('learning-test','{"id":"learning-draft","section_id":"learning-section","order":1,"published":false,"title":"Instructor edited draft","lesson_format":"article","description_markdown":"draft"}');
 IF NOT EXISTS(SELECT 1 FROM public.final_assignment_submissions WHERE course_id='learning-test') THEN RAISE EXCEPTION 'instructor cannot read own course submissions'; END IF;
 PERFORM public.learning_final_review('eeee2222-0000-4000-8000-000000000001','rejected','Add persistence tests');
 IF EXISTS(SELECT 1 FROM public.enrollments WHERE course_id='learning-test' AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'rejected final completed course'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.learning_final_submit('learning-test','Revised project','[]','{"github_url":"https://github.com/example/project"}','eeee2222-0000-4000-8000-000000000002');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.final_assignment_submissions WHERE course_id='learning-test')<>2 THEN RAISE EXCEPTION 'resubmission lost history'; END IF;
 IF EXISTS(SELECT 1 FROM public.enrollments WHERE course_id='learning-test' AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'pending resubmission completed course'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.learning_final_review('eeee2222-0000-4000-8000-000000000001','approved','Stale');
  RAISE EXCEPTION 'stale submission approved';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'STALE_SUBMISSION' THEN RAISE; END IF; END;
 PERFORM public.learning_final_review('eeee2222-0000-4000-8000-000000000002','approved','Instructor reviewed');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.learning_final_review('eeee2222-0000-4000-8000-000000000002','approved','Good');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.enrollments WHERE course_id='learning-test' AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'approval did not complete'; END IF;
END $$;
DO $$ DECLARE completed_before timestamptz; BEGIN
 SELECT completed_at INTO completed_before FROM public.enrollments WHERE course_id='learning-test';
 -- Repeated approval preserves completion and review history.
 PERFORM public.learning_final_review('eeee2222-0000-4000-8000-000000000002','approved','Repeated');
 IF (SELECT completed_at FROM public.enrollments WHERE course_id='learning-test') IS DISTINCT FROM completed_before THEN RAISE EXCEPTION 'completion timestamp changed'; END IF;
 BEGIN
   UPDATE public.course_section_questions SET data=jsonb_set(data,'{question}','""') WHERE id='learning-question';
   RAISE EXCEPTION 'invalid published question saved';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'LESSON_NOT_PUBLISHABLE:%' THEN RAISE; END IF;
 END;
 BEGIN
   DELETE FROM public.course_section_questions WHERE id='learning-question';
   RAISE EXCEPTION 'question attempt history deleted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'ARCHIVE_QUESTION_REQUIRED%' THEN RAISE; END IF;
 END;
 BEGIN
   UPDATE public.course_lessons SET data=jsonb_set(data,'{practice_config}','{"mode":"checklist","checklist_items":false}') WHERE id='learning-draft';
   RAISE EXCEPTION 'malformed practice draft saved';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'INVALID_PRACTICE_CONFIG%' THEN RAISE; END IF;
 END;
 BEGIN
   INSERT INTO public.course_lesson_locales(course_id,lesson_id,locale,data) VALUES('learning-test','learning-draft','en','{"quiz_config":{"passing_ratio":0.01}}');
   RAISE EXCEPTION 'locale changed machine config';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT LIKE 'LOCALE_MACHINE_CONFIG_FORBIDDEN%' THEN RAISE; END IF;
 END;
 UPDATE public.course_lessons SET archived_at=now() WHERE id='learning-quiz';
 IF (SELECT completed_at FROM public.enrollments WHERE course_id='learning-test') IS DISTINCT FROM completed_before THEN RAISE EXCEPTION 'archive revoked historical completion'; END IF;
 IF (SELECT count(*) FROM public.section_question_attempts WHERE lesson_id='learning-quiz')<>2 THEN RAISE EXCEPTION 'archive erased attempts'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT private.can_manage_course('learning-test',auth.uid()) THEN RAISE EXCEPTION 'instructor lost own course permission'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.section_question_attempts WHERE course_id='learning-test') THEN RAISE EXCEPTION 'instructor cannot inspect own course attempts'; END IF;
END $$;
RESET ROLE;
-- Narrow roster access: student operators versus submission-only reviewers.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('eeee0000-0000-4000-8000-000000000004','learning-reviewer@corelia.local','{"full_name":"Learning Reviewer"}');
UPDATE public.profiles SET role='instructor' WHERE id='eeee0000-0000-4000-8000-000000000004';
INSERT INTO public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at) VALUES('roster-enrolled-only','eeee0000-0000-4000-8000-000000000001','learning-test',now(),now());
UPDATE public.courses SET published=false,
 data=jsonb_set(data,'{co_instructor_permissions}','{"eeee0000-0000-4000-8000-000000000004":{"submissions":true}}')
 WHERE id='learning-test';
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.learning_course_roster('learning-test'))<>2 THEN RAISE EXCEPTION 'owner roster missing participants'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_course_roster('learning-test') WHERE full_name='Learning User' AND email='learning-user@corelia.local') THEN RAISE EXCEPTION 'owner cannot identify learner'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id='eeee0000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'roster widened private profiles RLS'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.courses WHERE id='learning-test') THEN RAISE EXCEPTION 'review-only operator lost draft course access'; END IF;
 IF (SELECT count(*) FROM public.learning_course_roster('learning-test'))<>1 THEN RAISE EXCEPTION 'reviewer saw participants without submissions'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_course_roster('learning-test') WHERE full_name='Learning User' AND email IS NULL AND progress_percent=0) THEN RAISE EXCEPTION 'reviewer roster exposed email or counted archived lesson'; END IF;
 IF EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id='learning-test') THEN RAISE EXCEPTION 'reviewer read draft lesson content'; END IF;
 UPDATE public.courses SET data=jsonb_set(data,'{title}','"Unauthorized"') WHERE id='learning-test';
 IF FOUND THEN RAISE EXCEPTION 'reviewer mutated root course'; END IF;
 BEGIN
  PERFORM public.learning_course_roster('learning-other');
  RAISE EXCEPTION 'reviewer read unrelated roster';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Content-only co-instructors cannot inspect the learning roster.
UPDATE public.courses SET data=jsonb_set(data,'{co_instructor_permissions}','{"eeee0000-0000-4000-8000-000000000004":{"content":true}}') WHERE id='learning-test';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.learning_course_roster('learning-test');
  RAISE EXCEPTION 'content permission granted roster access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','eeee0000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.learning_course_roster('learning-test');
  RAISE EXCEPTION 'learner read course roster';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Archive/restore is reversible and never deletes historical learning data.
UPDATE public.courses SET archived_at=now(),published=false WHERE id='learning-test';
DO $$ BEGIN
 BEGIN
  DELETE FROM public.courses WHERE id='learning-test';
  RAISE EXCEPTION 'course with history deleted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ARCHIVE_COURSE_REQUIRED' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM public.enrollments WHERE course_id='learning-test' AND user_id='eeee0000-0000-4000-8000-000000000002' AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'archive lost completion'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.courses WHERE id='learning-test') THEN RAISE EXCEPTION 'archived course public'; END IF;
END $$;
RESET ROLE;
UPDATE public.courses SET archived_at=NULL,published=false WHERE id='learning-test';
UPDATE public.course_lessons SET archived_at=NULL,published=false WHERE course_id='learning-test' AND id='learning-quiz';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.section_question_attempts WHERE course_id='learning-test')<>2 THEN RAISE EXCEPTION 'restore lost attempts'; END IF;
 IF private.learning_lesson_visible('learning-test','learning-quiz') THEN RAISE EXCEPTION 'restored draft became public'; END IF;
END $$;
-- Identical lesson and section IDs in another course must not borrow history.
INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES('learning-delete-draft','eeee0000-0000-4000-8000-000000000003','learning-delete-draft',false,'{"title":"Disposable draft"}');
INSERT INTO public.course_sections(course_id,id,data) VALUES('learning-delete-draft','learning-section','{"title":"Draft section"}');
INSERT INTO public.course_lessons(course_id,id,section_id,published,data) VALUES('learning-delete-draft','learning-quiz','learning-section',false,'{"title":"Empty draft","lesson_format":"article"}');
DELETE FROM public.course_lessons WHERE course_id='learning-delete-draft' AND id='learning-quiz';
DELETE FROM public.course_sections WHERE course_id='learning-delete-draft' AND id='learning-section';
UPDATE public.courses SET archived_at=now() WHERE id='learning-delete-draft';
DO $$ BEGIN
 BEGIN
  DELETE FROM public.courses WHERE id='learning-delete-draft';
  RAISE EXCEPTION 'archived record hard deleted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ARCHIVE_COURSE_REQUIRED' THEN RAISE; END IF; END;
END $$;
UPDATE public.courses SET archived_at=NULL WHERE id='learning-delete-draft';
DELETE FROM public.courses WHERE id='learning-delete-draft';
-- Reminder service sees available learning only; no emails are sent by this test.
RESET ROLE;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('eeee0000-0000-4000-8000-000000000090','learning-reminder@corelia.local','{"full_name":"Reminder Learner"}');
INSERT INTO public.courses(id,instructor_id,slug,published,data)
SELECT 'reminder-'||kind,'eeee0000-0000-4000-8000-000000000003','reminder-'||kind,false,'{"title":"Reminder fixture"}'::jsonb
FROM unnest(ARRAY['available','draft','archived','lesson-draft','lesson-archived','completed']) kind;
INSERT INTO public.course_sections(course_id,id,data)
SELECT id,'section','{"title":"Section"}'::jsonb FROM public.courses WHERE id LIKE 'reminder-%';
INSERT INTO public.course_lessons(course_id,id,section_id,published,data)
SELECT id,'lesson','section',true,'{"title":"Article","lesson_format":"article","description_markdown":"Read"}'::jsonb FROM public.courses WHERE id LIKE 'reminder-%';
UPDATE public.courses SET published=true WHERE id LIKE 'reminder-%';
INSERT INTO public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at,completed_at)
SELECT 'reminder-enrollment-'||id,'eeee0000-0000-4000-8000-000000000090',id,now()-interval '10 days',
  CASE WHEN id='reminder-available' THEN now()-interval '4 days' ELSE now() END,
  NULL
FROM public.courses WHERE id LIKE 'reminder-%';
INSERT INTO public.lesson_progress(id,user_id,course_id,lesson_id,completed_at)
VALUES('reminder-completed-progress','eeee0000-0000-4000-8000-000000000090','reminder-completed','lesson',now());
UPDATE public.courses SET published=false WHERE id='reminder-draft';
UPDATE public.courses SET archived_at=now() WHERE id='reminder-archived';
UPDATE public.course_lessons SET published=false WHERE course_id='reminder-lesson-draft';
UPDATE public.course_lessons SET archived_at=now() WHERE course_id='reminder-lesson-archived';
SET LOCAL ROLE service_role;
DO $$ DECLARE candidate record; BEGIN
 SELECT * INTO candidate FROM public.get_learning_reminder_candidates() WHERE user_id='eeee0000-0000-4000-8000-000000000090';
 IF NOT FOUND OR candidate.stage<>3 OR candidate.days_inactive<>4
   OR jsonb_array_length(candidate.in_progress_courses)<>1
   OR candidate.in_progress_courses->0->>'id'<>'reminder-available' THEN
   RAISE EXCEPTION 'reminder included unavailable/completed curriculum or its recent activity';
 END IF;
END $$;
RESET ROLE;
INSERT INTO public.notification_preferences(user_id,email_learning_reminders)
VALUES('eeee0000-0000-4000-8000-000000000090',false)
ON CONFLICT(user_id) DO UPDATE SET email_learning_reminders=false;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.get_learning_reminder_candidates() WHERE user_id='eeee0000-0000-4000-8000-000000000090') THEN RAISE EXCEPTION 'reminder ignored opt out'; END IF;
END $$;
UPDATE public.notification_preferences SET email_learning_reminders=true WHERE user_id='eeee0000-0000-4000-8000-000000000090';
INSERT INTO public.learning_reminder_logs(user_id,stage,sent_at) VALUES('eeee0000-0000-4000-8000-000000000090',3,now());
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.get_learning_reminder_candidates() WHERE user_id='eeee0000-0000-4000-8000-000000000090') THEN RAISE EXCEPTION 'reminder ignored cycle suppression'; END IF;
END $$;
-- Requires a patched local image: 17.6.1.111 crashes on denied EXECUTE
-- (supabase/postgres#2112). Exercise the actual roles without changing ACLs.
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.get_learning_reminder_candidates()','EXECUTE')
   OR has_function_privilege('anon','public.get_learning_reminder_candidates()','EXECUTE')
   OR has_function_privilege('authenticated','private.get_learning_reminder_candidates()','EXECUTE')
   OR has_function_privilege('anon','private.get_learning_reminder_candidates()','EXECUTE') THEN
   RAISE EXCEPTION 'reminder service ACL exposed';
 END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.get_learning_reminder_candidates();
  RAISE EXCEPTION 'learner read reminder service data';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM public.get_learning_reminder_candidates();
  RAISE EXCEPTION 'anonymous read reminder service data';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
