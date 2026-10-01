-- A course can publish lessons while the full curriculum is still being prepared.
-- Progress remains available, but completion and new awards wait until it is ready.
CREATE OR REPLACE FUNCTION private.learning_sync_completion(p_course text,p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb; updating boolean; BEGIN
 SELECT data->>'is_updating'='true' INTO updating FROM public.courses WHERE id=p_course FOR SHARE;
 IF coalesce(updating,false) THEN RETURN; END IF;
 r := public.corelia_certificate_readiness(p_course,p_user);
 IF (r->>'all_lessons_complete')::boolean AND (NOT (r->>'final_assignment_required')::boolean OR r->>'final_submission_status'='approved') THEN
   UPDATE public.enrollments SET completed_at=clock_timestamp() WHERE course_id=p_course AND user_id=p_user AND completed_at IS NULL;
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.learning_sync_completion(text,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.guard_enrollment_completion_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb; updating boolean; BEGIN
 IF NEW.certificate_issued_at IS NOT NULL OR NEW.completed_at IS NOT NULL THEN
   SELECT data->>'is_updating'='true' INTO updating FROM public.courses WHERE id=NEW.course_id FOR SHARE;
 END IF;
 IF NEW.certificate_issued_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.certificate_issued_at IS NULL) AND coalesce(updating,false) THEN
   RAISE EXCEPTION 'COURSE_UPDATING';
 END IF;
 IF TG_OP='UPDATE' AND OLD.completed_at IS NOT NULL THEN
   IF NEW.completed_at IS NULL AND current_setting('app.allow_course_completion_revert', true) = 'on' THEN
     RETURN NEW;
   END IF;
   NEW.completed_at := OLD.completed_at; RETURN NEW;
 END IF;
 IF NEW.completed_at IS NOT NULL THEN
   IF coalesce(updating,false) THEN
     RAISE EXCEPTION 'COURSE_UPDATING';
   END IF;
   r := public.corelia_certificate_readiness(NEW.course_id,NEW.user_id);
   IF NOT COALESCE((r->>'all_lessons_complete')::boolean,false) OR ((r->>'final_assignment_required')::boolean AND COALESCE(r->>'final_submission_status','')<>'approved') THEN RAISE EXCEPTION 'COURSE_NOT_COMPLETE'; END IF;
   NEW.completed_at := clock_timestamp();
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_enrollment_completion_mutation() FROM PUBLIC;
DROP TRIGGER trg_guard_enrollment_completion_mutation ON public.enrollments;
CREATE TRIGGER trg_guard_enrollment_completion_mutation
  BEFORE INSERT OR UPDATE OF completed_at, certificate_issued_at ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION private.guard_enrollment_completion_mutation();

-- RLS also applies to profile feeds and likes, so old cards disappear while the
-- course is updating and become visible again without modifying achievement data.
CREATE OR REPLACE FUNCTION private.feed_milestone_visible(p_id bigint,p_viewer uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.feed_milestones%rowtype;
BEGIN
  SELECT * INTO m FROM public.feed_milestones WHERE id=p_id;
  IF NOT FOUND OR NOT private.feed_actor_public(m.actor_id) THEN RETURN false; END IF;
  IF m.kind='course_completed' THEN
    RETURN EXISTS(SELECT 1 FROM public.courses c WHERE c.id=m.course_id AND c.published=true AND c.archived_at IS NULL AND c.data->>'is_updating' IS DISTINCT FROM 'true')
       AND EXISTS(SELECT 1 FROM public.enrollments e WHERE e.user_id=m.actor_id AND e.course_id=m.course_id AND e.completed_at IS NOT NULL);
  ELSIF m.kind='project_submitted' THEN
    RETURN EXISTS(SELECT 1 FROM public.projects p WHERE p.id=m.project_id AND p.owner_id=m.actor_id AND p.source_type='hackathon' AND p.source_id=m.hackathon_id AND p.visibility='public' AND NOT coalesce(p.blocked,false))
       AND EXISTS(SELECT 1 FROM public.hackathons h WHERE h.id=m.hackathon_id AND h.status IN ('published','running','ended','winners_announced'))
       AND EXISTS(SELECT 1 FROM public.hackathon_submissions s WHERE s.user_id=m.actor_id AND s.hackathon_id=m.hackathon_id AND s.project_id=m.project_id);
  ELSE
    RETURN m.xp_total <= coalesce((SELECT sum(l.points) FROM public.user_point_ledger l WHERE l.user_id=m.actor_id),0);
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.feed_milestone_visible(bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.feed_milestone_visible(bigint,uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION private.feed_on_course_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.completed_at IS NULL OR (TG_OP='UPDATE' AND OLD.completed_at IS NOT NULL) OR NOT private.feed_actor_public(NEW.user_id) THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.courses c WHERE c.id=NEW.course_id AND c.published=true AND c.archived_at IS NULL AND c.data->>'is_updating' IS DISTINCT FROM 'true') THEN
    INSERT INTO public.feed_milestones(actor_id,kind,source_key,course_id,created_at)
    VALUES(NEW.user_id,'course_completed',NEW.course_id,NEW.course_id,coalesce(NEW.completed_at,now()))
    ON CONFLICT(actor_id,kind,source_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.feed_on_course_completed() FROM PUBLIC,anon,authenticated;
