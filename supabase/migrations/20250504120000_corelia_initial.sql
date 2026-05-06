-- Corelia greenfield schema (Postgres + RLS) for Supabase
-- Replaces Firestore collections with relational + jsonb where helpful.

-- ─── Profiles (table + indexes before helper functions that reference profiles) ─

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'instructor', 'support_staff', 'admin')),
  full_name text,
  avatar_url text,
  phone text,
  email text,
  locale text DEFAULT 'vi',
  ocid text,
  ocid_eth_address text,
  ocid_connected_at timestamptz,
  instructor_origin text CHECK (instructor_origin IS NULL OR instructor_origin IN ('corelia', 'external')),
  instructor_headline text,
  instructor_bio text,
  instructor_organization text,
  instructor_website text,
  partner_contract_docs jsonb DEFAULT '[]'::jsonb,
  partner_invoice_docs jsonb DEFAULT '[]'::jsonb,
  partner_transfer_info text,
  partner_bank_name text,
  partner_bank_account_number text,
  partner_bank_account_holder text,
  partner_bank_transfer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_role_idx ON public.profiles (role);
CREATE INDEX profiles_instructor_origin_idx ON public.profiles (instructor_origin);

-- ─── Helpers (SECURITY DEFINER: avoid RLS recursion) ───────────────────────────

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_support()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
    ''
  ) IN ('admin', 'support_staff');
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_self_or_staff
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_admin_or_support()
  );

CREATE POLICY profiles_insert_self
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_self
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_staff
  ON public.profiles FOR UPDATE
  USING (public.is_admin_or_support());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, locale, full_name, email, created_at, updated_at)
  VALUES (
    NEW.id,
    'student',
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'locale', ''), 'vi'),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULL
    ),
    NEW.email,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ─── Courses (meta columns + jsonb body) ─────────────────────────────────────

CREATE TABLE public.courses (
  id text PRIMARY KEY,
  instructor_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  published boolean NOT NULL DEFAULT false,
  slug text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX courses_slug_key ON public.courses (slug);
CREATE INDEX courses_published_updated ON public.courses (published, updated_at DESC);
CREATE INDEX courses_instructor_updated ON public.courses (instructor_id, updated_at DESC);

CREATE TABLE public.course_sections (
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  id text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (course_id, id)
);

CREATE TABLE public.course_lessons (
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  id text NOT NULL,
  section_id text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (course_id, id),
  FOREIGN KEY (course_id, section_id)
    REFERENCES public.course_sections (course_id, id) ON DELETE CASCADE
);

CREATE TABLE public.course_locales (
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  locale text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (course_id, locale)
);

CREATE TABLE public.course_section_locales (
  course_id text NOT NULL,
  section_id text NOT NULL,
  locale text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (course_id, section_id, locale),
  FOREIGN KEY (course_id, section_id)
    REFERENCES public.course_sections (course_id, id) ON DELETE CASCADE
);

CREATE TABLE public.course_lesson_locales (
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  locale text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (course_id, lesson_id, locale),
  FOREIGN KEY (course_id, lesson_id)
    REFERENCES public.course_lessons (course_id, id) ON DELETE CASCADE
);

CREATE TABLE public.course_discounts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  code text NOT NULL,
  type text NOT NULL CHECK (type IN ('percent', 'amount_vnd')),
  value numeric NOT NULL,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions int,
  redeemed_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id),
  updated_by uuid REFERENCES auth.users (id)
);

CREATE INDEX course_discounts_course_code ON public.course_discounts (course_id, code);

-- RLS: courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY courses_select_public
  ON public.courses FOR SELECT
  USING (
    published = true
    OR instructor_id = auth.uid()
    OR public.is_admin_or_support()
    OR (data->'co_instructor_permissions') ? (auth.uid()::text)
  );

CREATE POLICY courses_insert_manager
  ON public.courses FOR INSERT
  WITH CHECK (
    instructor_id = auth.uid()
    OR public.is_admin_or_support()
  );

CREATE POLICY courses_update_manager
  ON public.courses FOR UPDATE
  USING (
    instructor_id = auth.uid()
    OR public.is_admin_or_support()
    OR (data->'co_instructor_permissions') ? (auth.uid()::text)
  );

CREATE POLICY courses_delete_manager
  ON public.courses FOR DELETE
  USING (
    instructor_id = auth.uid()
    OR public.is_admin_or_support()
  );

