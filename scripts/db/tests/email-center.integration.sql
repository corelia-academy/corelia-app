DO $test$
DECLARE
  v_actor uuid := 'ec000000-0000-4000-8000-000000000001';
  v_list_id uuid := 'ec000000-0000-4000-8000-000000000010';
  v_template_id uuid := 'ec000000-0000-4000-8000-000000000020';
  v_version_id uuid := 'ec000000-0000-4000-8000-000000000021';
  v_campaign_id uuid := 'ec000000-0000-4000-8000-000000000030';
  v_sender_id uuid;
  v_system_sender_id uuid;
  lease_one uuid := gen_random_uuid();
  lease_two uuid := gen_random_uuid();
  v_batch_key text;
  claimed integer;
BEGIN
  BEGIN
    IF has_table_privilege('anon', 'public.email_contacts', 'SELECT')
       OR has_table_privilege('authenticated', 'public.email_campaigns', 'INSERT') THEN
      RAISE EXCEPTION 'Email Center tables leaked to browser roles';
    END IF;
    IF (SELECT sending_enabled FROM public.email_settings WHERE singleton) THEN
      RAISE EXCEPTION 'Email sending kill switch must default off';
    END IF;
    IF (SELECT count(*) FROM public.email_senders) <> 4 THEN
      RAISE EXCEPTION 'Expected four default sender identities';
    END IF;

    INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES (v_actor, 'email-admin@corelia.local', '{}');
    UPDATE public.profiles SET role = 'admin' WHERE id = v_actor;
    IF NOT EXISTS (
      SELECT 1 FROM public.email_contacts
      WHERE user_id = v_actor AND email = 'email-admin@corelia.local'
        AND source_type = 'corelia' AND account_verified_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Corelia account was not synchronized into Email Center';
    END IF;
    UPDATE public.profiles SET full_name = 'Email Admin', locale = 'en' WHERE id = v_actor;
    IF NOT EXISTS (
      SELECT 1 FROM public.email_contacts
      WHERE user_id = v_actor AND full_name = 'Email Admin' AND locale = 'en'
    ) THEN
      RAISE EXCEPTION 'Profile changes were not synchronized into Email Center';
    END IF;
    UPDATE auth.users SET email = 'email-admin-changed@corelia.local' WHERE id = v_actor;
    IF (SELECT count(*) FROM public.email_contacts WHERE user_id = v_actor) <> 1
       OR NOT EXISTS (SELECT 1 FROM public.email_contacts WHERE user_id = v_actor AND email = 'email-admin-changed@corelia.local')
       OR NOT EXISTS (SELECT 1 FROM public.email_contacts WHERE user_id IS NULL AND email = 'email-admin@corelia.local') THEN
      RAISE EXCEPTION 'Email change did not preserve the old address and move the account link';
    END IF;
    PERFORM private.sync_email_contact_for_user(v_actor);
    PERFORM private.sync_email_contact_for_user(v_actor);
    IF (SELECT count(*) FROM public.email_contacts WHERE user_id = v_actor) <> 1 THEN
      RAISE EXCEPTION 'Account synchronization is not idempotent';
    END IF;
    INSERT INTO public.email_lists(id, name, created_by) VALUES (v_list_id, 'Integration list', v_actor);
    INSERT INTO public.email_contacts(id, email, full_name, locale) VALUES
      ('ec000000-0000-4000-8000-000000000101', 'one@example.com', 'One', 'vi'),
      ('ec000000-0000-4000-8000-000000000102', 'two@example.com', 'Two', DEFAULT),
      ('ec000000-0000-4000-8000-000000000103', 'blocked@example.com', 'Blocked', DEFAULT);
    INSERT INTO public.email_list_members(list_id, contact_id)
      SELECT v_list_id, id FROM public.email_contacts WHERE email IN ('one@example.com','two@example.com','blocked@example.com');
    INSERT INTO public.email_contact_consents(contact_id, topic, status, source)
      SELECT id, 'marketing', 'subscribed', 'test' FROM public.email_contacts WHERE email IN ('one@example.com','two@example.com');
    IF (SELECT count(*) FROM public.email_contacts WHERE marketing_status = 'subscribed' AND email IN ('one@example.com','two@example.com')) <> 2
       OR (SELECT marketing_status FROM public.email_contacts WHERE email = 'blocked@example.com') <> 'none' THEN
      RAISE EXCEPTION 'Denormalized marketing status is out of sync';
    END IF;
    INSERT INTO public.email_templates(id, name, purpose, created_by) VALUES (v_template_id, 'Marketing', 'marketing', v_actor);
    INSERT INTO public.email_template_versions(id, template_id, version, status, subject, body_text, localized_content, created_by, published_at)
      VALUES (v_version_id, v_template_id, 1, 'published', 'Hello {{name}}', 'Body', jsonb_build_object(
        'vi', jsonb_build_object('subject','Chào {{name}}','body_text','Nội dung'),
        'en', jsonb_build_object('subject','Hello {{name}}','body_text','Body')
      ), v_actor, now());
    SELECT id INTO v_sender_id FROM public.email_senders WHERE purpose = 'marketing' AND is_default;
    INSERT INTO public.email_campaigns(id, name, purpose, list_id, sender_id, template_version_id, frozen_subject, frozen_html, frozen_from, frozen_reply_to, created_by)
      VALUES (v_campaign_id, 'Integration campaign', 'marketing', v_list_id, v_sender_id, v_version_id, 'Hello {{name}}', '<p>Body</p>', 'Corelia <hello@news.corelia.academy>', 'hello@corelia.academy', v_actor);

    PERFORM public.email_prepare_campaign(v_campaign_id);
    IF (SELECT prepared_recipients FROM public.email_campaigns WHERE id = v_campaign_id) <> 2
       OR (SELECT suppressed_count FROM public.email_campaigns WHERE id = v_campaign_id) <> 1 THEN
      RAISE EXCEPTION 'Campaign preparation eligibility counts are wrong';
    END IF;
    IF (SELECT count(*) FROM public.email_campaign_recipients WHERE campaign_id=v_campaign_id AND resolved_locale='vi') <> 1
       OR (SELECT count(*) FROM public.email_campaign_recipients WHERE campaign_id=v_campaign_id AND resolved_locale='en') <> 2 THEN
      RAISE EXCEPTION 'Campaign recipient locales were not frozen with English fallback';
    END IF;

    SELECT count(*), min(dispatch_batch_key) INTO claimed, v_batch_key
    FROM public.email_claim_campaign_recipients(v_campaign_id, 2, lease_one);
    IF claimed <> 2 OR v_batch_key IS NULL THEN
      RAISE EXCEPTION 'Atomic claim did not return the expected fixed batch';
    END IF;
    UPDATE public.email_campaign_recipients
      SET status = 'queued', lease_token = NULL, lease_acquired_at = NULL, next_attempt_at = now()
      WHERE campaign_id = v_campaign_id AND dispatch_batch_key = v_batch_key;
    SELECT count(*) INTO claimed FROM public.email_claim_campaign_recipients(v_campaign_id, 1, lease_two);
    IF claimed <> 2 THEN
      RAISE EXCEPTION 'Retry changed provider batch membership';
    END IF;
    PERFORM public.email_commit_campaign_batch(
      v_batch_key,
      lease_two,
      (SELECT jsonb_agg(jsonb_build_object('id', id, 'provider_message_id', 'provider-' || id::text))
       FROM public.email_campaign_recipients WHERE dispatch_batch_key = v_batch_key)
    );
    PERFORM public.email_refresh_campaign_counts(v_campaign_id);
    IF (SELECT accepted_count FROM public.email_campaigns WHERE id = v_campaign_id) <> 2 THEN
      RAISE EXCEPTION 'Campaign aggregate refresh is wrong';
    END IF;

    INSERT INTO public.email_templates(id, name, purpose, created_by)
      VALUES ('ec000000-0000-4000-8000-000000000040', 'Welcome', 'system', v_actor);
    INSERT INTO public.email_template_versions(id, template_id, version, status, subject, body_text, localized_content, created_by, published_at)
      VALUES ('ec000000-0000-4000-8000-000000000041', 'ec000000-0000-4000-8000-000000000040', 1, 'published', 'Welcome', 'Welcome', jsonb_build_object(
        'vi', jsonb_build_object('subject','Chào mừng','body_text','Chào mừng'),
        'en', jsonb_build_object('subject','Welcome','body_text','Welcome')
      ), v_actor, now());
    INSERT INTO public.email_automations(id, name, trigger_type, purpose, enabled, created_by)
      VALUES ('ec000000-0000-4000-8000-000000000050', 'Welcome once', 'account_verified', 'system', true, v_actor);
    SELECT id INTO v_system_sender_id FROM public.email_senders WHERE purpose = 'system' AND is_default;
    INSERT INTO public.email_automation_steps(automation_id, position, template_version_id, sender_id)
      VALUES ('ec000000-0000-4000-8000-000000000050', 0, 'ec000000-0000-4000-8000-000000000041', v_system_sender_id);
    UPDATE auth.users SET email_confirmed_at = now() WHERE id = v_actor;
    UPDATE auth.users SET email_confirmed_at = now() WHERE id = v_actor;
    IF (SELECT count(*) FROM public.email_automation_enrollments WHERE automation_id = 'ec000000-0000-4000-8000-000000000050') <> 1 THEN
      RAISE EXCEPTION 'Verified-account automation was not idempotent';
    END IF;

    RAISE SQLSTATE 'Z0001' USING MESSAGE = 'rollback test fixtures';
  EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
  END;
END;
$test$;
