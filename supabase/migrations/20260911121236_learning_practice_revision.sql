-- Draft revision follows behavior, not translated or edited display copy.
CREATE FUNCTION private.learning_practice_machine(config jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE machine jsonb := config-'revision';
BEGIN
 IF config IS NULL OR jsonb_typeof(config) IS DISTINCT FROM 'object' THEN RETURN config; END IF;
 IF jsonb_typeof(config->'checklist_items')='array' THEN
   SELECT jsonb_set(machine,'{checklist_items}',COALESCE(jsonb_agg(CASE WHEN jsonb_typeof(value)='object' THEN value-'label' ELSE value END ORDER BY ordinality),'[]'))
   INTO machine FROM jsonb_array_elements(config->'checklist_items') WITH ORDINALITY;
 END IF;
 IF jsonb_typeof(config->'project_steps')='array' THEN
   SELECT jsonb_set(machine,'{project_steps}',COALESCE(jsonb_agg(CASE WHEN jsonb_typeof(value)='object' THEN value-ARRAY['title','instructions_markdown'] ELSE value END ORDER BY ordinality),'[]'))
   INTO machine FROM jsonb_array_elements(config->'project_steps') WITH ORDINALITY;
 END IF;
 RETURN machine;
END $$;
REVOKE ALL ON FUNCTION private.learning_practice_machine(jsonb) FROM PUBLIC;

CREATE FUNCTION private.learning_practice_revision_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous jsonb; config jsonb:=NEW.data->'practice_config'; revision integer:=1;
BEGIN
 IF NEW.data->>'lesson_format' IS DISTINCT FROM 'practice' OR jsonb_typeof(config) IS DISTINCT FROM 'object' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
   previous:=OLD.data->'practice_config';
   IF jsonb_typeof(previous)='object' THEN
     revision:=CASE WHEN previous->>'revision' ~ '^[1-9][0-9]{0,8}$' THEN (previous->>'revision')::integer ELSE 1 END;
     IF private.learning_practice_machine(previous) IS DISTINCT FROM private.learning_practice_machine(config) THEN revision:=revision+1; END IF;
   END IF;
 END IF;
 NEW.data:=jsonb_set(NEW.data,'{practice_config,revision}',to_jsonb(revision));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.learning_practice_revision_guard() FROM PUBLIC;
CREATE TRIGGER learning_practice_revision BEFORE INSERT OR UPDATE OF data ON public.course_lessons
FOR EACH ROW EXECUTE FUNCTION private.learning_practice_revision_guard();
