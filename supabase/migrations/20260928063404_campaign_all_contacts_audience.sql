ALTER TABLE public.email_campaigns
  ADD COLUMN audience_type text NOT NULL DEFAULT 'list'
    CHECK (audience_type IN ('list', 'all_contacts'));

ALTER TABLE public.email_campaigns
  ALTER COLUMN list_id DROP NOT NULL,
  ADD CONSTRAINT email_campaigns_audience_list_check
    CHECK ((audience_type = 'list' AND list_id IS NOT NULL)
        OR (audience_type = 'all_contacts' AND list_id IS NULL));

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
  IF v_campaign.audience_type = 'all_contacts' THEN
    SELECT count(*) INTO v_total FROM public.email_contacts;
  ELSE
    SELECT count(*) INTO v_total FROM public.email_list_members WHERE list_id = v_campaign.list_id;
  END IF;
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
  FROM public.email_contacts c
  WHERE v_campaign.audience_type = 'all_contacts'
     OR EXISTS (
       SELECT 1 FROM public.email_list_members lm
       WHERE lm.list_id = v_campaign.list_id AND lm.contact_id = c.id
     )
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
