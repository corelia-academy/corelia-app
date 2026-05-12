-- Allow admins and hackathon reviewer_emails to update registration documents (application review).

CREATE POLICY hackathon_registrations_update_staff_or_reviewer
  ON public.hackathon_registrations
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      INNER JOIN public.profiles p ON p.id = auth.uid()
      WHERE h.id = hackathon_registrations.hackathon_id
        AND p.email IS NOT NULL
        AND trim(lower(p.email::text)) IN (
          SELECT trim(lower(elem))
          FROM jsonb_array_elements_text(
            COALESCE(h.document->'reviewer_emails', '[]'::jsonb)
          ) AS elem
        )
    )
  )
  WITH CHECK (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.hackathons h
      INNER JOIN public.profiles p ON p.id = auth.uid()
      WHERE h.id = hackathon_registrations.hackathon_id
        AND p.email IS NOT NULL
        AND trim(lower(p.email::text)) IN (
          SELECT trim(lower(elem))
          FROM jsonb_array_elements_text(
            COALESCE(h.document->'reviewer_emails', '[]'::jsonb)
          ) AS elem
        )
    )
  );
