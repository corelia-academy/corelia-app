-- ─── Relax credential_templates constraints for Orphaned Credentials ────

-- 1. Drop existing scope_consistency constraint
ALTER TABLE public.credential_templates 
  DROP CONSTRAINT IF EXISTS credential_templates_scope_consistency;

-- 2. Add the relaxed scope_consistency constraint
-- Allow course_id or hackathon_id to be NULL even for their respective scopes, signifying an orphaned template.
ALTER TABLE public.credential_templates ADD CONSTRAINT credential_templates_scope_consistency CHECK (
  (scope_type = 'course' AND hackathon_id IS NULL)
  OR (scope_type = 'hackathon' AND course_id IS NULL)
  OR (scope_type = 'activity_milestone' AND course_id IS NULL AND hackathon_id IS NULL)
);

-- 3. Dynamically drop the existing foreign keys for course_id and hackathon_id
DO $$
DECLARE
    fk_name text;
BEGIN
    -- Find and drop foreign key for course_id
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'public.credential_templates'::regclass
      AND confrelid = 'public.courses'::regclass
      AND contype = 'f';
    
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.credential_templates DROP CONSTRAINT ' || fk_name;
    END IF;

    -- Find and drop foreign key for hackathon_id
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'public.credential_templates'::regclass
      AND confrelid = 'public.hackathons'::regclass
      AND contype = 'f';
      
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.credential_templates DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

-- 4. Recreate foreign keys with ON DELETE SET NULL
ALTER TABLE public.credential_templates
  ADD CONSTRAINT credential_templates_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;

ALTER TABLE public.credential_templates
  ADD CONSTRAINT credential_templates_hackathon_id_fkey FOREIGN KEY (hackathon_id) REFERENCES public.hackathons(id) ON DELETE SET NULL;
