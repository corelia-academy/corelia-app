-- Backfill: strip leading/trailing whitespace that leaked into profiles
-- before the client started trimming full_name/phone on save (bio/website
-- were already trimmed client-side, but historical rows may predate that too).
-- internal.sync_public_profile() fires on UPDATE, so public_profiles is
-- repaired automatically for any row touched here.

-- full_name/phone/bio/website have no uniqueness constraint, so a plain
-- bulk update is always safe.
UPDATE public.profiles
SET
  full_name = NULLIF(btrim(full_name), ''),
  phone = NULLIF(btrim(phone), ''),
  bio = NULLIF(btrim(bio), ''),
  website = NULLIF(btrim(website), ''),
  updated_at = now()
WHERE
  full_name IS DISTINCT FROM NULLIF(btrim(full_name), '')
  OR phone IS DISTINCT FROM NULLIF(btrim(phone), '')
  OR bio IS DISTINCT FROM NULLIF(btrim(bio), '')
  OR website IS DISTINCT FROM NULLIF(btrim(website), '');

-- username is covered by the case-insensitive unique index
-- profiles_username_lower_key (lower(username), excludes NULL/''), so two
-- rows differing only by whitespace (e.g. "quang" vs "quang ") would collide
-- once trimmed. We can't inspect production data ahead of time, so trim
-- row-by-row and disambiguate on conflict instead of letting one collision
-- abort the whole backfill.
DO $$
DECLARE
  rec RECORD;
  suffix TEXT;
BEGIN
  FOR rec IN
    SELECT id, username
    FROM public.profiles
    WHERE username IS NOT NULL AND username <> btrim(username)
  LOOP
    BEGIN
      UPDATE public.profiles
      SET username = btrim(rec.username), updated_at = now()
      WHERE id = rec.id;
    EXCEPTION WHEN unique_violation THEN
      suffix := substr(md5(random()::text), 1, 4);
      UPDATE public.profiles
      SET username = btrim(rec.username) || '_' || suffix, updated_at = now()
      WHERE id = rec.id;
      RAISE NOTICE 'profiles.id=% username trim collided; renamed to %',
        rec.id, btrim(rec.username) || '_' || suffix;
    END;
  END LOOP;
END $$;
