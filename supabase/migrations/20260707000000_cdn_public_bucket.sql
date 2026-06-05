-- Migration: Create public `cdn` bucket for permanent credential image URLs.
--
-- OC credential payloads embed image_url permanently on-chain.
-- The `app` bucket uses 1-year signed URLs which will expire, breaking
-- badge images on the OC dashboard. This migration creates a public bucket
-- so credential images have permanent, non-expiring URLs at cdn.corelia.academy.
--
-- Path layout inside `cdn`:
--   credential-badges/course/{courseId}/{timestamp}.{ext}
--   credential-badges/hackathon/{hackathonId}/{timestamp}.{ext}
--   credential-badges/activity-milestone/{id}.{ext}
--   brand/{filename}

-- ─────────────────────────────────────────────────────────────
-- 1. Bucket
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cdn', 'cdn', true, 5242880)   -- 5 MB max per file
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 2. Public read — anyone can download (no auth needed)
-- ─────────────────────────────────────────────────────────────
CREATE POLICY cdn_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cdn');

-- ─────────────────────────────────────────────────────────────
-- 3. Course credential badges
--    path: credential-badges/course/{courseId}/...
-- ─────────────────────────────────────────────────────────────
CREATE POLICY cdn_course_badges_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'course'
    AND private.can_manage_corelia_course_ocb(
          (storage.foldername(name))[3],
          (SELECT auth.uid())
        )
  );

CREATE POLICY cdn_course_badges_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'course'
    AND private.can_manage_corelia_course_ocb(
          (storage.foldername(name))[3],
          (SELECT auth.uid())
        )
  );

CREATE POLICY cdn_course_badges_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'course'
    AND private.can_manage_corelia_course_ocb(
          (storage.foldername(name))[3],
          (SELECT auth.uid())
        )
  );

-- ─────────────────────────────────────────────────────────────
-- 4. Hackathon credential badges
--    path: credential-badges/hackathon/{hackathonId}/...
-- ─────────────────────────────────────────────────────────────
CREATE POLICY cdn_hackathon_badges_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'hackathon'
    AND private.can_manage_hackathon(
          (storage.foldername(name))[3],
          (SELECT auth.uid())
        )
  );

CREATE POLICY cdn_hackathon_badges_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'hackathon'
    AND private.can_manage_hackathon(
          (storage.foldername(name))[3],
          (SELECT auth.uid())
        )
  );

CREATE POLICY cdn_hackathon_badges_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'hackathon'
    AND private.can_manage_hackathon(
          (storage.foldername(name))[3],
          (SELECT auth.uid())
        )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Activity milestone badges (admin/support only)
--    path: credential-badges/activity-milestone/{id}.{ext}
-- ─────────────────────────────────────────────────────────────
CREATE POLICY cdn_milestone_badges_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'activity-milestone'
    AND public.is_admin_or_support()
  );

CREATE POLICY cdn_milestone_badges_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'activity-milestone'
    AND public.is_admin_or_support()
  );

CREATE POLICY cdn_milestone_badges_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'credential-badges'
    AND (storage.foldername(name))[2] = 'activity-milestone'
    AND public.is_admin_or_support()
  );

-- ─────────────────────────────────────────────────────────────
-- 6. Brand assets (admin/support only)
--    path: brand/{filename}
-- ─────────────────────────────────────────────────────────────
CREATE POLICY cdn_brand_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'brand'
    AND public.is_admin_or_support()
  );

CREATE POLICY cdn_brand_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'brand'
    AND public.is_admin_or_support()
  );

CREATE POLICY cdn_brand_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cdn'
    AND (storage.foldername(name))[1] = 'brand'
    AND public.is_admin_or_support()
  );

-- ─────────────────────────────────────────────────────────────
-- 7. Update institution logo URL to CDN domain
--    (will be a no-op until cdn.corelia.academy is live;
--     update manually if CDN domain is not yet configured)
-- ─────────────────────────────────────────────────────────────
UPDATE public.system_settings
SET value = 'https://cdn.corelia.academy/brand/corelia-logo-1300.png'
WHERE key = 'corelia_logo_url'
  AND value = 'https://app.corelia.academy/brand/corelia-logo-1300.png';
