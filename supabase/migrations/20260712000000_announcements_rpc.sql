-- -----------------------------------------------------------------------------
-- Báo cáo Email (Weekly Digest) & Anti-abuse (Mute/Block)
-- Issue: #209
-- -----------------------------------------------------------------------------

-- 1. Hàm đăng thông báo Khóa học
CREATE OR REPLACE FUNCTION public.post_course_announcement(
  p_course_id uuid,
  p_title text,
  p_content text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_has_access boolean;
  v_event_id bigint;
BEGIN
  -- Kiểm tra quyền sở hữu khóa học (Instructor hoặc Co-instructor)
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = p_course_id
      AND (
        c.instructor_id = auth.uid()
        OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
      )
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Bạn không có quyền đăng thông báo cho khóa học này.';
  END IF;

  -- Gửi event với visibility = 'public' để tất cả follower của khóa học/giảng viên đều nhận được
  SELECT private.log_activity(
    p_actor_id := auth.uid(),
    p_verb := 'announcement',
    p_object_type := 'course',
    p_object_id := p_course_id::text,
    p_payload := jsonb_build_object('title', p_title, 'content', p_content),
    p_visibility := 'public'
  ) INTO v_event_id;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_course_announcement(uuid, text, text) TO authenticated;

-- 2. Hàm đăng thông báo Cuộc thi/Hackathon
CREATE OR REPLACE FUNCTION public.post_hackathon_announcement(
  p_hackathon_id text,
  p_title text,
  p_content text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_has_access boolean;
  v_event_id bigint;
BEGIN
  -- Kiểm tra quyền tổ chức cuộc thi (Manager)
  SELECT EXISTS (
    SELECT 1 FROM public.contests c
    WHERE c.id = p_hackathon_id
      AND (c.document->>'manager_id') = auth.uid()::text
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Bạn không có quyền đăng thông báo cho cuộc thi này.';
  END IF;

  SELECT private.log_activity(
    p_actor_id := auth.uid(),
    p_verb := 'announcement',
    p_object_type := 'hackathon',
    p_object_id := p_hackathon_id,
    p_payload := jsonb_build_object('title', p_title, 'content', p_content),
    p_visibility := 'public'
  ) INTO v_event_id;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_hackathon_announcement(text, text, text) TO authenticated;
