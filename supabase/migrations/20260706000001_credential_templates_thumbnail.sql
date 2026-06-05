-- Add thumbnail_url to credential_templates
--
-- image_url    : full-resolution badge/cert art sent to OpenCampus payload
--                (credentialSubject.image). Recommended sizes:
--                  Landscape badge/cert: 1600 × 1200 px (4:3)
--                  Portrait badge:       1200 × 1600 px (3:4)
--
-- thumbnail_url: smaller preview for in-app cards and notification bell.
--                Recommended sizes: 800 × 600 px or 600 × 800 px.
--                NULL → fallback to image_url on the frontend.
--
-- Institution image (credentialPayload.image) stays as corelia_logo_url
-- in system_settings — square, min 1300 × 1300 px.

ALTER TABLE public.credential_templates
  ADD COLUMN IF NOT EXISTS thumbnail_url text;
