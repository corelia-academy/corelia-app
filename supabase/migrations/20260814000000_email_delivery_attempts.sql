-- Provider acceptance audit for application-generated email. Do not store email
-- bodies, authentication links, or tokens here.
CREATE TABLE public.email_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  mail_type text NOT NULL,
  recipient_email text NOT NULL,
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text,
  provider_status text NOT NULL CHECK (provider_status IN ('accepted', 'provider_error', 'skipped')),
  provider_http_status integer
);

CREATE INDEX email_delivery_attempts_recipient_created_idx
  ON public.email_delivery_attempts (recipient_email, created_at DESC);

CREATE INDEX email_delivery_attempts_type_created_idx
  ON public.email_delivery_attempts (mail_type, created_at DESC);

ALTER TABLE public.email_delivery_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_delivery_attempts IS
  'Service-role-only audit of mail provider submission attempts; acceptance is not proof of inbox delivery.';
