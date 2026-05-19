ALTER TABLE public.ai_voucher_batches
  ADD COLUMN target_tier text
    CHECK (target_tier IN ('student', 'pro', 'bootcamp')),
  ADD COLUMN target_duration_months int
    CHECK (target_duration_months IN (1, 12));
