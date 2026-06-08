-- Fix existing OCA credential templates that incorrectly have achievement_type = 'Badge'.
--
-- These were created before the OCA/OCB distinction was enforced in the frontend.
-- OCA (collection_symbol IS NULL) must use CertificateOfCompletion, MicroCredential, or Diploma.
-- 'Badge' is only valid for OCB (collection_symbol = 'ocbadge').

UPDATE public.credential_templates
SET achievement_type = 'CertificateOfCompletion'
WHERE collection_symbol IS NULL
  AND achievement_type = 'Badge';
