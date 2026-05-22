-- notification_preferences: per-user opt-out for email & in-app channels
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email_course_blast boolean NOT NULL DEFAULT true,
  email_track_blast boolean NOT NULL DEFAULT true,
  in_app_course_blast boolean NOT NULL DEFAULT true,
  in_app_track_blast boolean NOT NULL DEFAULT true,
  unsubscribe_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY np_select_own
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY np_update_own
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- course_blast_logs: audit trail for every blast sent
CREATE TABLE public.course_blast_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('course', 'career_track')),
  target_id text NOT NULL,
  sender_id uuid NOT NULL REFERENCES auth.users (id),
  subject text NOT NULL,
  recipient_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_blast_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY cbl_select_sender
  ON public.course_blast_logs FOR SELECT
  TO authenticated
  USING (sender_id = (SELECT auth.uid()));
