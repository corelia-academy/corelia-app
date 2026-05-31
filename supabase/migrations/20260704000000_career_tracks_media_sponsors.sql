-- Career tracks: add hero media, short description, sponsors, and partner branding.

ALTER TABLE public.career_tracks
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_path text,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS sponsors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS partner_brand jsonb,
  ADD COLUMN IF NOT EXISTS partners jsonb NOT NULL DEFAULT '[]'::jsonb;
