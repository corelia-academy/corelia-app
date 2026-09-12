-- Validate published content at the database boundary, including writes via legacy APIs.
CREATE FUNCTION private.learning_normalize_source(s text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT btrim(regexp_replace(replace(replace(s,E'\r\n',E'\n'),E'\r',E'\n'), E'[\t ]+(\n|$)', E'\\1','g'),E'\n');
$$;
CREATE FUNCTION private.learning_code_errors(c jsonb, publish boolean DEFAULT true) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE errors text[]:='{}'; source text; solution text; marker text; markers text[]; b jsonb; t jsonb; test_pass boolean; pattern text:=''; remainder text; at integer; capture text[]; i integer; answer text; accepted boolean;
BEGIN
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' THEN RETURN ARRAY['config_required']; END IF;
 IF c->>'schema_version' IS DISTINCT FROM '1' OR c->>'language' IS DISTINCT FROM 'rust' OR COALESCE(c->>'mode','') NOT IN ('fill','edit') OR COALESCE(c->>'revision','') !~ '^[1-9][0-9]*$' THEN RETURN ARRAY['unsupported_config']; END IF;
 source:=c->'file'->>'starter_source'; solution:=c->>'reference_solution';
 IF COALESCE(c->'file'->>'path','') !~ '^[a-zA-Z0-9_.-]+\.rs$' OR COALESCE(btrim(source),'')='' OR COALESCE(btrim(solution),'')='' THEN RETURN ARRAY['source_required']; END IF;
 IF octet_length(source)>65536 OR octet_length(solution)>65536 THEN RETURN ARRAY['source_too_large']; END IF;
 IF c ? 'tests' AND jsonb_typeof(c->'tests')<>'array' THEN RETURN ARRAY['invalid_tests']; END IF;
 IF c->>'mode'='fill' THEN
   IF jsonb_typeof(c->'blanks') IS DISTINCT FROM 'array' THEN RETURN ARRAY['invalid_blanks']; END IF;
   SELECT array_agg(m[1]) INTO markers FROM regexp_matches(source,'\{\{blank:([a-z][a-z0-9_]{0,31})\}\}','g') m;
   IF COALESCE(cardinality(markers),0) NOT BETWEEN 1 AND 5 OR cardinality(markers)<>jsonb_array_length(c->'blanks') OR cardinality(markers)<>(SELECT count(DISTINCT x) FROM unnest(markers) x) THEN RETURN ARRAY['invalid_markers']; END IF;
   remainder:=regexp_replace(source,'\{\{blank:([a-z][a-z0-9_]{0,31})\}\}','','g');
   IF position('{{' in remainder)>0 OR position('}}' in remainder)>0 THEN RETURN ARRAY['invalid_markers']; END IF;
   remainder:=source;
   FOREACH marker IN ARRAY markers LOOP
     at:=position('{{blank:'||marker||'}}' in remainder);
     pattern:=pattern||regexp_replace(left(remainder,at-1),'([\.\^\$\|\(\)\[\]\{\}\*\+\?\\])','\\\1','g')||E'([^\r\n]*?)';
     remainder:=substr(remainder,at+length('{{blank:'||marker||'}}'));
   END LOOP;
   pattern:='^'||pattern||regexp_replace(remainder,'([\.\^\$\|\(\)\[\]\{\}\*\+\?\\])','\\\1','g')||'$';
   capture:=regexp_match(solution,pattern);
   IF publish AND capture IS NULL THEN errors:=array_append(errors,'solution_failed'); END IF;
   FOR b IN SELECT value FROM jsonb_array_elements(c->'blanks') LOOP
     IF NOT (b->>'id'=ANY(markers)) OR (SELECT count(*) FROM jsonb_array_elements(c->'blanks') x WHERE x->>'id'=b->>'id')<>1 OR jsonb_typeof(b->'accepted_answers') IS DISTINCT FROM 'array' OR jsonb_array_length(b->'accepted_answers')=0 THEN RETURN ARRAY['invalid_blank']; END IF;
     i:=array_position(markers,b->>'id'); answer:=capture[i]; accepted:=false;
     FOR remainder IN SELECT jsonb_array_elements_text(b->'accepted_answers') LOOP
       IF btrim(remainder)='' OR remainder~E'[\r\n]' THEN RETURN ARRAY['invalid_blank']; END IF;
       IF COALESCE((b->>'trim_whitespace')::boolean,true) THEN remainder:=btrim(remainder); answer:=btrim(answer); END IF;
       IF COALESCE((b->>'case_sensitive')::boolean,true)=false THEN remainder:=lower(remainder); answer:=lower(answer); END IF;
       accepted:=accepted OR COALESCE(answer=remainder,false);
     END LOOP;
     IF publish AND NOT accepted THEN errors:=array_append(errors,'solution_failed'); END IF;
   END LOOP;
 ELSE
   IF c ? 'blanks' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(c->'tests','[]')) x WHERE x->>'required'='true') THEN RETURN ARRAY['required_test_missing']; END IF;
 END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(COALESCE(c->'tests','[]')) LOOP
   IF COALESCE(t->>'id','')='' OR COALESCE(t->>'description','')='' OR jsonb_typeof(t->'required') IS DISTINCT FROM 'boolean' OR (SELECT count(*) FROM jsonb_array_elements(c->'tests') x WHERE x->>'id'=t->>'id')<>1 THEN RETURN ARRAY['invalid_test']; END IF;
   IF t->>'type'='source_equals' THEN
     IF jsonb_typeof(t->'accepted_sources') IS DISTINCT FROM 'array' OR jsonb_array_length(t->'accepted_sources')=0 THEN RETURN ARRAY['invalid_test_source']; END IF;
     SELECT EXISTS(SELECT 1 FROM jsonb_array_elements_text(t->'accepted_sources') x WHERE private.learning_normalize_source(x)=private.learning_normalize_source(solution)) INTO test_pass;
   ELSIF t->>'type' IN ('contains','not_contains') AND COALESCE(t->>'value','')<>'' THEN
     test_pass:=position(replace(replace(t->>'value',E'\r\n',E'\n'),E'\r',E'\n') in replace(replace(solution,E'\r\n',E'\n'),E'\r',E'\n'))>0;
     IF t->>'type'='not_contains' THEN test_pass:=NOT test_pass; END IF;
   ELSE RETURN ARRAY['invalid_test_rule']; END IF;
   IF publish AND t->>'required'='true' AND NOT test_pass THEN errors:=array_append(errors,'solution_failed'); END IF;
 END LOOP;
 RETURN errors;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN ARRAY['invalid_config'];
