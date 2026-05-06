-- Drop Offline Academy tables (offline courses/cohorts/sessions/roster/attendance/assignments).
-- Safe to run multiple times.

BEGIN;

DROP TABLE IF EXISTS public.offline_assignment_submissions CASCADE;
DROP TABLE IF EXISTS public.offline_session_attendance CASCADE;
DROP TABLE IF EXISTS public.offline_cohort_enrollments CASCADE;
DROP TABLE IF EXISTS public.offline_sessions CASCADE;
DROP TABLE IF EXISTS public.offline_cohorts CASCADE;
DROP TABLE IF EXISTS public.offline_courses CASCADE;

COMMIT;

