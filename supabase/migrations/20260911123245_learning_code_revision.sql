-- Code draft identity is enforced for direct writes as well as the authoring RPC.
CREATE FUNCTION private.learning_code_machine(config jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE machine jsonb;
BEGIN
 IF config IS NULL OR jsonb_typeof(config) IS DISTINCT FROM 'object' THEN RETURN config; END IF;
 machine:=config-ARRAY['revision','hints'];
 IF jsonb_typeof(config->'blanks')='array' THEN
   SELECT jsonb_set(machine,'{blanks}',COALESCE(jsonb_agg(CASE WHEN jsonb_typeof(value)='object' THEN value-'feedback' ELSE value END ORDER BY ordinality),'[]'))
   INTO machine FROM jsonb_array_elements(config->'blanks') WITH ORDINALITY;
 END IF;
 IF jsonb_typeof(config->'tests')='array' THEN
   SELECT jsonb_set(machine,'{tests}',COALESCE(jsonb_agg(CASE WHEN jsonb_typeof(value)='object' THEN value-ARRAY['description','failure_message','hint'] ELSE value END ORDER BY ordinality),'[]'))
   INTO machine FROM jsonb_array_elements(config->'tests') WITH ORDINALITY;
 END IF;
 RETURN machine;
END $$;
REVOKE ALL ON FUNCTION private.learning_code_machine(jsonb) FROM PUBLIC;

CREATE FUNCTION private.learning_code_revision_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous jsonb; config jsonb:=NEW.data->'code_exercise_config'; revision integer:=1;
BEGIN
 IF NEW.data->>'lesson_format' IS DISTINCT FROM 'code_exercise' OR jsonb_typeof(config) IS DISTINCT FROM 'object' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
   IF NEW.data IS NOT DISTINCT FROM OLD.data AND (NOT NEW.published OR NEW.archived_at IS NOT NULL) THEN RETURN NEW; END IF;
   previous:=OLD.data->'code_exercise_config';
   IF jsonb_typeof(previous)='object' THEN
     revision:=CASE WHEN previous->>'revision' ~ '^[1-9][0-9]{0,8}$' THEN (previous->>'revision')::integer ELSE 1 END;
     IF private.learning_code_machine(previous) IS DISTINCT FROM private.learning_code_machine(config) THEN revision:=revision+1; END IF;
   END IF;
 END IF;
 NEW.data:=jsonb_set(NEW.data,'{code_exercise_config,revision}',to_jsonb(revision));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_code_revision_guard() FROM PUBLIC;
CREATE TRIGGER learning_code_revision BEFORE INSERT OR UPDATE OF data ON public.course_lessons
FOR EACH ROW EXECUTE FUNCTION private.learning_code_revision_guard();
