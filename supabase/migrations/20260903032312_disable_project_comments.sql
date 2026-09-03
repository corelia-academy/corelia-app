-- Project comments are retired completely. Deliberately avoid CASCADE so this
-- migration fails if an unexpected dependency would also be destroyed.
BEGIN;

DROP TABLE IF EXISTS public.project_comments;
DROP FUNCTION IF EXISTS private.project_comments_soft_delete_guard();

COMMIT;
