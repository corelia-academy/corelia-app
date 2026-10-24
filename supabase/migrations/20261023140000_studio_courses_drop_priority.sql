-- studio_courses.priority is replaced by the ranking passes (studio_catalog_rankings) and manual
-- orders; nothing reads it any more. The column grants of authenticated lose it with the column.

ALTER TABLE public.studio_courses DROP COLUMN priority;

REVOKE INSERT, UPDATE ON public.studio_courses FROM authenticated;
GRANT INSERT (title, level, status, policy_tier) ON public.studio_courses TO authenticated;
GRANT UPDATE (title, level, status, policy_tier) ON public.studio_courses TO authenticated;
