CREATE TABLE public.project_taxonomy_options (
  kind text NOT NULL CHECK (kind IN ('sector', 'technology')),
  id text NOT NULL,
  name_vi text NOT NULL CHECK (char_length(btrim(name_vi)) BETWEEN 1 AND 80),
  name_en text NOT NULL CHECK (char_length(btrim(name_en)) BETWEEN 1 AND 80),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, id)
);

ALTER TABLE public.project_taxonomy_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_taxonomy_options_public_read ON public.project_taxonomy_options
  FOR SELECT TO anon, authenticated USING (active);
GRANT SELECT ON public.project_taxonomy_options TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.project_taxonomy_options FROM anon, authenticated;

INSERT INTO public.project_taxonomy_options (kind,id,name_vi,name_en,sort_order) VALUES
('sector','sector-ai-engineering','Kỹ thuật AI & Machine Learning','AI & Machine Learning Engineering',0),
('sector','sector-blockchain-web3','Blockchain & Web3','Blockchain & Web3',1),
('sector','sector-frontend','Phát triển Frontend','Frontend Development',2),
('sector','sector-backend','Phát triển Backend','Backend Development',3),
('sector','sector-fullstack','Phát triển Full-stack','Full-stack Development',4),
('sector','sector-mobile','Phát triển Mobile','Mobile Development',5),
('sector','sector-data-engineering','Kỹ thuật dữ liệu','Data Engineering',6),
('sector','sector-cloud-devops','Cloud & DevOps','Cloud & DevOps',7),
('sector','sector-cybersecurity','An toàn thông tin','Cybersecurity',8),
('sector','sector-developer-tools','Công cụ lập trình & Mã nguồn mở','Developer Tools & Open Source',9),
('technology','tech-javascript','JavaScript','JavaScript',0),
('technology','tech-typescript','TypeScript','TypeScript',1),
('technology','tech-python','Python','Python',2),
('technology','tech-rust','Rust','Rust',3),
('technology','tech-go','Go','Go',4),
('technology','tech-react','React','React',5),
('technology','tech-nextjs','Next.js','Next.js',6),
('technology','tech-nodejs','Node.js','Node.js',7),
('technology','tech-pytorch','PyTorch','PyTorch',8),
('technology','tech-tensorflow','TensorFlow','TensorFlow',9),
('technology','tech-solidity','Solidity','Solidity',10),
('technology','tech-evm','EVM','EVM',11),
('technology','tech-solana','Solana','Solana',12),
('technology','tech-docker','Docker','Docker',13),
('technology','tech-kubernetes','Kubernetes','Kubernetes',14),
('technology','tech-html','HTML','HTML',15),
('technology','tech-css','CSS','CSS',16),
('technology','tech-vuejs','Vue.js','Vue.js',17),
('technology','tech-nuxt','Nuxt','Nuxt',18),
('technology','tech-angular','Angular','Angular',19),
('technology','tech-svelte','Svelte','Svelte',20),
('technology','tech-java','Java','Java',21),
('technology','tech-kotlin','Kotlin','Kotlin',22),
('technology','tech-swift','Swift','Swift',23),
('technology','tech-dart','Dart','Dart',24),
('technology','tech-flutter','Flutter','Flutter',25),
('technology','tech-react-native','React Native','React Native',26),
('technology','tech-c','C','C',27),
('technology','tech-cpp','C++','C++',28),
('technology','tech-csharp','C#','C#',29),
('technology','tech-php','PHP','PHP',30),
('technology','tech-ruby','Ruby','Ruby',31),
('technology','tech-dotnet','.NET','.NET',32),
('technology','tech-spring-boot','Spring Boot','Spring Boot',33),
('technology','tech-django','Django','Django',34),
('technology','tech-fastapi','FastAPI','FastAPI',35),
('technology','tech-laravel','Laravel','Laravel',36),
('technology','tech-postgresql','PostgreSQL','PostgreSQL',37),
('technology','tech-mysql','MySQL','MySQL',38),
('technology','tech-mongodb','MongoDB','MongoDB',39),
('technology','tech-redis','Redis','Redis',40),
('technology','tech-sqlite','SQLite','SQLite',41),
('technology','tech-supabase','Supabase','Supabase',42),
('technology','tech-firebase','Firebase','Firebase',43),
('technology','tech-aws','AWS','AWS',44),
('technology','tech-google-cloud','Google Cloud','Google Cloud',45),
('technology','tech-azure','Azure','Azure',46),
('technology','tech-git','Git','Git',47),
('technology','tech-github-actions','GitHub Actions','GitHub Actions',48);

