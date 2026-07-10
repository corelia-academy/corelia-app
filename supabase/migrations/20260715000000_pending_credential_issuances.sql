-- Ghost minting: stage a manually-granted credential against an email that has no
-- account yet. private.handle_new_user() converts matching rows into real
-- credential_issuances the moment that email signs up (see next migration).

CREATE TABLE public.pending_credential_issuances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  email text NOT NULL,
  template_id uuid NOT NULL REFERENCES public.credential_templates (id) ON DELETE CASCADE,
  network text NOT NULL CHECK (network IN ('staging', 'mainnet')),

  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  granted_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (email, template_id)
);

CREATE INDEX pending_credential_issuances_email_idx
  ON public.pending_credential_issuances (lower(email));

ALTER TABLE public.pending_credential_issuances ENABLE ROW LEVEL SECURITY;

-- Staff-only. The public /claim lookup and the signup trigger both read this table
-- via the service-role client, never via the anon/authenticated client, so no
-- broader SELECT policy is needed here.
CREATE POLICY pending_credential_issuances_staff_all
  ON public.pending_credential_issuances FOR ALL TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

-- Set by private.handle_new_user() when it converts pending rows for this email
-- into real credential_issuances; cleared by the client once the welcome modal
-- has been shown.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_credentials_claimed_at timestamptz;
