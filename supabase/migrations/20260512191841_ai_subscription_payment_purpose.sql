ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_purpose_check;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_purpose_check
  CHECK (purpose IN ('course_purchase', 'certificate_fee', 'ai_subscription'));
