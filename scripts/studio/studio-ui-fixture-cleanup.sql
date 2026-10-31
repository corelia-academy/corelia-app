-- Paired cleanup for studio-ui-fixture.sql. The runner pins execution to the disposable clone.
BEGIN;
DELETE FROM public.studio_courses
WHERE left(title, length('__studio_ui_fixture__:' || :'fixture_key' || ':'))
  = '__studio_ui_fixture__:' || :'fixture_key' || ':';
DELETE FROM public.studio_paths
WHERE slug = 'studio-ui-fixture-' || :'fixture_key';
COMMIT;
