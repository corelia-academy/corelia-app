-- Content scope written by the Studio admin for a course idea (topics, error codes, depth). The Catalog
-- research (A1) and the brief (A2) read it, so the scope does not have to be guessed from the title and level.

ALTER TABLE public.studio_courses
  ADD COLUMN scope_note text
  CONSTRAINT studio_courses_scope_note_check CHECK (scope_note IS NULL OR (btrim(scope_note) <> '' AND char_length(scope_note) <= 2000));
