-- `pg_trgm` (and thus `similarity()`) lives in `extensions` after
-- 20260609203000_security_lints_fix.sql. `search_public` still used only `public`
-- in search_path, causing: function similarity(text, text) does not exist.

ALTER FUNCTION public.search_public(text, integer, integer)
  SET search_path TO public, extensions;
