ALTER TABLE public.tier_limits
  ADD COLUMN IF NOT EXISTS rolling_3h_soft_cap int;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tier_limits'
      AND column_name = 'daily_soft_cap'
  ) THEN
    EXECUTE '
      UPDATE public.tier_limits
      SET rolling_3h_soft_cap = COALESCE(rolling_3h_soft_cap, daily_soft_cap)
    ';
  END IF;
END $$;

UPDATE public.tier_limits
SET
  monthly_messages = CASE tier
    WHEN 'free' THEN 40
    WHEN 'student' THEN 250
    WHEN 'pro' THEN 700
    WHEN 'bootcamp' THEN 1800
  END,
  rolling_3h_soft_cap = CASE tier
    WHEN 'free' THEN 6
    WHEN 'student' THEN 20
    WHEN 'pro' THEN 50
    WHEN 'bootcamp' THEN 120
  END,
  price_vnd_monthly = CASE tier
    WHEN 'free' THEN 0
    WHEN 'student' THEN 99000
    WHEN 'pro' THEN 199000
    WHEN 'bootcamp' THEN 499000
  END,
  updated_at = now()
WHERE tier IN ('free', 'student', 'pro', 'bootcamp');

ALTER TABLE public.tier_limits
  DROP COLUMN IF EXISTS daily_messages,
  DROP COLUMN IF EXISTS daily_soft_cap;
