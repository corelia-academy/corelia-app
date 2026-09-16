-- Legacy lessons without a format or body use the existing "video updating" convention.
-- Apply the same inference when validating a translated video override.
DO $$ DECLARE definition text; changed text; BEGIN
 definition:=pg_get_functiondef('private.learning_locale_video_issues(text,text,jsonb,jsonb)'::regprocedure);
 changed:=replace(definition,
  'CASE WHEN COALESCE(btrim(master->>''youtube_url''),'''')<>'''' THEN ''video'' ELSE ''article'' END',
  'CASE WHEN COALESCE(btrim(master->>''youtube_url''),'''')<>'''' THEN ''video'' WHEN COALESCE(btrim(master->>''description_markdown''),'''')<>'''' OR COALESCE(btrim(master->>''short_description''),'''')<>'''' THEN ''article'' ELSE ''video'' END');
 IF changed=definition THEN RAISE EXCEPTION 'Translation video inference definition changed'; END IF;
 EXECUTE changed;
END $$;
