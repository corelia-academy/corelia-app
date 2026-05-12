-- Add missing indexes for foreign key columns (Supabase lint 0001_unindexed_foreign_keys).

BEGIN;

-- career_track_courses.course_id
CREATE INDEX IF NOT EXISTS career_track_courses_course_id_idx
  ON public.career_track_courses (course_id);

-- project_collaboration_invites.invited_by, notification_id
CREATE INDEX IF NOT EXISTS project_collab_invites_invited_by_idx
  ON public.project_collaboration_invites (invited_by);

CREATE INDEX IF NOT EXISTS project_collab_invites_notification_id_idx
  ON public.project_collaboration_invites (notification_id);

-- search_query_events.user_id
CREATE INDEX IF NOT EXISTS search_query_events_user_id_idx
  ON public.search_query_events (user_id);

COMMIT;

