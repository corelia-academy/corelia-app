-- Email Center: service-role managed email orchestration, contacts, campaigns,
-- automations, provider events, and a private import bucket.

CREATE TABLE public.email_senders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL CHECK (purpose IN ('system','learning','event','marketing')),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  from_email text NOT NULL UNIQUE CHECK (from_email = lower(from_email)),
  reply_to text NOT NULL CHECK (reply_to = lower(reply_to)),
  domain text NOT NULL CHECK (domain = lower(domain)),
  domain_status text NOT NULL DEFAULT 'pending' CHECK (domain_status IN ('pending','verified','failed')),
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX email_senders_one_default_per_purpose
  ON public.email_senders(purpose) WHERE is_default AND active;

CREATE TABLE public.email_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  full_name text,
  locale text NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi','en')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  global_suppressed_at timestamptz,
  suppression_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_contacts_created_idx ON public.email_contacts(created_at DESC, id DESC);

CREATE TABLE public.email_contact_consents (
  contact_id uuid NOT NULL REFERENCES public.email_contacts(id) ON DELETE CASCADE,
  topic text NOT NULL CHECK (topic ~ '^[a-z0-9_.-]{1,80}$'),
  status text NOT NULL CHECK (status IN ('subscribed','unsubscribed')),
  source text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, topic)
);

CREATE TABLE public.email_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  description text,
  source_type text NOT NULL DEFAULT 'import' CHECK (source_type IN ('import','course','program','hackathon','manual')),
  source_id text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.email_list_members (
  list_id uuid NOT NULL REFERENCES public.email_lists(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.email_contacts(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, contact_id)
);
CREATE INDEX email_list_members_contact_idx ON public.email_list_members(contact_id, list_id);

CREATE TABLE public.email_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.email_lists(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','processing','completed','failed')),
  cursor_row bigint NOT NULL DEFAULT 0,
  total_rows bigint,
  imported_count bigint NOT NULL DEFAULT 0,
  duplicate_count bigint NOT NULL DEFAULT 0,
  invalid_count bigint NOT NULL DEFAULT 0,
  error_report_path text,
  error_message text,
  lease_token uuid,
  lease_acquired_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_import_jobs_work_idx ON public.email_import_jobs(status, created_at);

CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  purpose text NOT NULL CHECK (purpose IN ('system','learning','event','marketing')),
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  version int NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  preheader text NOT NULL DEFAULT '',
  body_text text NOT NULL CHECK (char_length(body_text) <= 100000),
  cta_label text,
  cta_url text,
  image_url text,
  variables text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE(template_id, version)
);
CREATE UNIQUE INDEX email_template_one_draft ON public.email_template_versions(template_id) WHERE status = 'draft';

CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  purpose text NOT NULL CHECK (purpose IN ('system','learning','event','marketing')),
  object_type text CHECK (object_type IS NULL OR object_type IN ('course','program','hackathon')),
  object_id text,
  list_id uuid NOT NULL REFERENCES public.email_lists(id),
  sender_id uuid NOT NULL REFERENCES public.email_senders(id),
  template_version_id uuid NOT NULL REFERENCES public.email_template_versions(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','preparing','ready','scheduled','running','paused','completed','cancelled','failed')),
  scheduled_at timestamptz,
  frozen_subject text,
  frozen_html text,
  frozen_from text NOT NULL,
  frozen_reply_to text NOT NULL,
  frozen_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_recipients bigint NOT NULL DEFAULT 0,
  prepared_recipients bigint NOT NULL DEFAULT 0,
  accepted_count bigint NOT NULL DEFAULT 0,
  delivered_count bigint NOT NULL DEFAULT 0,
  failed_count bigint NOT NULL DEFAULT 0,
  bounced_count bigint NOT NULL DEFAULT 0,
  complaint_count bigint NOT NULL DEFAULT 0,
  unsubscribed_count bigint NOT NULL DEFAULT 0,
  indeterminate_count bigint NOT NULL DEFAULT 0,
  suppressed_count bigint NOT NULL DEFAULT 0,
  guardrail_reason text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((object_type IS NULL) = (object_id IS NULL))
);
CREATE INDEX email_campaigns_queue_idx ON public.email_campaigns(status, scheduled_at, created_at);

CREATE TABLE public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.email_contacts(id),
  recipient_email text NOT NULL,
  personalization jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','accepted','delivered','failed','bounced','complained','unsubscribed','suppressed','indeterminate','cancelled')),
  provider_message_id text,
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_acquired_at timestamptz,
  dispatch_batch_key text,
  first_dispatched_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, contact_id)
);
CREATE INDEX email_campaign_recipients_work_idx
  ON public.email_campaign_recipients(status, next_attempt_at, created_at) WHERE status IN ('queued','indeterminate');
