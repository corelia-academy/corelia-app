-- The learning app moved from app.corelia.academy (and the staging root) to
-- the /learn path of the shared domain; the Astro landing site owns the root.
-- Certificate verify and credential claim links are built from this setting.
-- Only rewrite the known defaults so an admin-customised value is kept.
update public.system_settings
set value = case value
  when 'https://app.corelia.academy' then 'https://corelia.academy/learn'
  when 'https://staging.corelia.academy' then 'https://staging.corelia.academy/learn'
end,
    updated_at = now()
where key = 'corelia_app_base_url'
  and value in ('https://app.corelia.academy', 'https://staging.corelia.academy');
