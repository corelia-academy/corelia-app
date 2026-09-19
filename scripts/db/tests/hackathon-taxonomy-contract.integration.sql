-- Integration test for hackathon taxonomy contract
-- Tests trigger and validation function against real PostgreSQL execution
-- Strictly conforms to public.hackathons schema (id, status, document)

DO $test$
DECLARE
  v_hackathon_id text := gen_random_uuid()::text;
  v_valid_doc jsonb := '{
    "sectors": [{"id": "sec-ai", "name": "AI Engineering", "active": true}],
    "tech_stacks": [{"id": "tech-py", "name": "Python", "active": true}]
  }'::jsonb;
BEGIN
  -- Test 1: Function exists and is defined properly
  IF to_regprocedure('private.validate_hackathon_taxonomy(text, jsonb, boolean)') IS NULL THEN
    RAISE EXCEPTION 'private.validate_hackathon_taxonomy function is missing';
  END IF;

  -- Test 2: Draft hackathons allow progressive authoring without taxonomy
  INSERT INTO public.hackathons (id, status, document)
  VALUES (v_hackathon_id, 'draft', '{}'::jsonb);

  -- Test 3: Updating draft without taxonomy succeeds
  UPDATE public.hackathons
  SET updated_at = now()
  WHERE id = v_hackathon_id;

  -- Test 4: Cannot update draft to published without taxonomy
  BEGIN
    UPDATE public.hackathons
    SET status = 'published'
    WHERE id = v_hackathon_id;
    RAISE EXCEPTION 'Published hackathon without taxonomy unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invalid_input:hackathon_taxonomy_required%' THEN
        RAISE;
      END IF;
  END;

  -- Test 5: Direct insert of published hackathon with NULL document is rejected
  BEGIN
    INSERT INTO public.hackathons (id, status, document)
    VALUES (gen_random_uuid()::text, 'published', NULL);
    RAISE EXCEPTION 'Published hackathon with null document unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invalid_input:hackathon_document_required%' THEN
        RAISE;
      END IF;
  END;

  -- Test 6: Direct insert of published hackathon with empty sectors is rejected
  BEGIN
    INSERT INTO public.hackathons (id, status, document)
    VALUES (gen_random_uuid()::text, 'published', jsonb_build_object(
      'sectors', '[]'::jsonb,
      'tech_stacks', jsonb_build_array(jsonb_build_object('id', 'tech-py', 'name', 'Python'))
    ));
    RAISE EXCEPTION 'Published hackathon with empty sectors unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invalid_input:hackathon_taxonomy_required%' THEN
        RAISE;
      END IF;
  END;

  -- Test 7 (V-01 regression): Numeric id / numeric name / numeric active is rejected
  BEGIN
    INSERT INTO public.hackathons (id, status, document)
    VALUES (gen_random_uuid()::text, 'published', jsonb_build_object(
      'sectors', jsonb_build_array(jsonb_build_object('id', 123, 'name', 456, 'active', 0)),
      'tech_stacks', jsonb_build_array(jsonb_build_object('id', 'tech-py', 'name', 'Python'))
    ));
    RAISE EXCEPTION 'Published hackathon with numeric taxonomy fields unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invalid_input:hackathon_taxonomy_invalid%' THEN
        RAISE;
      END IF;
  END;

  -- Test 8 (V-10): Missing id or name is rejected (NULL-safe contract)
  BEGIN
    INSERT INTO public.hackathons (id, status, document)
    VALUES (gen_random_uuid()::text, 'published', jsonb_build_object(
      'sectors', jsonb_build_array(jsonb_build_object('name', 'Sector 1', 'active', true)),
      'tech_stacks', jsonb_build_array(jsonb_build_object('id', 'tech-py', 'name', 'Python', 'active', true))
    ));
    RAISE EXCEPTION 'Published hackathon with missing taxonomy id unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invalid_input:hackathon_taxonomy_invalid%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    INSERT INTO public.hackathons (id, status, document)
    VALUES (gen_random_uuid()::text, 'published', jsonb_build_object(
      'sectors', jsonb_build_array(jsonb_build_object('id', 'sec-1', 'name', 'Sector 1', 'active', true)),
      'tech_stacks', jsonb_build_array(jsonb_build_object('id', 'tech-py', 'active', true))
    ));
    RAISE EXCEPTION 'Published hackathon with missing taxonomy name unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invalid_input:hackathon_taxonomy_invalid%' THEN
        RAISE;
      END IF;
  END;

  -- Test 9: Non-boolean string active is rejected
  BEGIN
    INSERT INTO public.hackathons (id, status, document)
    VALUES (gen_random_uuid()::text, 'published', jsonb_build_object(
      'sectors', jsonb_build_array(jsonb_build_object('id', 'sec-1', 'name', 'Sector 1', 'active', 'true')),
      'tech_stacks', jsonb_build_array(jsonb_build_object('id', 'tech-py', 'name', 'Python'))
    ));
    RAISE EXCEPTION 'Published hackathon with string active field unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invalid_input:hackathon_taxonomy_invalid%' THEN
        RAISE;
      END IF;
  END;

  -- Test 10: Only inactive items present is rejected (active count = 0)
  BEGIN
    INSERT INTO public.hackathons (id, status, document)
    VALUES (gen_random_uuid()::text, 'published', jsonb_build_object(
      'sectors', jsonb_build_array(jsonb_build_object('id', 'sec-1', 'name', 'Sector 1', 'active', false)),
      'tech_stacks', jsonb_build_array(jsonb_build_object('id', 'tech-py', 'name', 'Python', 'active', true))
    ));
    RAISE EXCEPTION 'Published hackathon with zero active sectors unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%invalid_input:hackathon_taxonomy_required%' THEN
        RAISE;
      END IF;
  END;

  -- Test 11: Valid published hackathon insert succeeds
  UPDATE public.hackathons
  SET document = v_valid_doc, status = 'published'
  WHERE id = v_hackathon_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.hackathons
    WHERE id = v_hackathon_id AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'Failed to publish hackathon with valid taxonomy';
  END IF;

  -- Test 12: Running hackathon with valid taxonomy succeeds
  UPDATE public.hackathons
  SET status = 'running'
  WHERE id = v_hackathon_id;

  -- Cleanup
  DELETE FROM public.hackathons WHERE id = v_hackathon_id;
END $test$;