CREATE UNIQUE INDEX email_campaign_recipients_provider_idx
  ON public.email_campaign_recipients(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX email_campaign_recipients_batch_idx
  ON public.email_campaign_recipients(dispatch_batch_key) WHERE dispatch_batch_key IS NOT NULL;

CREATE TABLE public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('account_verified','course_enrolled','learning_inactive','object_registration_approved','course_completed','marketing_consent')),
  purpose text NOT NULL CHECK (purpose IN ('system','learning','event','marketing')),
  object_type text CHECK (object_type IS NULL OR object_type IN ('course','program','hackathon')),
  object_id text,
  enabled boolean NOT NULL DEFAULT false,
  stop_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((object_type IS NULL) = (object_id IS NULL))
);

CREATE TABLE public.email_automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  position int NOT NULL CHECK (position >= 0),
  delay_minutes int NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
  template_version_id uuid NOT NULL REFERENCES public.email_template_versions(id),
  sender_id uuid NOT NULL REFERENCES public.email_senders(id),
  UNIQUE(automation_id, position)
);

CREATE TABLE public.email_automation_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.email_contacts(id),
  trigger_key text NOT NULL,
  current_position int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','stopped','failed')),
  next_step_at timestamptz NOT NULL DEFAULT now(),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(automation_id, trigger_key)
);
CREATE INDEX email_automation_enrollments_work_idx ON public.email_automation_enrollments(status, next_step_at);

CREATE TABLE public.email_webhook_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  provider_message_id text,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE public.email_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_audit_logs_created_idx ON public.email_audit_logs(created_at DESC);

CREATE TABLE public.email_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  sending_enabled boolean NOT NULL DEFAULT false,
  max_recipients_per_campaign bigint NOT NULL DEFAULT 100000 CHECK (max_recipients_per_campaign > 0),
  worker_batch_size int NOT NULL DEFAULT 100 CHECK (worker_batch_size BETWEEN 1 AND 100),
  requests_per_second numeric(8,2) NOT NULL DEFAULT 2 CHECK (requests_per_second > 0),
  next_provider_request_at timestamptz NOT NULL DEFAULT now(),
  bounce_pause_percent numeric(5,2) NOT NULL DEFAULT 4 CHECK (bounce_pause_percent > 0),
  complaint_pause_percent numeric(5,3) NOT NULL DEFAULT 0.08 CHECK (complaint_pause_percent > 0),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.email_settings(singleton) VALUES (true);

