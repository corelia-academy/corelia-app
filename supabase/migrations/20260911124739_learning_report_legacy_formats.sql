-- Match getLessonFormat for legacy rows, including empty drafts and video-first fallback.
CREATE OR REPLACE FUNCTION private.learning_report(p_course text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.can_manage_course_feature(p_course,auth.uid(),'students') THEN RAISE EXCEPTION 'COURSE_STUDENTS_PERMISSION_REQUIRED' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
 'enrolled',(SELECT count(*) FROM public.enrollments WHERE course_id=p_course),
 'started',(SELECT count(DISTINCT actor_id) FROM public.activity_events WHERE target_type='course' AND target_id=p_course AND verb='learning.lesson_started'),
 'completed',(SELECT count(*) FROM public.enrollments WHERE course_id=p_course AND completed_at IS NOT NULL),
 'submitted',(SELECT count(DISTINCT user_id) FROM public.final_assignment_submissions WHERE course_id=p_course),
 'approved',(SELECT count(DISTINCT user_id) FROM public.final_assignment_submissions WHERE course_id=p_course AND status='approved'),
 'lessons',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'title',l.data->>'title','format',COALESCE(NULLIF(l.data->>'lesson_format',''),CASE
     WHEN l.data->>'youtube_url' ~ '[^[:space:]]' THEN 'video'
     WHEN l.data->>'description_markdown' ~ '[^[:space:]]' OR l.data->>'short_description' ~ '[^[:space:]]' THEN 'article'
     ELSE 'video' END),
   'started',(SELECT count(DISTINCT actor_id) FROM public.activity_events WHERE target_type='course' AND target_id=p_course AND object_id=l.id AND verb='learning.lesson_started'),
   'dropoff',(SELECT count(DISTINCT e.actor_id) FROM public.activity_events e WHERE e.target_type='course' AND e.target_id=p_course AND e.object_id=l.id AND e.verb='learning.lesson_started' AND NOT EXISTS (SELECT 1 FROM public.lesson_progress p WHERE p.course_id=p_course AND p.lesson_id=l.id AND p.user_id=e.actor_id AND p.completed_at IS NOT NULL)),
   'completed',(SELECT count(*) FROM public.lesson_progress WHERE course_id=p_course AND lesson_id=l.id AND completed_at IS NOT NULL),
   'quiz_attempts',(SELECT count(DISTINCT attempt_group_id) FROM public.section_question_attempts WHERE course_id=p_course AND lesson_id=l.id),
   'quiz_passes',(SELECT count(DISTINCT attempt_group_id) FROM public.section_question_attempts WHERE course_id=p_course AND lesson_id=l.id AND group_correct::numeric/NULLIF(group_total,0)>=passing_ratio)) ORDER BY s.sort_order,l.sort_order,l.id) FROM public.course_lessons l LEFT JOIN public.course_sections s ON s.course_id=l.course_id AND s.id=l.section_id WHERE l.course_id=p_course AND l.archived_at IS NULL),'[]'));
END $$;
