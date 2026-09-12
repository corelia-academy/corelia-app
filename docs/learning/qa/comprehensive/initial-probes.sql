-- Read-only validator probes. No application data changes.
BEGIN READ ONLY;
SELECT 'master_text_type' AS probe, private.learning_lesson_errors('probe',
 '{"title":42,"lesson_format":"article","description_markdown":true}','probe') AS errors;
SELECT 'duplicate_checklist_id' AS probe, private.learning_lesson_errors('probe',
 '{"title":"P","lesson_format":"practice","description_markdown":"P","practice_config":{"mode":"checklist","checklist_items":[{"id":"same","label":"a"},{"id":"same","label":"b"}]}}','probe') AS errors;
SELECT 'threshold_0_005' AS probe, private.learning_lesson_errors('probe',
 '{"title":"Q","lesson_format":"quiz","quiz_config":{"passing_ratio":0.005}}','probe') AS errors;
ROLLBACK;
-- Local pilot only: transactional probes always roll back.
BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM auth.users WHERE email='learning-qa-learner@corelia.local'),true) IS NOT NULL AS local_actor_set;
SET LOCAL ROLE authenticated;
WITH changed AS (UPDATE public.courses SET data=data WHERE id='corelia-learning-pilot-rust-cli' RETURNING id)
 SELECT 'unauthorized_course_update' AS probe,count(*) AS rows_changed FROM changed;
ROLLBACK;
BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM auth.users WHERE email='learning-qa-instructor@corelia.local'),true) IS NOT NULL AS local_actor_set;
SELECT 'malformed_final_payload' AS probe, public.learning_final_submit(
 'corelia-learning-pilot-rust-cli','audit probe','[{"bad":"file"}]'::jsonb,
 '{"github_url":"https:///","notes":{"bad":"note"}}'::jsonb,gen_random_uuid())->>'status' AS result;
ROLLBACK;
