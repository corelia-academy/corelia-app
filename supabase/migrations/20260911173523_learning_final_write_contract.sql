-- Old clients treat an RLS-filtered zero-row UPDATE as a successful review.
-- Reject direct mutations explicitly; SECURITY DEFINER final RPCs retain their
-- feature authorization, transactional review and completion synchronization.
REVOKE INSERT, UPDATE, DELETE ON public.final_assignment_submissions FROM anon, authenticated;
