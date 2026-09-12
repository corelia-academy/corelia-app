-- Parenthesize both JSONB operands before containment comparison.
-- Practice artifacts belong to the single course final assignment.
CREATE OR REPLACE FUNCTION private.learning_practice_final_errors(config jsonb, course_data jsonb) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
 IF config IS NULL THEN RETURN '{}'; END IF;
 IF jsonb_typeof(config->'submission_fields') NOT IN ('array') THEN RETURN ARRAY['invalid_config']; END IF;
 IF config->>'mode' IN ('submission','guided_project') OR COALESCE(jsonb_array_length(config->'submission_fields'),0)>0 THEN
   IF NULLIF(btrim(course_data->>'final_assignment_title'),'') IS NULL THEN RETURN ARRAY['final_assignment_required']; END IF;
   IF COALESCE(jsonb_array_length(config->'submission_fields'),0)>0 AND (
     jsonb_typeof(course_data->'final_assignment_fields') IS DISTINCT FROM 'array'
     OR NOT ((course_data->'final_assignment_fields') @> (config->'submission_fields'))
   ) THEN RETURN ARRAY['invalid_final_artifact_mapping']; END IF;
 END IF;
 RETURN '{}';
END $$;
REVOKE ALL ON FUNCTION private.learning_practice_final_errors(jsonb,jsonb) FROM PUBLIC;