-- Child tables: same visibility as parent course (simplified)
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_section_locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lesson_locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_sections_all
  ON public.course_sections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY course_lessons_all
  ON public.course_lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY course_locales_all
  ON public.course_locales FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY course_section_locales_all
  ON public.course_section_locales FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY course_lesson_locales_all
  ON public.course_lesson_locales FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.published = true
          OR c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY course_discounts_select
  ON public.course_discounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY course_discounts_write
  ON public.course_discounts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

-- ─── Enrollments & progress ───────────────────────────────────────────────────

CREATE TABLE public.enrollments (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL,
  last_accessed_at timestamptz NOT NULL,
  paid_provider text,
  paid_amount_vnd int,
  paid_order_id text,
  paid_at timestamptz,
  certificate_issued_at timestamptz,
  UNIQUE (user_id, course_id)
);

CREATE INDEX enrollments_user_last ON public.enrollments (user_id, last_accessed_at DESC);
CREATE INDEX enrollments_course ON public.enrollments (course_id, enrolled_at DESC);

CREATE TABLE public.lesson_progress (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  completed_at timestamptz,
  watch_seconds int
);

CREATE INDEX lesson_progress_user_course ON public.lesson_progress (user_id, course_id);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY enrollments_select_own_or_course_staff
  ON public.enrollments FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY enrollments_insert_self
  ON public.enrollments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY enrollments_update_own_or_staff
  ON public.enrollments FOR UPDATE
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY lesson_progress_select_own_or_staff
  ON public.lesson_progress FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY lesson_progress_write_own
  ON public.lesson_progress FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Payments (client reads own access; transactions mainly via service API) ─

CREATE TABLE public.course_payment_access (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  full_access_granted boolean,
  certificate_fee_paid boolean,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE TABLE public.payment_transactions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('course_purchase', 'certificate_fee')),
  amount_vnd int NOT NULL,
  original_amount_vnd int,
  discount_code text,
  discount_amount_vnd int,
  provider text NOT NULL DEFAULT 'sepay',
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  provider_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_tx_user ON public.payment_transactions (user_id, created_at DESC);

ALTER TABLE public.course_payment_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_payment_access_select_own
  ON public.course_payment_access FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
  );

CREATE POLICY payment_transactions_select_own
  ON public.payment_transactions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin_or_support());

-- Inserts/updates on payment tables: service role (API) only — no INSERT policy for anon/auth

-- ─── Final assignment submissions ────────────────────────────────────────────

CREATE TABLE public.final_assignment_submissions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
  content text,
  file_urls jsonb DEFAULT '[]'::jsonb,
  submitted_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewer_comment text,
  reviewed_at timestamptz
);

CREATE INDEX fas_course ON public.final_assignment_submissions (course_id, submitted_at DESC);

