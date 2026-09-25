-- Reconcile the production incident fix. The production OC issuer key belongs
-- to mainnet; keep staging course credentials on the sandbox network.
update public.credential_templates
set network_override = 'mainnet'
where course_id = '12036912-dac5-450c-8790-a424521e0936'
  and scope_type = 'course'
  and identifier_prefix = 'corelia:unihackfest-2026'
  and exists (
    select 1 from public.system_settings
    where key = 'corelia_app_base_url'
      and value = 'https://app.corelia.academy'
  );
