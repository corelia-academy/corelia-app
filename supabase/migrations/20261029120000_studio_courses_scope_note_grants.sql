-- scope_note was added after studio_courses switched to column-level write grants.
-- Keep the existing admin-only RLS policy and grant authenticated only this additional column.
GRANT INSERT (scope_note) ON public.studio_courses TO authenticated;
GRANT UPDATE (scope_note) ON public.studio_courses TO authenticated;