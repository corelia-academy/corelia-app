-- 20261101090000_studio_course_context added audience, corelia_direction, content_locale and
-- research_period_days to studio_courses without column grants. The table is written with
-- column-level privileges, so the admin UI got 42501 on insert/update of a course.

GRANT INSERT (audience, corelia_direction, content_locale, research_period_days) ON public.studio_courses TO authenticated;
GRANT UPDATE (audience, corelia_direction, content_locale, research_period_days) ON public.studio_courses TO authenticated;
