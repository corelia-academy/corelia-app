-- studio_courses.scope_note: optional, non-blank, at most 2000 characters. Rolled back.
BEGIN;

DO $$
BEGIN
  IF NOT has_column_privilege('authenticated', 'public.studio_courses', 'scope_note', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated must have INSERT privilege on studio_courses.scope_note';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.studio_courses', 'scope_note', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated must have UPDATE privilege on studio_courses.scope_note';
  END IF;
END;
$$;

INSERT INTO public.studio_courses(id, title, status) VALUES
 ('ffff8888-2222-4000-8000-000000000001','Scope note unset','idea'),
 ('ffff8888-2222-4000-8000-000000000002','Scope note set','idea');
UPDATE public.studio_courses SET scope_note = 'E0382, E0499, E0502; lifetimes' WHERE id = 'ffff8888-2222-4000-8000-000000000002';

DO $$
BEGIN
  IF (SELECT scope_note FROM public.studio_courses WHERE id = 'ffff8888-2222-4000-8000-000000000001') IS NOT NULL THEN
    RAISE EXCEPTION 'scope_note must default to NULL';
  END IF;

  BEGIN
    UPDATE public.studio_courses SET scope_note = '   ' WHERE id = 'ffff8888-2222-4000-8000-000000000001';
    RAISE EXCEPTION 'expected a blank scope_note to be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.studio_courses SET scope_note = repeat('x', 2001) WHERE id = 'ffff8888-2222-4000-8000-000000000001';
    RAISE EXCEPTION 'expected an over-long scope_note to be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$$;

ROLLBACK;
