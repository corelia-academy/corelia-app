-- Fix tier_limits: correct values (previous migration had column shift bug) + new pricing
-- Student: 79k/month, 690k/year | Pro: 149k/month, 1290k/year | Bootcamp: 399k/month, 3490k/year
-- Message limits based on GPT-5.4 mini pricing ($0.75/1M input, $4.50/1M output) at 25% margin

UPDATE public.tier_limits SET
  monthly_messages    = 50,
  rolling_3h_soft_cap = 5,
  haiku_only          = true,
  price_vnd_monthly   = 0,
  updated_at          = now()
WHERE tier = 'free';

UPDATE public.tier_limits SET
  monthly_messages    = 700,
  rolling_3h_soft_cap = 70,
  haiku_only          = true,
  price_vnd_monthly   = 79000,
  updated_at          = now()
WHERE tier = 'student';

UPDATE public.tier_limits SET
  monthly_messages    = 1000,
  rolling_3h_soft_cap = 100,
  haiku_only          = false,
  price_vnd_monthly   = 149000,
  updated_at          = now()
WHERE tier = 'pro';

UPDATE public.tier_limits SET
  monthly_messages    = 2000,
  rolling_3h_soft_cap = 200,
  haiku_only          = false,
  price_vnd_monthly   = 399000,
  updated_at          = now()
WHERE tier = 'bootcamp';