-- All Email Center tables are accessed through the service-role Edge boundary.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'email_senders','email_contacts','email_contact_consents','email_lists','email_list_members',
    'email_import_jobs','email_templates','email_template_versions','email_campaigns',
    'email_campaign_recipients','email_automations','email_automation_steps',
    'email_automation_enrollments','email_webhook_events','email_audit_logs','email_settings'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('email-imports', 'email-imports', false, 52428800, ARRAY['text/csv','text/plain','application/vnd.ms-excel'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO public.email_senders(purpose, display_name, from_email, reply_to, domain, is_default)
VALUES
  ('system','Corelia','no-reply@system.corelia.academy','support@corelia.academy','system.corelia.academy',true),
  ('learning','Corelia Learning','notifications@learn.corelia.academy','support@corelia.academy','learn.corelia.academy',true),
  ('event','Corelia Events','notifications@events.corelia.academy','support@corelia.academy','events.corelia.academy',true),
  ('marketing','Corelia','hello@news.corelia.academy','hello@corelia.academy','news.corelia.academy',true);

CREATE OR REPLACE FUNCTION public.email_prepare_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_campaign public.email_campaigns%ROWTYPE;
  v_limit bigint;
  v_total bigint;
  v_eligible bigint;
BEGIN
  SELECT * INTO v_campaign FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR v_campaign.status <> 'draft' THEN RAISE EXCEPTION 'campaign_not_draft'; END IF;
  SELECT max_recipients_per_campaign INTO v_limit FROM public.email_settings WHERE singleton;
  SELECT count(*) INTO v_total FROM public.email_list_members WHERE list_id = v_campaign.list_id;
  IF v_total > v_limit THEN RAISE EXCEPTION 'campaign_operational_limit_exceeded:%', v_total; END IF;

  INSERT INTO public.email_campaign_recipients (
    campaign_id, contact_id, recipient_email, personalization, status
  )
  SELECT
    v_campaign.id,
    c.id,
    c.email,
    jsonb_build_object('name', coalesce(c.full_name, ''), 'locale', c.locale),
    CASE
      WHEN c.global_suppressed_at IS NOT NULL THEN 'suppressed'
      WHEN v_campaign.purpose = 'marketing' AND NOT EXISTS (
        SELECT 1 FROM public.email_contact_consents cc
        WHERE cc.contact_id = c.id AND cc.topic = 'marketing' AND cc.status = 'subscribed'
      ) THEN 'suppressed'
      WHEN v_campaign.object_type = 'course' AND EXISTS (
        SELECT 1 FROM public.notification_preferences np
        WHERE np.user_id = c.user_id AND np.email_course_blast = false
      ) THEN 'suppressed'
      WHEN v_campaign.object_type = 'program' AND EXISTS (
        SELECT 1 FROM public.notification_preferences np
        WHERE np.user_id = c.user_id AND np.email_track_blast = false
      ) THEN 'suppressed'
      ELSE 'queued'
    END
  FROM public.email_list_members lm
  JOIN public.email_contacts c ON c.id = lm.contact_id
  WHERE lm.list_id = v_campaign.list_id
  ON CONFLICT (campaign_id, contact_id) DO NOTHING;

  SELECT count(*) FILTER (WHERE status = 'queued')
    INTO v_eligible
  FROM public.email_campaign_recipients
  WHERE campaign_id = v_campaign.id;

  UPDATE public.email_campaigns SET
    status = 'ready',
    estimated_recipients = v_total,
    prepared_recipients = v_eligible,
    suppressed_count = v_total - v_eligible,
    updated_at = now()
  WHERE id = v_campaign.id;

  RETURN jsonb_build_object('total', v_total, 'eligible', v_eligible, 'suppressed', v_total - v_eligible);
END;
$$;
REVOKE ALL ON FUNCTION public.email_prepare_campaign(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_prepare_campaign(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.email_claim_campaign_recipients(
  p_campaign_id uuid,
  p_limit integer,
  p_lease_token uuid
)
RETURNS SETOF public.email_campaign_recipients
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_batch_key text;
BEGIN
  -- Retry or reclaim the exact same provider batch before creating a new one.
  SELECT r.dispatch_batch_key INTO v_batch_key
  FROM public.email_campaign_recipients r
  WHERE r.campaign_id = p_campaign_id
    AND r.dispatch_batch_key IS NOT NULL
    AND r.next_attempt_at <= now()
    AND (r.status = 'queued' OR (r.status = 'sending' AND r.lease_acquired_at < now() - interval '5 minutes'))
  ORDER BY r.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_batch_key IS NULL THEN
    v_batch_key := gen_random_uuid()::text;
    RETURN QUERY
    WITH candidates AS (
      SELECT r.id
      FROM public.email_campaign_recipients r
      WHERE r.campaign_id = p_campaign_id
        AND r.status = 'queued'
        AND r.dispatch_batch_key IS NULL
        AND r.next_attempt_at <= now()
      ORDER BY r.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT greatest(1, least(p_limit, 100))
    )
    UPDATE public.email_campaign_recipients r SET
      status = 'sending',
      dispatch_batch_key = v_batch_key,
      lease_token = p_lease_token,
      lease_acquired_at = now(),
      attempts = r.attempts + 1,
      updated_at = now()
    FROM candidates c
    WHERE r.id = c.id
    RETURNING r.*;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtextextended(v_batch_key, 0));
    RETURN QUERY
    UPDATE public.email_campaign_recipients r SET
      status = 'sending',
      lease_token = p_lease_token,
      lease_acquired_at = now(),
      attempts = r.attempts + 1,
      updated_at = now()
    WHERE r.campaign_id = p_campaign_id
      AND r.dispatch_batch_key = v_batch_key
      AND r.next_attempt_at <= now()
      AND (r.status = 'queued' OR (r.status = 'sending' AND r.lease_acquired_at < now() - interval '5 minutes'))
    RETURNING r.*;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.email_claim_campaign_recipients(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_claim_campaign_recipients(uuid, integer, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.email_commit_campaign_batch(
  p_batch_key text,
  p_lease_token uuid,
  p_results jsonb
)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH results AS (
    SELECT id, provider_message_id
    FROM jsonb_to_recordset(p_results) AS x(id uuid, provider_message_id text)
  ), updated AS (
    UPDATE public.email_campaign_recipients r SET
      status = 'accepted',
      provider_message_id = results.provider_message_id,
      lease_token = NULL,
      lease_acquired_at = NULL,
      last_error = NULL,
      updated_at = now()
    FROM results
    WHERE r.id = results.id
      AND r.dispatch_batch_key = p_batch_key
      AND r.lease_token = p_lease_token
      AND r.status = 'sending'
    RETURNING r.id
  )
  SELECT count(*)::integer FROM updated;
$$;
REVOKE ALL ON FUNCTION public.email_commit_campaign_batch(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_commit_campaign_batch(text, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.email_mark_campaign_batch_dispatched(p_batch_key text, p_lease_token uuid)
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH updated AS (
    UPDATE public.email_campaign_recipients SET
      first_dispatched_at = coalesce(first_dispatched_at, now()),
      updated_at = now()
    WHERE dispatch_batch_key = p_batch_key AND lease_token = p_lease_token AND status = 'sending'
    RETURNING id
  )
  SELECT count(*)::integer FROM updated;
$$;
REVOKE ALL ON FUNCTION public.email_mark_campaign_batch_dispatched(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_mark_campaign_batch_dispatched(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.email_refresh_campaign_counts(p_campaign_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.email_campaigns c SET
    accepted_count = s.accepted_count,
    delivered_count = s.delivered_count,
    failed_count = s.failed_count,
    bounced_count = s.bounced_count,
    complaint_count = s.complaint_count,
    unsubscribed_count = s.unsubscribed_count,
    indeterminate_count = s.indeterminate_count,
    suppressed_count = s.suppressed_count,
    updated_at = now()
  FROM (
    SELECT
      count(*) FILTER (WHERE status IN ('accepted','delivered','bounced','complained')) AS accepted_count,
      count(*) FILTER (WHERE status = 'delivered') AS delivered_count,
      count(*) FILTER (WHERE status = 'failed') AS failed_count,
      count(*) FILTER (WHERE status = 'bounced') AS bounced_count,
      count(*) FILTER (WHERE status = 'complained') AS complaint_count,
      count(*) FILTER (WHERE status = 'unsubscribed') AS unsubscribed_count,
      count(*) FILTER (WHERE status = 'indeterminate') AS indeterminate_count,
      count(*) FILTER (WHERE status = 'suppressed') AS suppressed_count
    FROM public.email_campaign_recipients
    WHERE campaign_id = p_campaign_id
  ) s
  WHERE c.id = p_campaign_id;
$$;
REVOKE ALL ON FUNCTION public.email_refresh_campaign_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_refresh_campaign_counts(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.email_apply_campaign_guardrails(p_campaign_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE v_campaign public.email_campaigns%ROWTYPE; v_settings public.email_settings%ROWTYPE; v_reason text;
BEGIN
  SELECT * INTO v_campaign FROM public.email_campaigns WHERE id = p_campaign_id FOR UPDATE;
  SELECT * INTO v_settings FROM public.email_settings WHERE singleton;
  IF v_campaign.accepted_count > 0 AND (v_campaign.bounced_count * 100.0 / v_campaign.accepted_count) >= v_settings.bounce_pause_percent THEN
    v_reason := 'bounce_threshold';
  ELSIF v_campaign.accepted_count > 0 AND (v_campaign.complaint_count * 100.0 / v_campaign.accepted_count) >= v_settings.complaint_pause_percent THEN
    v_reason := 'complaint_threshold';
  END IF;
  IF v_reason IS NOT NULL AND v_campaign.status IN ('scheduled','running') THEN
    UPDATE public.email_campaigns SET status = 'paused', guardrail_reason = v_reason, updated_at = now() WHERE id = p_campaign_id;
  END IF;
  RETURN v_reason;
END;
$$;
REVOKE ALL ON FUNCTION public.email_apply_campaign_guardrails(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_apply_campaign_guardrails(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.email_claim_import_job(p_lease_token uuid)
RETURNS SETOF public.email_import_jobs
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH candidate AS (
    SELECT j.id
    FROM public.email_import_jobs j
    WHERE j.status = 'uploaded'
       OR (j.status = 'processing' AND j.lease_acquired_at < now() - interval '5 minutes')
    ORDER BY j.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.email_import_jobs j SET
    status = 'processing',
    lease_token = p_lease_token,
    lease_acquired_at = now(),
    updated_at = now()
  FROM candidate c
  WHERE j.id = c.id
  RETURNING j.*;
$$;
REVOKE ALL ON FUNCTION public.email_claim_import_job(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_claim_import_job(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.email_reserve_provider_slot()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_settings public.email_settings%ROWTYPE;
  v_reserved_at timestamptz;
BEGIN
  SELECT * INTO v_settings FROM public.email_settings WHERE singleton FOR UPDATE;
  v_reserved_at := greatest(now(), v_settings.next_provider_request_at);
  UPDATE public.email_settings
  SET next_provider_request_at = v_reserved_at + ((1.0 / v_settings.requests_per_second) * interval '1 second')
  WHERE singleton;
  RETURN v_reserved_at;
END;
$$;
REVOKE ALL ON FUNCTION public.email_reserve_provider_slot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_reserve_provider_slot() TO service_role;

CREATE OR REPLACE FUNCTION private.enqueue_email_automations(
  p_user_id uuid,
  p_trigger_type text,
  p_trigger_key text,
  p_object_type text DEFAULT NULL,
  p_object_id text DEFAULT NULL,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_contact_id uuid;
BEGIN
  INSERT INTO public.email_contacts(user_id, email, full_name, locale, updated_at)
  SELECT u.id, lower(u.email), p.full_name, CASE WHEN p.locale = 'en' THEN 'en' ELSE 'vi' END, now()
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_user_id AND u.email IS NOT NULL
  ON CONFLICT (email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    full_name = coalesce(EXCLUDED.full_name, public.email_contacts.full_name),
    locale = EXCLUDED.locale,
    updated_at = now()
  RETURNING id INTO v_contact_id;
  IF v_contact_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.email_automation_enrollments(automation_id, contact_id, trigger_key, context, next_step_at)
  SELECT a.id, v_contact_id, p_trigger_key, p_context,
    now() + coalesce((SELECT min(s.delay_minutes) FROM public.email_automation_steps s WHERE s.automation_id = a.id AND s.position = 0), 0) * interval '1 minute'
  FROM public.email_automations a
  WHERE a.enabled
    AND a.trigger_type = p_trigger_type
    AND ((a.object_type IS NULL AND a.object_id IS NULL) OR (a.object_type = p_object_type AND a.object_id = p_object_id))
  ON CONFLICT (automation_id, trigger_key) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION private.enqueue_email_automations(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.email_on_account_verified()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.email_confirmed_at IS NULL) THEN
    PERFORM private.enqueue_email_automations(NEW.id, 'account_verified', 'account_verified:' || NEW.id::text, NULL, NULL, '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_email_account_verified ON auth.users;
CREATE TRIGGER trg_email_account_verified AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.email_on_account_verified();

CREATE OR REPLACE FUNCTION private.email_on_course_enrolled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_name text;
BEGIN
  SELECT coalesce(c.data->>'title', '') INTO v_name FROM public.courses c WHERE c.id = NEW.course_id;
  PERFORM private.enqueue_email_automations(NEW.user_id, 'course_enrolled', 'course_enrolled:' || NEW.id, 'course', NEW.course_id, jsonb_build_object('course_id', NEW.course_id, 'course_name', coalesce(v_name, '')));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_email_course_enrolled ON public.enrollments;
CREATE TRIGGER trg_email_course_enrolled AFTER INSERT ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION private.email_on_course_enrolled();

CREATE OR REPLACE FUNCTION private.email_on_hackathon_registration_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_title text;
BEGIN
  IF NEW.document->>'status' = 'approved' AND (TG_OP = 'INSERT' OR coalesce(OLD.document->>'status', '') <> 'approved') THEN
    SELECT coalesce(h.document->>'title', '') INTO v_title FROM public.hackathons h WHERE h.id = NEW.hackathon_id;
    PERFORM private.enqueue_email_automations(NEW.user_id, 'object_registration_approved', 'hackathon_registration_approved:' || NEW.id, 'hackathon', NEW.hackathon_id, jsonb_build_object('hackathon_id', NEW.hackathon_id, 'event_name', coalesce(v_title, '')));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_email_hackathon_registration_approved ON public.hackathon_registrations;
CREATE TRIGGER trg_email_hackathon_registration_approved AFTER INSERT OR UPDATE OF document ON public.hackathon_registrations
FOR EACH ROW EXECUTE FUNCTION private.email_on_hackathon_registration_approved();

COMMENT ON TABLE public.email_campaign_recipients IS 'One durable row per campaign recipient; enables cursor-style processing at 100k+ scale.';
COMMENT ON TABLE public.email_webhook_events IS 'Idempotent Resend webhook receipt store keyed by svix-id.';

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $schedule$
DECLARE existing_job record;
BEGIN
  FOR existing_job IN SELECT jobid FROM cron.job WHERE jobname = 'corelia-email-center'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END
$schedule$;
SELECT cron.schedule(
  'corelia-email-center',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'corelia_email_project_url') || '/functions/v1/cron-email-center',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-corelia-email-worker-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'corelia_email_worker_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);
