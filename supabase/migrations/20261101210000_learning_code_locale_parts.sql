-- Support localized strings for two_stage code exercises (parts array).
CREATE OR REPLACE FUNCTION private.learning_locale_copy_valid(d jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE c jsonb; item jsonb; field text; copy_field text; entry jsonb; subitem jsonb; BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 FOREACH field IN ARRAY ARRAY['title','short_description','description_markdown','youtube_url'] LOOP
  IF d ? field AND jsonb_typeof(d->field) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
 END LOOP;
 FOREACH field IN ARRAY ARRAY['youtube_start_seconds','youtube_end_seconds'] LOOP
  IF d ? field AND jsonb_typeof(d->field) IS DISTINCT FROM 'number' AND NOT (field='youtube_end_seconds' AND d->field='null'::jsonb) THEN RETURN false; END IF;
 END LOOP;
 FOREACH copy_field IN ARRAY ARRAY['practice_copy','question_copy'] LOOP
  IF NOT d ? copy_field THEN CONTINUE; END IF;
  IF jsonb_typeof(d->copy_field) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  FOR entry IN SELECT value FROM jsonb_each(d->copy_field) LOOP
   IF jsonb_typeof(entry) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
   FOREACH field IN ARRAY CASE WHEN copy_field='practice_copy' THEN ARRAY['title','label','instructions_markdown'] ELSE ARRAY['question','explanation'] END LOOP
    IF entry ? field AND jsonb_typeof(entry->field) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
   END LOOP;
   IF copy_field='question_copy' AND entry ? 'options' THEN
    IF jsonb_typeof(entry->'options') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(entry->'options') x WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string') THEN RETURN false; END IF;
   END IF;
  END LOOP;
 END LOOP;

 IF d ? 'video_primary_locale' AND (jsonb_typeof(d->'video_primary_locale') IS DISTINCT FROM 'string' OR d->>'video_primary_locale' NOT IN ('en', 'zh-CN', 'ko', 'es', 'zh-TW', 'vi', 'ja')) THEN RETURN false; END IF;
 IF d ? 'has_subtitle' AND jsonb_typeof(d->'has_subtitle') IS DISTINCT FROM 'boolean' THEN RETURN false; END IF;
 IF d ? 'subtitle_locales' THEN
  IF jsonb_typeof(d->'subtitle_locales') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(d->'subtitle_locales') LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR item#>>'{}' NOT IN ('en', 'zh-CN', 'ko', 'es', 'zh-TW', 'vi', 'ja') THEN RETURN false; END IF;
  END LOOP;
 END IF;
 IF NOT d ? 'code_exercise_locale' THEN RETURN true; END IF;
 c:=d->'code_exercise_locale';
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 IF c ? 'instructions' AND jsonb_typeof(c->'instructions') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
 IF c ? 'hints' THEN
  IF jsonb_typeof(c->'hints') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(c->'hints') x WHERE jsonb_typeof(x) IS DISTINCT FROM 'string') THEN RETURN false; END IF;
 END IF;
 IF c ? 'blank_feedback' THEN
  IF jsonb_typeof(c->'blank_feedback') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(c->'blank_feedback') x WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string') THEN RETURN false; END IF;
 END IF;
 IF c ? 'test_copy' THEN
  IF jsonb_typeof(c->'test_copy') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_each(c->'test_copy') LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
   FOREACH field IN ARRAY ARRAY['description','failure_message','hint'] LOOP
    IF item ? field AND jsonb_typeof(item->field) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
   END LOOP;
  END LOOP;
 END IF;
 IF c ? 'parts' THEN
  IF jsonb_typeof(c->'parts') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'parts') <> 2 THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(c->'parts') LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
   IF item ? 'instructions' AND jsonb_typeof(item->'instructions') IS DISTINCT FROM 'string' THEN RETURN false; END IF;
   IF item ? 'hints' THEN
    IF jsonb_typeof(item->'hints') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(item->'hints') x WHERE jsonb_typeof(x) IS DISTINCT FROM 'string') THEN RETURN false; END IF;
   END IF;
   IF item ? 'blank_feedback' THEN
    IF jsonb_typeof(item->'blank_feedback') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(item->'blank_feedback') x WHERE jsonb_typeof(x.value) IS DISTINCT FROM 'string') THEN RETURN false; END IF;
   END IF;
   IF item ? 'test_copy' THEN
    IF jsonb_typeof(item->'test_copy') IS DISTINCT FROM 'object' THEN RETURN false; END IF;
    FOR subitem IN SELECT value FROM jsonb_each(item->'test_copy') LOOP
     IF jsonb_typeof(subitem) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
     FOREACH field IN ARRAY ARRAY['description','failure_message','hint'] LOOP
      IF subitem ? field AND jsonb_typeof(subitem->field) IS DISTINCT FROM 'string' THEN RETURN false; END IF;
     END LOOP;
    END LOOP;
   END IF;
  END LOOP;
 END IF;
 RETURN true;
END $function$;
