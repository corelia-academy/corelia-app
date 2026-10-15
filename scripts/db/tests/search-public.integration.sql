DO $test$
DECLARE
  actor uuid := gen_random_uuid();
  accented uuid := gen_random_uuid();
  plain uuid := gen_random_uuid();
  percent uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id) VALUES(actor);
  INSERT INTO public.projects(id,owner_id,slug,title,source_type,visibility) VALUES
    (accented,actor,'search-qa-accented','Khóa học tìm kiếm Zqxv','standalone','public'),
    (plain,actor,'search-qa-plain','Zqxv plain project','standalone','public'),
    (percent,actor,'search-qa-percent','Zqxv 100% done','standalone','public');

  IF NOT EXISTS(SELECT 1 FROM public.search_public('khoa hoc tim kiem zqxv',50,0) WHERE entity_id=accented::text) THEN
    RAISE EXCEPTION 'unaccented query did not match accented title';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.search_public('KHOÁ HỌC tìm kiếm zqxv',50,0) WHERE entity_id=accented::text) THEN
    RAISE EXCEPTION 'alternate tone placement did not match accented title';
  END IF;

  IF EXISTS(SELECT 1 FROM public.search_public('%',50,0) WHERE entity_id IN (accented::text,plain::text)) THEN
    RAISE EXCEPTION 'percent wildcard matched titles without a percent sign';
  END IF;
  IF EXISTS(SELECT 1 FROM public.search_public('_',50,0) WHERE entity_id IN (accented::text,plain::text,percent::text)) THEN
    RAISE EXCEPTION 'underscore wildcard matched titles without an underscore';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.search_public('zqxv 100%',50,0) WHERE entity_id=percent::text) THEN
    RAISE EXCEPTION 'literal percent query did not match';
  END IF;

  IF (SELECT href FROM public.search_public('zqxv plain',50,0) WHERE entity_id=plain::text) IS DISTINCT FROM '/projects/search-qa-plain' THEN
    RAISE EXCEPTION 'project result does not link to its detail page';
  END IF;

  DELETE FROM public.projects WHERE id IN (accented,plain,percent);
  DELETE FROM auth.users WHERE id=actor;
END;
$test$;
