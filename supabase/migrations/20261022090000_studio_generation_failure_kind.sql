-- Corelia Studio: why a generation failed.
--
--   transport  the request never reached the provider (network error, interrupted submit)
--   provider   the provider accepted the request and then failed it (server error, no flex
--              capacity): says nothing about the model's answer
--   rejected   the model answered and the answer was refused (acceptance check, or the output
--              budget ran out)
--
-- Only rejected attempts use the model's retry budget; the other two have their own limit, and a
-- retry after a provider failure goes to the default service tier. Rows failed before this
-- migration keep NULL and are classified from provider_request_id as before.

ALTER TABLE public.studio_generations
  ADD COLUMN failure_kind text CHECK (failure_kind IN ('transport', 'provider', 'rejected'));

ALTER TABLE public.studio_generations
  ADD CONSTRAINT studio_generations_failure_kind_only_failed
    CHECK (failure_kind IS NULL OR status = 'failed');