ALTER TABLE public.final_assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY fas_select
  ON public.final_assignment_submissions FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY fas_insert_own
  ON public.final_assignment_submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY fas_update_reviewers
  ON public.final_assignment_submissions FOR UPDATE
  USING (
    public.is_admin_or_support()
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND (
          c.instructor_id = auth.uid()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

-- ─── Dashboard config ─────────────────────────────────────────────────────────

CREATE TABLE public.dashboard_configs (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz,
  updated_by uuid
);

ALTER TABLE public.dashboard_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY dashboard_configs_select_authenticated
  ON public.dashboard_configs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY dashboard_configs_write_staff
  ON public.dashboard_configs FOR ALL
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

-- ─── Contests (document jsonb + indexed columns) ─────────────────────────────

CREATE TABLE public.contests (
  id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'draft',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  document jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX contests_status_updated ON public.contests (status, updated_at DESC);

CREATE TABLE public.contest_registrations (
  id text PRIMARY KEY,
  contest_id text NOT NULL REFERENCES public.contests (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  document jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.contest_access_invites (
  id text PRIMARY KEY,
  contest_id text NOT NULL REFERENCES public.contests (id) ON DELETE CASCADE,
  document jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.contest_submissions (
  id text PRIMARY KEY,
  contest_id text NOT NULL REFERENCES public.contests (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  document jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.contest_scores (
  id text PRIMARY KEY,
  contest_id text NOT NULL REFERENCES public.contests (id) ON DELETE CASCADE,
  document jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX contest_reg_contest ON public.contest_registrations (contest_id);
CREATE INDEX contest_invite_contest ON public.contest_access_invites (contest_id);
CREATE INDEX contest_sub_contest ON public.contest_submissions (contest_id);
CREATE INDEX contest_scores_contest ON public.contest_scores (contest_id);

ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_access_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_scores ENABLE ROW LEVEL SECURITY;

-- Contest visibility: published-like statuses for anon; managers see all
CREATE POLICY contests_select
  ON public.contests FOR SELECT
  USING (
    status IN ('published', 'running', 'ended')
    OR public.is_admin_or_support()
    OR (document->>'created_by') = (auth.uid()::text)
  );

CREATE POLICY contests_write_staff
  ON public.contests FOR ALL
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

CREATE POLICY contests_insert_instructor_corelia
  ON public.contests FOR INSERT
  WITH CHECK (
    public.is_admin_or_support()
    OR (
      public.current_profile_role() = 'instructor'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.instructor_origin = 'corelia'
      )
    )
  );

CREATE POLICY contests_update_creator_staff
  ON public.contests FOR UPDATE
  USING (
    public.is_admin_or_support()
    OR (document->>'created_by') = (auth.uid()::text)
  );

-- Satellite tables: authenticated read where contest visible (simplified: authenticated + contest exists)
CREATE POLICY contest_registrations_authenticated
  ON public.contest_registrations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY contest_invites_authenticated
  ON public.contest_access_invites FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY contest_submissions_authenticated
  ON public.contest_submissions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY contest_scores_authenticated
  ON public.contest_scores FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── Offline academy (jsonb documents) ───────────────────────────────────────

CREATE TABLE public.offline_courses (
  id text PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT now(),
  document jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.offline_cohorts (
  id text PRIMARY KEY,
  offline_course_id text REFERENCES public.offline_courses (id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  document jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.offline_sessions (
  cohort_id text NOT NULL REFERENCES public.offline_cohorts (id) ON DELETE CASCADE,
  id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  document jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (cohort_id, id)
);

CREATE TABLE public.offline_cohort_enrollments (
  id text PRIMARY KEY,
  document jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.offline_session_attendance (
  id text PRIMARY KEY,
  document jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.offline_assignment_submissions (
  id text PRIMARY KEY,
  document jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.offline_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_cohort_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY offline_courses_auth_all
  ON public.offline_courses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY offline_cohorts_auth_all
  ON public.offline_cohorts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY offline_sessions_auth_all
  ON public.offline_sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY offline_enrollments_auth_all
  ON public.offline_cohort_enrollments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY offline_attendance_auth_all
  ON public.offline_session_attendance FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY offline_assignments_auth_all
  ON public.offline_assignment_submissions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── Storage bucket `app` ─────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('app', 'app', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: authenticated users — path-based (aligned with former storage.rules)

CREATE POLICY storage_avatars
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'app' AND (storage.foldername(name))[1] = 'avatars')
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = (auth.uid()::text)
  );

CREATE POLICY storage_course_thumbnails_read
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
  );

CREATE POLICY storage_course_thumbnails_write
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = (storage.foldername(name))[2]
        AND (
          c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY storage_course_thumbnails_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
  );

CREATE POLICY storage_course_thumbnails_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'course-thumbnails'
  );

CREATE POLICY storage_contest_media_read
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'app'
    AND (
      (storage.foldername(name))[1] = 'contest-banners'
      OR (storage.foldername(name))[1] = 'contest-thumbnails'
    )
  );

CREATE POLICY storage_contest_media_write
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (
      (storage.foldername(name))[1] = 'contest-banners'
      OR (storage.foldername(name))[1] = 'contest-thumbnails'
    )
    AND public.is_admin_or_support()
  );

CREATE POLICY storage_course_assets_read
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN (
      'course-sponsor-logos', 'course-partners', 'course-partner-brand',
      'certificate-templates', 'course-partner-docs'
    )
  );

CREATE POLICY storage_course_assets_write
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] IN (
      'course-sponsor-logos', 'course-partners', 'course-partner-brand',
      'certificate-templates', 'course-partner-docs'
    )
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = (storage.foldername(name))[2]
        AND (
          c.instructor_id = auth.uid()
          OR public.is_admin_or_support()
          OR (c.data->'co_instructor_permissions') ? (auth.uid()::text)
        )
    )
  );

CREATE POLICY storage_final_submissions
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'final-assignment-submissions'
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'final-assignment-submissions'
  );

CREATE POLICY storage_instructor_partner_docs
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'instructor-partner-docs'
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'instructor-partner-docs'
  );
