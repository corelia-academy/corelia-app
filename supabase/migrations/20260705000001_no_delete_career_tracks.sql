-- Prevent instructors from deleting career tracks.
-- Only admin/support can delete. career_track_courses remains deletable by owners (needed for editing track content).

DROP POLICY IF EXISTS career_tracks_delete_owner_or_staff ON public.career_tracks;
CREATE POLICY career_tracks_delete_admin_only
  ON public.career_tracks FOR DELETE
  TO authenticated
  USING (public.is_admin_or_support());

DROP POLICY IF EXISTS career_track_locales_delete_manage ON public.career_track_locales;
CREATE POLICY career_track_locales_delete_admin_only
  ON public.career_track_locales FOR DELETE
  TO authenticated
  USING (public.is_admin_or_support());
