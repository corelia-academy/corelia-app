-- Credentials: align collection_symbol and achievement_type with OpenCampus spec
--
-- collection_symbol:
--   'ocbadge'  → OCB (Open Campus Badge) — sent as collectionSymbol in payload
--   NULL       → OCA (Open Campus Achievement) — collectionSymbol omitted → OC defaults to OCA
--
-- achievement_type per VC type:
--   OCB : 'Badge' | 'Award'
--   OCA : 'MicroCredential' | 'Diploma' | 'CertificateOfCompletion'
--
-- Program → VC type mapping:
--   Online eLearning (single course) → OCB  Badge
--   Career Track Certificate         → OCA  MicroCredential
--   Offline 6-Month Certificate      → OCA  Diploma
--   Bootcamp                         → OCA  CertificateOfCompletion
--   Course (admin choice)            → OCB  Badge  OR  OCA  CertificateOfCompletion
--   Mini / Public Hackathon          → OCB  Award
--   Activity Milestone               → OCB  Badge

-- ─── drop ALL existing constraints on collection_symbol first ────────────────
-- The remote DB may have a constraint that only allows old 'corelia-*' values.
-- We must drop it before touching any data or adding new constraints.

ALTER TABLE public.credential_templates
  DROP CONSTRAINT IF EXISTS credential_templates_collection_symbol_check;

-- Also drop the cross-validation constraint (references collection_symbol) if it exists.
ALTER TABLE public.credential_templates
  DROP CONSTRAINT IF EXISTS credential_templates_vctype_consistency_check;

-- ─── migrate existing rows ────────────────────────────────────────────────────
-- Old corelia-* symbols → OCB = 'ocbadge'. achievement_type 'Badge'/'Award' already valid for OCB.
UPDATE public.credential_templates
  SET collection_symbol = 'ocbadge'
  WHERE collection_symbol IN ('corelia-courses', 'corelia-hackathons', 'corelia-achievements');

-- ─── credential_templates: relax collection_symbol ───────────────────────────

ALTER TABLE public.credential_templates
  ALTER COLUMN collection_symbol DROP NOT NULL;

ALTER TABLE public.credential_templates
  ADD CONSTRAINT credential_templates_collection_symbol_check
    CHECK (collection_symbol IS NULL OR collection_symbol = 'ocbadge');

-- ─── credential_templates: expand achievement_type ───────────────────────────

ALTER TABLE public.credential_templates
  DROP CONSTRAINT IF EXISTS credential_templates_achievement_type_check;

ALTER TABLE public.credential_templates
  ADD CONSTRAINT credential_templates_achievement_type_check
    CHECK (achievement_type IN (
      'Badge',
      'Award',
      'MicroCredential',
      'Diploma',
      'CertificateOfCompletion'
    ));

-- ─── cross-validation: OCB types ↔ OCA types must not be mixed ───────────────
--
-- OCB (collection_symbol = 'ocbadge') must use Badge or Award.
-- OCA (collection_symbol IS NULL)     must use MicroCredential, Diploma, or CertificateOfCompletion.

ALTER TABLE public.credential_templates
  DROP CONSTRAINT IF EXISTS credential_templates_vctype_consistency_check;

ALTER TABLE public.credential_templates
  ADD CONSTRAINT credential_templates_vctype_consistency_check CHECK (
    (collection_symbol = 'ocbadge' AND achievement_type IN ('Badge', 'Award'))
    OR
    (collection_symbol IS NULL AND achievement_type IN ('MicroCredential', 'Diploma', 'CertificateOfCompletion'))
  );
