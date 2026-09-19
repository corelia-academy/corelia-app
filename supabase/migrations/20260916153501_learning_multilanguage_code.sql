-- Expand text-based code exercises without changing schema version or existing Rust content.
CREATE OR REPLACE FUNCTION private.learning_code_errors(c jsonb, publish boolean DEFAULT true) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE errors text[]:='{}'; source text; solution text; marker text; markers text[]; b jsonb; t jsonb; test_pass boolean; pattern text:=''; remainder text; at integer; capture text[]; i integer; answer text; accepted boolean;
BEGIN
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' THEN RETURN ARRAY['config_required']; END IF;
 IF c->>'schema_version' IS DISTINCT FROM '1' OR COALESCE(c->>'language','') NOT IN ('rust','typescript','javascript','python','java','c','cpp','go') OR COALESCE(c->>'mode','') NOT IN ('fill','edit') OR COALESCE(c->>'revision','') !~ '^[1-9][0-9]*$' THEN RETURN ARRAY['unsupported_config']; END IF;
 source:=c->'file'->>'starter_source'; solution:=c->>'reference_solution';
 IF COALESCE(c->'file'->>'path','') !~ ('^[a-zA-Z0-9_.-]+\.' || CASE c->>'language'
   WHEN 'rust' THEN 'rs' WHEN 'typescript' THEN 'ts' WHEN 'javascript' THEN 'js'
   WHEN 'python' THEN 'py' WHEN 'java' THEN 'java' WHEN 'c' THEN 'c'
   WHEN 'cpp' THEN '(cpp|cc|cxx)' WHEN 'go' THEN 'go' END || '$') THEN RETURN ARRAY['invalid_file']; END IF;
 IF COALESCE(btrim(source),'')='' OR COALESCE(btrim(solution),'')='' THEN RETURN ARRAY['source_required']; END IF;
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

REVOKE ALL ON FUNCTION private.learning_code_errors(jsonb,boolean) FROM PUBLIC;