CREATE FUNCTION private.project_taxonomy_names_valid(p_values text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT cardinality(COALESCE(p_values,'{}'::text[])) <= 20
    AND COALESCE(bool_and(char_length(btrim(value)) BETWEEN 1 AND 80),true)
  FROM unnest(COALESCE(p_values,'{}'::text[])) value;
$$;
REVOKE ALL ON FUNCTION private.project_taxonomy_names_valid(text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.project_taxonomy_names_valid(text[]) TO service_role;

ALTER TABLE public.projects
  ADD COLUMN custom_sector_names text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN custom_tech_stack_names text[] NOT NULL DEFAULT '{}'::text[],
  ADD CONSTRAINT projects_custom_sector_names_valid CHECK (private.project_taxonomy_names_valid(custom_sector_names)),
  ADD CONSTRAINT projects_custom_tech_stack_names_valid CHECK (private.project_taxonomy_names_valid(custom_tech_stack_names));

-- The legacy private writer still requires one configured value per group.
-- Keep a hidden fallback in documents that never configured those groups.
UPDATE public.hackathons SET document = jsonb_set(
  jsonb_set(document, '{sectors}', CASE WHEN jsonb_array_length(COALESCE(document->'sectors','[]'::jsonb)) = 0 THEN '[{"id":"sector-ai-engineering","name":"AI Engineering","active":true,"sort_order":0}]'::jsonb ELSE document->'sectors' END),
  '{tech_stacks}', CASE WHEN jsonb_array_length(COALESCE(document->'tech_stacks','[]'::jsonb)) = 0 THEN '[{"id":"tech-python","name":"Python","active":true,"sort_order":0}]'::jsonb ELSE document->'tech_stacks' END
);

CREATE OR REPLACE FUNCTION private.normalize_project_taxonomy_names(p_values text[])
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(array_agg(value ORDER BY ordinal), '{}'::text[])
  FROM (
    SELECT DISTINCT ON (lower(value)) value, ordinal
    FROM (
      SELECT regexp_replace(btrim(raw), '[[:space:]]+', ' ', 'g') AS value, ordinal
      FROM unnest(COALESCE(p_values, '{}'::text[])) WITH ORDINALITY input(raw, ordinal)
      WHERE btrim(raw) <> ''
    ) cleaned
    ORDER BY lower(value), ordinal
  ) normalized;
$$;
REVOKE ALL ON FUNCTION private.normalize_project_taxonomy_names(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.normalize_project_taxonomy_names(text[]) TO service_role;

CREATE OR REPLACE FUNCTION private.validate_hackathon_project_taxonomy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_document jsonb; v_tracks text[]; v_sectors text[]; v_tech text[];
DECLARE v_existing_tracks text[] := '{}'; v_existing_sectors text[] := '{}'; v_existing_tech text[] := '{}';
BEGIN
  IF NEW.source_type NOT IN ('contest','hackathon') THEN RETURN NEW; END IF;
  IF cardinality(NEW.hackathon_track_ids) = 0 THEN RAISE EXCEPTION 'invalid_input:project_taxonomy_required'; END IF;
  SELECT document INTO v_document FROM public.hackathons WHERE id=NEW.source_id;
  IF v_document IS NULL THEN RAISE EXCEPTION 'not_found:hackathon'; END IF;
  IF TG_OP='UPDATE' THEN v_existing_tracks:=OLD.hackathon_track_ids; v_existing_sectors:=OLD.hackathon_sector_ids; v_existing_tech:=OLD.hackathon_tech_stack_ids; END IF;
  SELECT COALESCE(array_agg(item->>'id'),'{}') INTO v_tracks FROM jsonb_array_elements(COALESCE(v_document->'tracks','[]'::jsonb)) item WHERE COALESCE(item->>'active','true')<>'false';
  SELECT COALESCE(array_agg(id),'{}') INTO v_sectors FROM (
    SELECT id FROM public.project_taxonomy_options WHERE kind='sector' AND active
    UNION SELECT item->>'id' FROM jsonb_array_elements(COALESCE(v_document->'sectors','[]'::jsonb)) item WHERE COALESCE(item->>'active','true')<>'false'
  ) allowed_sectors;
  SELECT COALESCE(array_agg(id),'{}') INTO v_tech FROM (
    SELECT id FROM public.project_taxonomy_options WHERE kind='technology' AND active
    UNION SELECT item->>'id' FROM jsonb_array_elements(COALESCE(v_document->'tech_stacks','[]'::jsonb)) item WHERE COALESCE(item->>'active','true')<>'false'
  ) allowed_tech;
  IF NOT NEW.hackathon_track_ids <@ (v_tracks||v_existing_tracks)
    OR NOT NEW.hackathon_sector_ids <@ (v_sectors||v_existing_sectors)
    OR NOT NEW.hackathon_tech_stack_ids <@ (v_tech||v_existing_tech)
  THEN RAISE EXCEPTION 'invalid_input:project_taxonomy'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_hackathon_project_taxonomy() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.prevent_used_hackathon_taxonomy_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id text;
BEGIN
  FOR v_id IN SELECT DISTINCT unnest(p.hackathon_track_ids) FROM public.projects p WHERE p.source_type IN ('contest','hackathon') AND p.source_id=NEW.id
  LOOP
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.document->'tracks','[]'::jsonb)) item WHERE item->>'id'=v_id) THEN RAISE EXCEPTION 'conflict:taxonomy_in_use'; END IF;
  END LOOP;
  -- System sector/technology IDs are independent from the hackathon document.
  -- The hidden legacy arrays remain untouched by the admin editor.
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.prevent_used_hackathon_taxonomy_delete() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.save_ai_gated_project_taxonomy(
  p_actor_id uuid, p_project_id uuid, p_slug text, p_title text,
  p_summary text DEFAULT NULL, p_demo_url text DEFAULT NULL, p_repo_url text DEFAULT NULL,
  p_slide_url text DEFAULT NULL, p_video_url text DEFAULT NULL, p_logo_path text DEFAULT NULL,
  p_screenshot_paths text[] DEFAULT '{}'::text[], p_visibility text DEFAULT 'public',
  p_source_type text DEFAULT 'standalone', p_source_id text DEFAULT NULL,
  p_track_ids text[] DEFAULT '{}'::text[], p_sector_ids text[] DEFAULT '{}'::text[],
  p_tech_stack_ids text[] DEFAULT '{}'::text[], p_description text DEFAULT NULL,
  p_progress text DEFAULT NULL, p_pitch_video_url text DEFAULT NULL,
  p_primary_content_locale text DEFAULT NULL, p_locales jsonb DEFAULT NULL,
  p_custom_sector_names text[] DEFAULT NULL, p_custom_tech_stack_names text[] DEFAULT NULL
)
RETURNS TABLE(project_id uuid, submission_id text, project_slug text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_primary text; v_locale text; v_content jsonb; v_source_type text; v_source_id text;
DECLARE v_document jsonb; v_proxy_sectors text[]; v_proxy_tech text[]; v_sector_ids text[]; v_tech_ids text[];
DECLARE v_custom_sectors text[]; v_custom_tech text[]; v_existing_sectors text[] := '{}'::text[]; v_existing_tech text[] := '{}'::text[];
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||COALESCE(p_source_id,p_project_id::text),0));
  SELECT source_type,source_id,hackathon_sector_ids,hackathon_tech_stack_ids INTO v_source_type,v_source_id,v_existing_sectors,v_existing_tech FROM public.projects WHERE id=p_project_id;
  v_source_type:=COALESCE(v_source_type,NULLIF(btrim(p_source_type),''),'standalone'); v_source_id:=COALESCE(v_source_id,NULLIF(btrim(p_source_id),''));
  v_sector_ids:=COALESCE(p_sector_ids,'{}'); v_tech_ids:=COALESCE(p_tech_stack_ids,'{}');
  IF p_custom_sector_names IS NOT NULL THEN v_custom_sectors:=private.normalize_project_taxonomy_names(p_custom_sector_names); IF cardinality(v_custom_sectors)>20 OR EXISTS(SELECT 1 FROM unnest(v_custom_sectors) n WHERE char_length(n)>80) THEN RAISE EXCEPTION 'invalid_input:project_taxonomy_custom'; END IF; END IF;
  IF p_custom_tech_stack_names IS NOT NULL THEN v_custom_tech:=private.normalize_project_taxonomy_names(p_custom_tech_stack_names); IF cardinality(v_custom_tech)>20 OR EXISTS(SELECT 1 FROM unnest(v_custom_tech) n WHERE char_length(n)>80) THEN RAISE EXCEPTION 'invalid_input:project_taxonomy_custom'; END IF; END IF;
  -- Exact custom names become canonical catalog selections.
  IF v_custom_sectors IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT value),'{}') INTO v_sector_ids FROM unnest(v_sector_ids || ARRAY(SELECT id FROM public.project_taxonomy_options WHERE kind='sector' AND active AND EXISTS(SELECT 1 FROM unnest(v_custom_sectors) n WHERE lower(n) IN (lower(name_vi),lower(name_en))))) value;
    v_custom_sectors:=ARRAY(SELECT n FROM unnest(v_custom_sectors) n WHERE NOT EXISTS(SELECT 1 FROM public.project_taxonomy_options o WHERE o.kind='sector' AND o.active AND lower(n) IN (lower(o.name_vi),lower(o.name_en))));
  END IF;
  IF v_custom_tech IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT value),'{}') INTO v_tech_ids FROM unnest(v_tech_ids || ARRAY(SELECT id FROM public.project_taxonomy_options WHERE kind='technology' AND active AND EXISTS(SELECT 1 FROM unnest(v_custom_tech) n WHERE lower(n) IN (lower(name_vi),lower(name_en))))) value;
    v_custom_tech:=ARRAY(SELECT n FROM unnest(v_custom_tech) n WHERE NOT EXISTS(SELECT 1 FROM public.project_taxonomy_options o WHERE o.kind='technology' AND o.active AND lower(n) IN (lower(o.name_vi),lower(o.name_en))));
  END IF;
  IF cardinality(v_sector_ids)+cardinality(COALESCE(v_custom_sectors,'{}'))>20 OR cardinality(v_tech_ids)+cardinality(COALESCE(v_custom_tech,'{}'))>20 THEN RAISE EXCEPTION 'invalid_input:project_taxonomy_limit'; END IF;
  IF v_source_type IN ('contest','hackathon') THEN
    IF EXISTS(SELECT 1 FROM unnest(v_sector_ids) id WHERE NOT EXISTS(SELECT 1 FROM public.project_taxonomy_options o WHERE o.kind='sector' AND o.active AND o.id=id) AND NOT id=ANY(v_existing_sectors))
      OR EXISTS(SELECT 1 FROM unnest(v_tech_ids) id WHERE NOT EXISTS(SELECT 1 FROM public.project_taxonomy_options o WHERE o.kind='technology' AND o.active AND o.id=id) AND NOT id=ANY(v_existing_tech))
    THEN RAISE EXCEPTION 'invalid_input:project_taxonomy'; END IF;
    SELECT document INTO v_document FROM public.hackathons WHERE id=v_source_id;
    SELECT ARRAY(SELECT item->>'id' FROM jsonb_array_elements(COALESCE(v_document->'sectors','[]')) item WHERE COALESCE(item->>'active','true')<>'false' LIMIT 1) INTO v_proxy_sectors;
    SELECT ARRAY(SELECT item->>'id' FROM jsonb_array_elements(COALESCE(v_document->'tech_stacks','[]')) item WHERE COALESCE(item->>'active','true')<>'false' LIMIT 1) INTO v_proxy_tech;
  ELSE v_proxy_sectors:=v_sector_ids; v_proxy_tech:=v_tech_ids; END IF;
  IF p_locales IS NOT NULL AND (jsonb_typeof(p_locales)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_locales) k WHERE k NOT IN ('vi','en'))) THEN RAISE EXCEPTION 'invalid_input:project_locales'; END IF;
  IF p_primary_content_locale IS NOT NULL AND (p_primary_content_locale NOT IN ('vi','en') OR p_locales IS NULL) THEN RAISE EXCEPTION 'invalid_input:project_locales'; END IF;
  RETURN QUERY SELECT * FROM private.save_ai_gated_project(p_actor_id,p_project_id,p_slug,p_title,p_summary,p_demo_url,p_repo_url,p_slide_url,p_video_url,p_logo_path,p_screenshot_paths,p_visibility,p_source_type,p_source_id,p_track_ids,v_proxy_sectors,v_proxy_tech);
  UPDATE public.projects p SET
    description=CASE WHEN p_description IS NULL THEN p.description ELSE NULLIF(btrim(p_description),'') END,
    progress=CASE WHEN p_progress IS NULL THEN p.progress ELSE NULLIF(btrim(p_progress),'') END,
    pitch_video_url=CASE WHEN p_pitch_video_url IS NULL THEN p.pitch_video_url ELSE NULLIF(btrim(p_pitch_video_url),'') END,
    hackathon_sector_ids=v_sector_ids, hackathon_tech_stack_ids=v_tech_ids,
    custom_sector_names=CASE WHEN p_custom_sector_names IS NULL THEN p.custom_sector_names ELSE v_custom_sectors END,
    custom_tech_stack_names=CASE WHEN p_custom_tech_stack_names IS NULL THEN p.custom_tech_stack_names ELSE v_custom_tech END
  WHERE p.id=p_project_id;
  IF v_source_type IN ('contest','hackathon') THEN UPDATE public.hackathon_submissions hs SET document=hs.document||jsonb_build_object('sector_ids',v_sector_ids,'tech_stack_ids',v_tech_ids,'custom_sector_names',(SELECT p.custom_sector_names FROM public.projects p WHERE p.id=p_project_id),'custom_tech_stack_names',(SELECT p.custom_tech_stack_names FROM public.projects p WHERE p.id=p_project_id),'updated_at',clock_timestamp()) WHERE hs.project_id=p_project_id; END IF;
  SELECT COALESCE(p_primary_content_locale,i18n->>'primary_content_locale','vi') INTO v_primary FROM public.projects WHERE id=p_project_id;
  IF p_primary_content_locale IS NOT NULL THEN UPDATE public.projects SET i18n=COALESCE(i18n,'{}')||jsonb_build_object('primary_content_locale',v_primary,'supported_locales',jsonb_build_array('vi','en')) WHERE id=p_project_id; END IF;
  FOR v_locale,v_content IN SELECT key,value FROM jsonb_each(COALESCE(p_locales,'{}')) LOOP IF v_locale<>v_primary THEN PERFORM private.save_ai_gated_project_locale(p_actor_id,p_project_id,v_locale,v_content); END IF; END LOOP;
  INSERT INTO public.project_locales(project_id,locale,data) SELECT id,v_primary,jsonb_strip_nulls(jsonb_build_object('title',title,'summary',summary,'description',description,'progress',progress,'updated_at',clock_timestamp())) FROM public.projects WHERE id=p_project_id ON CONFLICT ON CONSTRAINT project_locales_pkey DO UPDATE SET data=EXCLUDED.data;
END;
$$;
REVOKE ALL ON FUNCTION public.save_ai_gated_project_taxonomy(uuid,uuid,text,text,text,text,text,text,text,text,text[],text,text,text,text[],text[],text[],text,text,text,text,jsonb,text[],text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_ai_gated_project_taxonomy(uuid,uuid,text,text,text,text,text,text,text,text,text[],text,text,text,text[],text[],text[],text,text,text,text,jsonb,text[],text[]) TO service_role;