END $$;

CREATE FUNCTION private.learning_lesson_errors(p_id text,p_data jsonb,p_course text) RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE errors text[]:='{}'; f text; c jsonb; step jsonb; field text; BEGIN
 IF COALESCE(btrim(p_data->>'title'),'')='' THEN errors:=array_append(errors,'title_required'); END IF;
 f:=COALESCE(p_data->>'lesson_format',CASE WHEN COALESCE(btrim(p_data->>'youtube_url'),'')<>'' THEN 'video' ELSE 'article' END);
 IF f='video' THEN
   IF COALESCE(p_data->>'youtube_url','') !~ '^https://((www\.|m\.)?youtube\.com/(watch\?[^ ]*v=|embed/|shorts/)|youtu\.be/)[a-zA-Z0-9_-]{11}' THEN errors:=array_append(errors,'youtube_required'); END IF;
   IF COALESCE((p_data->>'youtube_start_seconds')::numeric,0)<0 OR (p_data->>'youtube_end_seconds' IS NOT NULL AND (p_data->>'youtube_end_seconds')::numeric<=COALESCE((p_data->>'youtube_start_seconds')::numeric,0)) THEN errors:=array_append(errors,'invalid_segment'); END IF;
 ELSIF f='quiz' THEN
   IF COALESCE((p_data->'quiz_config'->>'passing_ratio')::numeric,0.7) NOT BETWEEN 0.01 AND 1 THEN errors:=array_append(errors,'invalid_threshold'); END IF;
   IF NOT EXISTS(SELECT 1 FROM public.course_section_questions WHERE lesson_id=p_id AND course_id=p_course AND archived_at IS NULL) OR EXISTS(SELECT 1 FROM public.course_section_questions WHERE lesson_id=p_id AND course_id=p_course AND archived_at IS NULL AND (COALESCE(btrim(data->>'question'),'')='' OR jsonb_typeof(data->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(data->'options')<2 OR COALESCE(data->>'correct_index','')!~'^[0-9]+$' OR (data->>'correct_index')::integer>=jsonb_array_length(data->'options'))) THEN errors:=array_append(errors,'invalid_questions'); END IF;
 ELSIF f='code_exercise' THEN errors:=errors||private.learning_code_errors(p_data->'code_exercise_config');
 ELSIF f IN ('article','practice') THEN
   IF COALESCE(btrim(p_data->>'description_markdown'),'')='' THEN errors:=array_append(errors,'content_required'); END IF;
 ELSE errors:=array_append(errors,'invalid_format'); END IF;
 IF f='practice' THEN
   c:=COALESCE(p_data->'practice_config','{"mode":"instruction"}');
   IF COALESCE(c->>'mode','') NOT IN ('instruction','checklist','submission','guided_project') THEN errors:=array_append(errors,'invalid_practice'); END IF;
   IF COALESCE((c->>'requires_review')::boolean,false) THEN errors:=array_append(errors,'course_review_only'); END IF;
   IF c->>'mode'='checklist' AND (jsonb_array_length(COALESCE(c->'checklist_items','[]'))=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(c->'checklist_items') x WHERE COALESCE(x->>'id','')='' OR COALESCE(btrim(x->>'label'),'')='')) THEN errors:=array_append(errors,'invalid_checklist'); END IF;
   IF c->>'mode'='guided_project' THEN
     IF jsonb_array_length(COALESCE(c->'project_steps','[]'))=0 THEN errors:=array_append(errors,'invalid_steps'); END IF;
     FOR step IN SELECT value FROM jsonb_array_elements(COALESCE(c->'project_steps','[]')) LOOP
       IF COALESCE(step->>'id','')='' OR COALESCE(btrim(step->>'title'),'')='' OR COALESCE(step->>'verification','') NOT IN ('self_check','artifact_required') THEN errors:=array_append(errors,'invalid_steps'); END IF;
       IF step->>'verification'='artifact_required' AND (jsonb_array_length(COALESCE(step->'artifact_fields','[]'))=0 OR NOT (COALESCE(c->'submission_fields','[]') @> (step->'artifact_fields'))) THEN errors:=array_append(errors,'invalid_artifact_mapping'); END IF;
     END LOOP;
   END IF;
   FOR field IN SELECT jsonb_array_elements_text(COALESCE(c->'submission_fields','[]')) LOOP
     IF field NOT IN ('github_url','deployment_url','contract_address','transaction_url','demo_url','notes') THEN errors:=array_append(errors,'invalid_artifact'); END IF;
   END LOOP;
   IF c->>'mode'='submission' AND NOT EXISTS(SELECT 1 FROM public.courses co JOIN public.course_lessons l ON l.course_id=co.id WHERE l.id=p_id AND l.course_id=p_course AND NULLIF(btrim(co.data->>'final_assignment_title'),'') IS NOT NULL) THEN errors:=array_append(errors,'final_assignment_required'); END IF;
   IF NULLIF(c->>'related_hackathon_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.hackathons WHERE id=c->>'related_hackathon_id' AND status IN ('published','running','ended')) THEN errors:=array_append(errors,'invalid_related_hackathon'); END IF;
   -- A project-template subsystem is deliberately not introduced.
   IF NULLIF(c->>'related_project_template_id','') IS NOT NULL THEN errors:=array_append(errors,'project_template_unavailable'); END IF;
 END IF;
 RETURN errors;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN ARRAY['invalid_config'];
END $$;
REVOKE ALL ON FUNCTION private.learning_code_errors(jsonb,boolean),private.learning_normalize_source(text),private.learning_lesson_errors(text,jsonb,text) FROM PUBLIC;

CREATE FUNCTION private.learning_publication_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE errors text[]; l public.course_lessons%ROWTYPE; course_id_value text; d jsonb; BEGIN
 IF TG_TABLE_NAME='course_lessons' THEN
   SELECT * INTO l FROM public.course_lessons WHERE id=NEW.id AND course_id=NEW.course_id;
   IF NOT FOUND THEN RETURN NULL; END IF;
   IF l.data->>'lesson_format'='code_exercise' THEN
     errors:=private.learning_code_errors(l.data->'code_exercise_config',false);
     IF cardinality(errors)>0 THEN RAISE EXCEPTION 'INVALID_CODE_CONFIG: %',array_to_string(errors,','); END IF;
   END IF;
   IF l.published AND l.archived_at IS NULL THEN
     errors:=private.learning_lesson_errors(l.id,l.data,l.course_id);
     IF cardinality(errors)>0 THEN RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %',array_to_string(errors,','); END IF;
   END IF;
 ELSIF TG_TABLE_NAME IN ('course_section_questions','course_lesson_locales') THEN
   FOR l IN SELECT * FROM public.course_lessons WHERE course_id=CASE WHEN TG_OP='DELETE' THEN OLD.course_id ELSE NEW.course_id END AND id=CASE WHEN TG_OP='DELETE' THEN OLD.lesson_id ELSE NEW.lesson_id END AND published AND archived_at IS NULL LOOP
     errors:=private.learning_lesson_errors(l.id,l.data,l.course_id);
     IF TG_TABLE_NAME='course_lesson_locales' AND TG_OP<>'DELETE' THEN
       -- Machine configuration belongs to the master, never locale records.
       IF NEW.data ?| ARRAY['lesson_format','quiz_config','practice_config','code_exercise_config','published','archived_at'] THEN RAISE EXCEPTION 'LOCALE_MACHINE_CONFIG_FORBIDDEN'; END IF;
       errors:=errors||private.learning_lesson_errors(l.id,l.data||NEW.data,l.course_id);
     END IF;
     IF cardinality(errors)>0 THEN RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %',array_to_string(errors,','); END IF;
   END LOOP;
 ELSE
   course_id_value:=CASE WHEN TG_TABLE_NAME='courses' THEN to_jsonb(NEW)->>'id' ELSE to_jsonb(NEW)->>'course_id' END;
   SELECT data INTO d FROM public.courses WHERE id=course_id_value AND published AND archived_at IS NULL;
   IF FOUND THEN
     IF COALESCE(btrim(d->>'title'),'')='' OR NOT EXISTS(SELECT 1 FROM public.course_lessons WHERE course_id=course_id_value AND published AND archived_at IS NULL) THEN RAISE EXCEPTION 'COURSE_NOT_PUBLISHABLE'; END IF;
     IF NULLIF(btrim(d->>'final_assignment_title'),'') IS NOT NULL AND COALESCE(btrim(d->>'final_assignment_instructions'),'')='' THEN RAISE EXCEPTION 'FINAL_INSTRUCTIONS_REQUIRED'; END IF;
     FOR l IN SELECT * FROM public.course_lessons WHERE course_id=course_id_value AND published AND archived_at IS NULL LOOP
       errors:=private.learning_lesson_errors(l.id,l.data,l.course_id);
       IF cardinality(errors)>0 THEN RAISE EXCEPTION 'LESSON_NOT_PUBLISHABLE: %: %',l.id,array_to_string(errors,','); END IF;
     END LOOP;
   END IF;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.learning_publication_guard() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER learning_publication AFTER INSERT OR UPDATE ON public.course_lessons DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.learning_publication_guard();
CREATE CONSTRAINT TRIGGER learning_publication AFTER INSERT OR UPDATE ON public.courses DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.learning_publication_guard();
CREATE CONSTRAINT TRIGGER learning_publication AFTER INSERT OR UPDATE ON public.course_locales DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.learning_publication_guard();
CREATE CONSTRAINT TRIGGER learning_publication AFTER INSERT OR UPDATE OR DELETE ON public.course_section_questions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.learning_publication_guard();
CREATE CONSTRAINT TRIGGER learning_publication AFTER INSERT OR UPDATE OR DELETE ON public.course_lesson_locales DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.learning_publication_guard();
