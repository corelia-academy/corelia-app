-- Migration: Create private `studio-assets` bucket for font files and static assets.
-- Noto Sans CJK font files (~17MB per TTF) are downloaded on-demand by edge functions.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('studio-assets', 'studio-assets', false, 52428800, ARRAY['font/ttf', 'font/otf', 'application/x-font-ttf', 'application/octet-stream'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY studio_assets_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'studio-assets' AND (SELECT public.studio_can_write()));

CREATE POLICY studio_assets_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-assets' AND (SELECT public.studio_can_write()));

CREATE POLICY studio_assets_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'studio-assets' AND (SELECT public.studio_can_write()))
  WITH CHECK (bucket_id = 'studio-assets' AND (SELECT public.studio_can_write()));
