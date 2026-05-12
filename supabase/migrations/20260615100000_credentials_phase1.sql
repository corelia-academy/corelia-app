-- Credentials Phase 1: OCB templates + issuances + system_settings
-- Aligns with docs/Credentials_Phase_1_Spec.md (FKs: courses/hackathons id = text, users = uuid).

-- ─── system_settings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_settings_staff_all ON public.system_settings;
CREATE POLICY system_settings_staff_all
  ON public.system_settings FOR ALL TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

INSERT INTO public.system_settings (key, value) VALUES
  ('default_mint_network', 'staging'),
  ('opencampus_staging_endpoint', 'https://api.vc.staging.opencampus.xyz/issuer/vc'),
  ('opencampus_mainnet_endpoint', 'https://api.vc.opencampus.xyz/issuer/vc'),
  ('mint_retry_max_count', '3'),
  ('mint_retry_backoff_base_seconds', '60'),
  ('corelia_logo_url', 'https://app.corelia.academy/brand/corelia-logo-1300.png'),
  ('corelia_app_base_url', 'https://app.corelia.academy')
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS trg_system_settings_touch_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_touch_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

-- ─── credential_templates ────────────────────────────────────────────────────

CREATE TABLE public.credential_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  scope_type text NOT NULL CHECK (scope_type IN ('course', 'hackathon', 'activity_milestone')),

  course_id text REFERENCES public.courses (id) ON DELETE CASCADE,
  hackathon_id text REFERENCES public.hackathons (id) ON DELETE CASCADE,
  hackathon_role text,

  name text NOT NULL,
  description text NOT NULL,
  image_url text NOT NULL,

  achievement_type text NOT NULL CHECK (achievement_type IN ('Badge', 'Award')),
  identifier_prefix text NOT NULL CHECK (
    length(trim(identifier_prefix)) > 0 AND length(identifier_prefix) <= 40
  ),
  collection_symbol text NOT NULL CHECK (
    collection_symbol IN ('corelia-courses', 'corelia-hackathons', 'corelia-achievements')
  ),

  custom_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  trigger_type text NOT NULL CHECK (trigger_type IN ('auto', 'manual')),
  trigger_rule jsonb,

  network_override text CHECK (network_override IN ('staging', 'mainnet')),

  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT credential_templates_scope_consistency CHECK (
    (scope_type = 'course' AND course_id IS NOT NULL AND hackathon_id IS NULL)
    OR (
      scope_type = 'hackathon'
      AND hackathon_id IS NOT NULL
      AND course_id IS NULL
      AND hackathon_role IS NOT NULL
    )
    OR (scope_type = 'activity_milestone' AND course_id IS NULL AND hackathon_id IS NULL)
  )
);

CREATE INDEX credential_templates_scope_active_idx
  ON public.credential_templates (scope_type, is_active);

CREATE INDEX credential_templates_course_id_idx
  ON public.credential_templates (course_id)
  WHERE course_id IS NOT NULL;

CREATE INDEX credential_templates_hackathon_id_idx
  ON public.credential_templates (hackathon_id)
  WHERE hackathon_id IS NOT NULL;

CREATE UNIQUE INDEX credential_templates_unique_active_course_idx
  ON public.credential_templates (course_id)
  WHERE scope_type = 'course' AND is_active = true;

DROP TRIGGER IF EXISTS trg_credential_templates_touch_updated_at ON public.credential_templates;
CREATE TRIGGER trg_credential_templates_touch_updated_at
  BEFORE UPDATE ON public.credential_templates
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

-- ─── credential_issuances ─────────────────────────────────────────────────────

CREATE TABLE public.credential_issuances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.credential_templates (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  course_id text REFERENCES public.courses (id) ON DELETE SET NULL,
  hackathon_id text REFERENCES public.hackathons (id) ON DELETE SET NULL,

  issuer_reference_id text NOT NULL,
  network text NOT NULL CHECK (network IN ('staging', 'mainnet')),

  status text NOT NULL CHECK (status IN ('pending', 'minted', 'failed')),

  oc_request_payload jsonb,
  oc_response jsonb,
  oc_credential_id text,

  minted_at timestamptz,
  error_message text,
  retry_count int NOT NULL DEFAULT 0,

  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  granted_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (issuer_reference_id, network)
);

