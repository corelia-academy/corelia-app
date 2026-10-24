-- Bound social notification events a single actor can enqueue.
-- Toggling a heart/like/follow via PostgREST used to append one queue row per
-- INSERT/DELETE, so one user could starve the shared 10s worker for everyone.
-- Social triggers now coalesce same (actor, kind, target) events that are still
-- pending within 60s (an opposite operation cancels the pending one) and stop
-- enqueueing once the actor produced 120 social events in the last hour. The
-- source write itself always succeeds; only the notification side effect drops.
CREATE INDEX notification_events_actor_recent ON private.notification_events(actor,happened_at);
CREATE INDEX notification_events_pending_key ON private.notification_events(actor,kind,target) WHERE processed_at IS NULL;
-- process_notification_events resolves DELETE events by (target_id, type).
CREATE INDEX user_notifications_target_type ON public.user_notifications((payload->>'target_id'),type);

CREATE OR REPLACE FUNCTION private.capture_notification_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; k text; ev_target text; ev_actor uuid; pending_id bigint; pending_op text;
BEGIN
 r:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(old) ELSE to_jsonb(new) END;
 IF TG_TABLE_NAME='project_hearts' THEN k:='project_liked'; ev_target:=r->>'project_id'; ev_actor:=(r->>'user_id')::uuid;
 ELSIF TG_TABLE_NAME='feed_milestone_likes' THEN k:='milestone_liked'; ev_target:=r->>'milestone_id'; ev_actor:=(r->>'user_id')::uuid;
 ELSIF TG_TABLE_NAME='follows' THEN
  IF r->>'subject_type' NOT IN ('user','project') THEN RETURN NULL; END IF;
  k:=r->>'subject_type'||'_followed'; ev_target:=r->>'subject_id'; ev_actor:=(r->>'follower_id')::uuid;
 ELSIF TG_TABLE_NAME IN ('project_collaboration_invites','course_co_instructor_invites') THEN
  IF new.status NOT IN ('accepted','declined') OR new.status=old.status THEN RETURN NULL; END IF;
  k:=CASE WHEN TG_TABLE_NAME='project_collaboration_invites' THEN 'project_invite_' ELSE 'course_invite_' END||new.status;
  ev_target:=new.id::text; ev_actor:=new.invitee_user_id;
 ELSIF TG_TABLE_NAME='final_assignment_submissions' THEN
  IF TG_OP='INSERT' THEN k:='submission_received';
  ELSIF new.status IS DISTINCT FROM old.status AND new.status IN ('approved','rejected') THEN k:='submission_'||new.status;
  ELSE RETURN NULL; END IF;
  ev_target:=new.id; ev_actor:=new.user_id;
 END IF;
 IF TG_TABLE_NAME IN ('project_hearts','feed_milestone_likes','follows') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('notification-event:'||ev_actor::text||':'||k||':'||ev_target,0));
  SELECT e.id,e.data->>'operation' INTO pending_id,pending_op FROM private.notification_events e
  WHERE e.actor=ev_actor AND e.kind=k AND e.target=ev_target AND e.processed_at IS NULL AND e.happened_at>now()-interval '60 seconds'
  ORDER BY e.id DESC LIMIT 1;
  IF pending_id IS NOT NULL THEN
   IF pending_op=TG_OP THEN RETURN NULL; END IF;
   -- Opposite toggle inside the window: the pair is a no-op for recipients.
   DELETE FROM private.notification_events WHERE id=pending_id AND processed_at IS NULL;
   IF FOUND THEN RETURN NULL; END IF;
  END IF;
  IF (SELECT count(*) FROM (SELECT 1 FROM private.notification_events e
      WHERE e.actor=ev_actor AND e.happened_at>now()-interval '1 hour'
      AND e.kind IN ('project_liked','milestone_liked','user_followed','project_followed') LIMIT 120) recent)>=120 THEN
   RETURN NULL;
  END IF;
 END IF;
 INSERT INTO private.notification_events(kind,target,actor,data) VALUES(k,ev_target,ev_actor,jsonb_build_object('operation',TG_OP,'course_id',r->>'course_id','project_id',r->>'project_id','invited_by',r->>'invited_by'));
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.capture_notification_event() FROM PUBLIC,anon,authenticated;
