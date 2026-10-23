-- public.promote_public_media_to_cdn(): rewrites stored signed `app` URLs to the
-- permanent `cdn` URL only once the `cdn` copy exists; service-role only.
-- Single statement for `supabase db query`; the fixtures roll back via a sentinel.
DO $$
DECLARE
  first_run integer;
BEGIN
  BEGIN
    INSERT INTO auth.users(id,email) VALUES
      ('dddd5555-0000-4000-8000-000000000001','public-media@corelia.local');
    INSERT INTO public.courses(id,instructor_id,slug,published,data) VALUES
      ('media-copied','dddd5555-0000-4000-8000-000000000001','media-copied',false,
       '{"title":"Copied","thumbnail_url":"http://127.0.0.1:54321/storage/v1/object/sign/app/course-thumbnails/media-copied/a.png?token=t","thumbnail_path":"course-thumbnails/media-copied/a.png"}'),
      ('media-pending','dddd5555-0000-4000-8000-000000000001','media-pending',false,
       '{"title":"Pending","thumbnail_url":"http://127.0.0.1:54321/storage/v1/object/sign/app/course-thumbnails/media-pending/b.png?token=t","thumbnail_path":"course-thumbnails/media-pending/b.png"}'),
      ('media-external','dddd5555-0000-4000-8000-000000000001','media-external',false,
       '{"title":"External","thumbnail_url":"https://images.example.com/c.png","thumbnail_path":"course-thumbnails/media-external/c.png"}');
    INSERT INTO public.hackathons(id,status,document) VALUES
      ('media-hackathon','draft',
       '{"title":"Hackathon","cover_image_url":"http://127.0.0.1:54321/storage/v1/object/sign/app/contest-banners/media-hackathon/1.png?token=t","cover_image_path":"contest-banners/media-hackathon/1.png","thumbnail_url":"http://127.0.0.1:54321/storage/v1/object/sign/app/contest-thumbnails/media-hackathon/2.png?token=t","thumbnail_path":"contest-thumbnails/media-hackathon/2.png"}');
    INSERT INTO storage.objects(bucket_id,name) VALUES
      ('cdn','course-thumbnails/media-copied/a.png'),
      ('cdn','course-thumbnails/media-external/c.png'),
      ('cdn','contest-banners/media-hackathon/1.png'),
      ('cdn','contest-thumbnails/media-hackathon/2.png');

    first_run := public.promote_public_media_to_cdn();
    IF first_run < 3 THEN
      RAISE EXCEPTION 'expected at least 3 promoted URLs, got %', first_run;
    END IF;
    IF (SELECT data->>'thumbnail_url' FROM public.courses WHERE id='media-copied')
       <> 'http://127.0.0.1:54321/storage/v1/object/public/cdn/course-thumbnails/media-copied/a.png' THEN
      RAISE EXCEPTION 'copied course thumbnail was not rewritten to cdn';
    END IF;
    IF (SELECT data->>'thumbnail_url' FROM public.courses WHERE id='media-pending') NOT LIKE '%/object/sign/app/%' THEN
      RAISE EXCEPTION 'course without a cdn copy lost its signed URL';
    END IF;
    IF (SELECT data->>'thumbnail_url' FROM public.courses WHERE id='media-external') <> 'https://images.example.com/c.png' THEN
      RAISE EXCEPTION 'non-signed thumbnail URL was rewritten';
    END IF;
    IF (SELECT document->>'cover_image_url' FROM public.hackathons WHERE id='media-hackathon')
       <> 'http://127.0.0.1:54321/storage/v1/object/public/cdn/contest-banners/media-hackathon/1.png'
    OR (SELECT document->>'thumbnail_url' FROM public.hackathons WHERE id='media-hackathon')
       <> 'http://127.0.0.1:54321/storage/v1/object/public/cdn/contest-thumbnails/media-hackathon/2.png' THEN
      RAISE EXCEPTION 'hackathon artwork was not rewritten to cdn';
    END IF;
    IF (SELECT document->>'title' FROM public.hackathons WHERE id='media-hackathon') <> 'Hackathon' THEN
      RAISE EXCEPTION 'hackathon document lost unrelated keys';
    END IF;
    IF public.promote_public_media_to_cdn() <> 0 THEN
      RAISE EXCEPTION 'second run was not a no-op';
    END IF;

    IF has_function_privilege('anon', 'public.promote_public_media_to_cdn()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.promote_public_media_to_cdn()', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.promote_public_media_to_cdn()', 'EXECUTE') THEN
      RAISE EXCEPTION 'promote_public_media_to_cdn must be service-role only';
    END IF;
    IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
        AND policyname IN ('cdn_course_thumbnails_select','cdn_contest_media_select','cdn_course_thumbnails_insert','cdn_course_thumbnails_update','cdn_course_thumbnails_delete',
                           'cdn_contest_media_insert','cdn_contest_media_update','cdn_contest_media_delete')) <> 8 THEN
      RAISE EXCEPTION 'cdn write policies for course/hackathon artwork are missing';
    END IF;
    RAISE EXCEPTION 'public-media-cdn: rollback fixtures';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'public-media-cdn: rollback fixtures' THEN RAISE; END IF;
  END;
END $$;
