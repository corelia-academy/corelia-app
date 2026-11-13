-- public.blog_posts: everyone reads published articles, only admin/support staff read
-- drafts and write; editor uploads to cdn/blog/ are staff-only.
-- Single statement for `supabase db query`; the fixtures roll back via a sentinel.
DO $$
DECLARE
  learner constant uuid := 'b1090000-0000-4000-8000-000000000001';
  staff constant uuid := 'b1090000-0000-4000-8000-000000000002';
  affected integer;
BEGIN
  BEGIN
    INSERT INTO auth.users(id,email) VALUES
      (learner,'blog-learner@corelia.local'),
      (staff,'blog-staff@corelia.local');
    UPDATE public.profiles SET role='admin' WHERE id=staff;
    INSERT INTO public.blog_posts(locale,slug,translation_key,status,title,category,body) VALUES
      ('en','blog-test-published','blog-test-published','published','Published','announcements-events','one two  three'),
      ('en','blog-test-draft','blog-test-draft','draft','Draft','announcements-events','');

    IF (SELECT word_count FROM public.blog_posts WHERE slug='blog-test-published') <> 3
       OR (SELECT word_count FROM public.blog_posts WHERE slug='blog-test-draft') <> 0 THEN
      RAISE EXCEPTION 'word_count is not derived from the body';
    END IF;

    -- Signed-out visitors (the landing): published rows only, no writes.
    SET LOCAL ROLE anon;
    IF (SELECT count(*) FROM public.blog_posts WHERE slug LIKE 'blog-test-%') <> 1 THEN
      RAISE EXCEPTION 'anon must see exactly the published article';
    END IF;
    BEGIN
      INSERT INTO public.blog_posts(locale,slug,translation_key,title,category)
      VALUES ('en','blog-test-anon','blog-test-anon','x','announcements-events');
      RAISE EXCEPTION 'anon inserted an article';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;

    -- A signed-in learner: same visibility, and writes change nothing.
    PERFORM set_config('request.jwt.claims', json_build_object('sub',learner,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    IF (SELECT count(*) FROM public.blog_posts WHERE slug LIKE 'blog-test-%') <> 1 THEN
      RAISE EXCEPTION 'a learner must not see drafts';
    END IF;
    BEGIN
      INSERT INTO public.blog_posts(locale,slug,translation_key,title,category)
      VALUES ('en','blog-test-learner','blog-test-learner','x','announcements-events');
      RAISE EXCEPTION 'a learner inserted an article';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    UPDATE public.blog_posts SET title='changed' WHERE slug='blog-test-published';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'a learner updated an article'; END IF;
    DELETE FROM public.blog_posts WHERE slug='blog-test-published';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN RAISE EXCEPTION 'a learner deleted an article'; END IF;
    BEGIN
      INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('cdn','blog/learner.png',learner);
      RAISE EXCEPTION 'a learner uploaded to cdn/blog';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;

    -- Staff: drafts, writes and uploads.
    PERFORM set_config('request.jwt.claims', json_build_object('sub',staff,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    IF (SELECT count(*) FROM public.blog_posts WHERE slug LIKE 'blog-test-%') <> 2 THEN
      RAISE EXCEPTION 'staff must see drafts';
    END IF;
    INSERT INTO public.blog_posts(locale,slug,translation_key,title,category)
    VALUES ('vi','blog-test-published','blog-test-published','Bản dịch','announcements-events');
    UPDATE public.blog_posts SET status='published' WHERE slug='blog-test-draft';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'staff could not publish a draft'; END IF;
    BEGIN
      INSERT INTO public.blog_posts(locale,slug,translation_key,title,category)
      VALUES ('en','blog-test-published','blog-test-other','x','announcements-events');
      RAISE EXCEPTION 'a slug was reused within one language';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO public.blog_posts(locale,slug,translation_key,title,category)
      VALUES ('en','blog-test-other','blog-test-published','x','announcements-events');
      RAISE EXCEPTION 'a translation key got two articles in one language';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('cdn','blog/staff.png',staff);
    DELETE FROM public.blog_posts WHERE slug='blog-test-draft';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'staff could not delete an article'; END IF;
    RESET ROLE;

    RAISE EXCEPTION 'blog-posts: rollback fixtures';
  EXCEPTION WHEN raise_exception THEN
    RESET ROLE;
    IF SQLERRM <> 'blog-posts: rollback fixtures' THEN RAISE; END IF;
  END;
END $$;
