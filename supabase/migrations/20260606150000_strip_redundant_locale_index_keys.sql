-- Strip redundant denormalized keys (entity / course_id / section_id /
-- lesson_id / locale) out of the jsonb `data` column on locale tables.
--
-- These keys were nested inside the document body during the Firestore era
-- so collectionGroup queries could filter by them. On Postgres the same
-- values live in proper columns that are part of the PRIMARY KEY of each
-- table, so the duplicates inside `data` are dead weight and never read.

UPDATE public.course_locales
SET data = data - 'entity' - 'course_id' - 'locale'
WHERE data ? 'entity' OR data ? 'course_id' OR data ? 'locale';

UPDATE public.course_section_locales
SET data = data - 'entity' - 'course_id' - 'section_id' - 'locale'
WHERE data ? 'entity'
   OR data ? 'course_id'
   OR data ? 'section_id'
   OR data ? 'locale';

UPDATE public.course_lesson_locales
SET data = data - 'entity' - 'course_id' - 'lesson_id' - 'locale'
WHERE data ? 'entity'
   OR data ? 'course_id'
   OR data ? 'lesson_id'
   OR data ? 'locale';