CREATE INDEX credential_issuances_user_status_idx
  ON public.credential_issuances (user_id, status);

CREATE INDEX credential_issuances_template_idx
  ON public.credential_issuances (template_id);

CREATE INDEX credential_issuances_status_created_idx
  ON public.credential_issuances (status, created_at);

DROP TRIGGER IF EXISTS trg_credential_issuances_touch_updated_at ON public.credential_issuances;
CREATE TRIGGER trg_credential_issuances_touch_updated_at
  BEFORE UPDATE ON public.credential_issuances
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

-- ─── RLS credential_templates ────────────────────────────────────────────────

ALTER TABLE public.credential_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY credential_templates_select
  ON public.credential_templates FOR SELECT TO authenticated
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1
      FROM public.credential_issuances ci
      WHERE ci.template_id = credential_templates.id
        AND ci.user_id = auth.uid()
    )
    OR (
      scope_type = 'course'
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_templates.course_id
          AND (
            c.instructor_id = auth.uid()
            OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
          )
      )
    )
    OR (
      scope_type = 'hackathon'
      AND EXISTS (
        SELECT 1
        FROM public.hackathons h
        WHERE h.id = credential_templates.hackathon_id
          AND (h.document->>'created_by') = (auth.uid()::text)
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );

CREATE POLICY credential_templates_insert
  ON public.credential_templates FOR INSERT TO authenticated
  WITH CHECK (
    (
      scope_type = 'course'
      AND course_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_templates.course_id
          AND (
            public.is_admin_or_support()
            OR c.instructor_id = auth.uid()
            OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
          )
      )
    )
    OR (
      scope_type = 'hackathon'
      AND hackathon_id IS NOT NULL
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = (auth.uid()::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );

CREATE POLICY credential_templates_update
  ON public.credential_templates FOR UPDATE TO authenticated
  USING (
    (
      scope_type = 'course'
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_templates.course_id
          AND (
            public.is_admin_or_support()
            OR c.instructor_id = auth.uid()
            OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
          )
      )
    )
    OR (
      scope_type = 'hackathon'
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = (auth.uid()::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  )
  WITH CHECK (
    (
      scope_type = 'course'
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_templates.course_id
          AND (
            public.is_admin_or_support()
            OR c.instructor_id = auth.uid()
            OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
          )
      )
    )
    OR (
      scope_type = 'hackathon'
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = (auth.uid()::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );

CREATE POLICY credential_templates_delete
  ON public.credential_templates FOR DELETE TO authenticated
  USING (
    (
      scope_type = 'course'
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_templates.course_id
          AND (
            public.is_admin_or_support()
            OR c.instructor_id = auth.uid()
            OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
          )
      )
    )
    OR (
      scope_type = 'hackathon'
      AND (
        public.is_admin_or_support()
        OR EXISTS (
          SELECT 1
          FROM public.hackathons h
          WHERE h.id = credential_templates.hackathon_id
            AND (h.document->>'created_by') = (auth.uid()::text)
        )
      )
    )
    OR (
      scope_type = 'activity_milestone'
      AND public.is_admin_or_support()
    )
  );

-- ─── RLS credential_issuances (client read-only; writes via service role / Edge) ─

ALTER TABLE public.credential_issuances ENABLE ROW LEVEL SECURITY;

CREATE POLICY credential_issuances_select
  ON public.credential_issuances FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
    OR (
      course_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = credential_issuances.course_id
          AND (
            c.instructor_id = auth.uid()
            OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
          )
      )
    )
    OR (
      hackathon_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.hackathons h
        WHERE h.id = credential_issuances.hackathon_id
          AND (
            public.is_admin_or_support()
            OR (h.document->>'created_by') = (auth.uid()::text)
          )
      )
    )
  );
