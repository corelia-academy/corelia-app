-- Display timezone chosen in Settings, shared across the user's devices.
-- NULL means "auto-detect" from the browser. The app validates names against
-- Intl; the check only bounds the shape of an IANA zone identifier.
ALTER TABLE public.profiles
  ADD COLUMN timezone text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_timezone_format
  CHECK (timezone IS NULL OR timezone ~ '^[A-Za-z][A-Za-z0-9_+/-]{0,63}$');

COMMENT ON COLUMN public.profiles.timezone IS
  'IANA display timezone chosen by the user; NULL = auto-detect.';
