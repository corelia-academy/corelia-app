-- Durable social events. Only new source writes enqueue work; no historical backfill.
ALTER TABLE public.user_notifications ADD COLUMN group_key text,
  ADD COLUMN activity_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN opened_at timestamptz;
UPDATE public.user_notifications SET activity_at=created_at;
CREATE UNIQUE INDEX notification_group_unique ON public.user_notifications(user_id,group_key) WHERE group_key IS NOT NULL;
CREATE INDEX notification_inbox_order ON public.user_notifications(user_id,activity_at DESC,id DESC);
ALTER TABLE public.notification_preferences ADD COLUMN in_app_likes boolean NOT NULL DEFAULT true,
  ADD COLUMN in_app_follows boolean NOT NULL DEFAULT true,
  ADD COLUMN email_social_digest boolean NOT NULL DEFAULT false,
  ADD COLUMN digest_timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';
CREATE TABLE private.notification_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, kind text NOT NULL, target text NOT NULL,
 actor uuid, data jsonb NOT NULL DEFAULT '{}', happened_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz, attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text
);
CREATE INDEX notification_events_pending ON private.notification_events(next_attempt_at,id) WHERE processed_at IS NULL;
CREATE TABLE private.notification_actors (
 user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, kind text NOT NULL, target text NOT NULL,
 actor uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, notification_id uuid NOT NULL REFERENCES public.user_notifications ON DELETE CASCADE,
 first_at timestamptz NOT NULL, PRIMARY KEY(user_id,kind,target,actor)
);
CREATE INDEX notification_actors_group ON private.notification_actors(notification_id);
CREATE TABLE private.notification_digest_state (
 user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
 enabled_at timestamptz NOT NULL DEFAULT now(), feed_seen_at timestamptz,
 last_digest_at timestamptz, last_attempt_at timestamptz
);
CREATE TABLE private.notification_digest_items (
 user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, item_key text NOT NULL,
 sent_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,item_key)
);
ALTER TABLE private.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.notification_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.notification_digest_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.notification_digest_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.notification_events,private.notification_actors,private.notification_digest_state,private.notification_digest_items FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.notification_preference_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=new.digest_timezone) THEN RAISE EXCEPTION 'INVALID_TIMEZONE'; END IF;
 IF new.email_social_digest AND (TG_OP='INSERT' OR NOT old.email_social_digest) THEN
  INSERT INTO private.notification_digest_state(user_id,enabled_at) VALUES(new.user_id,now())
  ON CONFLICT(user_id) DO UPDATE SET enabled_at=excluded.enabled_at;
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER notification_preference_guard BEFORE INSERT OR UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION private.notification_preference_guard();

CREATE FUNCTION private.capture_notification_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; k text; target text; actor uuid;
BEGIN
 r:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(old) ELSE to_jsonb(new) END;
 IF TG_TABLE_NAME='project_hearts' THEN k:='project_liked'; target:=r->>'project_id'; actor:=(r->>'user_id')::uuid;
 ELSIF TG_TABLE_NAME='feed_milestone_likes' THEN k:='milestone_liked'; target:=r->>'milestone_id'; actor:=(r->>'user_id')::uuid;
 ELSIF TG_TABLE_NAME='follows' THEN
  IF r->>'subject_type' NOT IN ('user','project') THEN RETURN NULL; END IF;
  k:=r->>'subject_type'||'_followed'; target:=r->>'subject_id'; actor:=(r->>'follower_id')::uuid;
 ELSIF TG_TABLE_NAME IN ('project_collaboration_invites','course_co_instructor_invites') THEN
  IF new.status NOT IN ('accepted','declined') OR new.status=old.status THEN RETURN NULL; END IF;
  k:=CASE WHEN TG_TABLE_NAME='project_collaboration_invites' THEN 'project_invite_' ELSE 'course_invite_' END||new.status;
  target:=new.id::text; actor:=new.invitee_user_id;
 ELSIF TG_TABLE_NAME='final_assignment_submissions' THEN
  IF TG_OP='INSERT' THEN k:='submission_received';
  ELSIF new.status IS DISTINCT FROM old.status AND new.status IN ('approved','rejected') THEN k:='submission_'||new.status;
  ELSE RETURN NULL; END IF;
  target:=new.id; actor:=new.user_id;
 END IF;
 INSERT INTO private.notification_events(kind,target,actor,data) VALUES(k,target,actor,jsonb_build_object('operation',TG_OP,'course_id',r->>'course_id','project_id',r->>'project_id','invited_by',r->>'invited_by'));
 RETURN NULL;
END $$;
CREATE TRIGGER notify_project_hearts AFTER INSERT OR DELETE ON public.project_hearts FOR EACH ROW EXECUTE FUNCTION private.capture_notification_event();
CREATE TRIGGER notify_milestone_likes AFTER INSERT OR DELETE ON public.feed_milestone_likes FOR EACH ROW EXECUTE FUNCTION private.capture_notification_event();
CREATE TRIGGER notify_follows AFTER INSERT OR DELETE ON public.follows FOR EACH ROW EXECUTE FUNCTION private.capture_notification_event();
CREATE TRIGGER notify_project_invite_reply AFTER UPDATE OF status ON public.project_collaboration_invites FOR EACH ROW EXECUTE FUNCTION private.capture_notification_event();
CREATE TRIGGER notify_course_invite_reply AFTER UPDATE OF status ON public.course_co_instructor_invites FOR EACH ROW EXECUTE FUNCTION private.capture_notification_event();
CREATE TRIGGER notify_submission AFTER INSERT OR UPDATE OF status ON public.final_assignment_submissions FOR EACH ROW EXECUTE FUNCTION private.capture_notification_event();

-- Use explicit recipient identity; existing course helpers also consult the caller JWT.
CREATE FUNCTION private.notification_course_reviewer(c public.courses,u uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT c.instructor_id=u OR coalesce((c.data->'co_instructor_permissions'->u::text->>'submissions')::boolean,false)
$$;
CREATE FUNCTION private.notification_project_member(p_id uuid,u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=p_id AND NOT coalesce(p.blocked,false)
 AND (p.owner_id=u OR EXISTS(SELECT 1 FROM public.project_collaborators c WHERE c.project_id=p.id AND c.user_id=u)))
$$;
CREATE FUNCTION private.notification_actor_active(k text,t text,a uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE k
 WHEN 'project_liked' THEN EXISTS(SELECT 1 FROM public.project_hearts WHERE project_id=t::uuid AND user_id=a)
 WHEN 'milestone_liked' THEN EXISTS(SELECT 1 FROM public.feed_milestone_likes WHERE milestone_id=t::bigint AND user_id=a)
 WHEN 'user_followed' THEN EXISTS(SELECT 1 FROM public.follows WHERE follower_id=a AND subject_type='user' AND subject_id=t)
 WHEN 'project_followed' THEN EXISTS(SELECT 1 FROM public.follows WHERE follower_id=a AND subject_type='project' AND subject_id=t)
 ELSE true END
$$;
CREATE FUNCTION private.add_social_notification(u uuid,k text,t text,a uuid,at_time timestamptz,body jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE nid uuid; previous private.notification_actors%rowtype; g text; social boolean:=k IN ('project_liked','milestone_liked','user_followed','project_followed');
BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u) OR (social AND u=a) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.notification_preferences p WHERE p.user_id=u AND
 ((k IN ('project_liked','milestone_liked') AND NOT p.in_app_likes) OR (k IN ('user_followed','project_followed') AND NOT p.in_app_follows))) THEN RETURN; END IF;
 IF social THEN
  IF NOT private.notification_actor_active(k,t,a) THEN RETURN; END IF;
  SELECT * INTO previous FROM private.notification_actors WHERE user_id=u AND kind=k AND target=t AND actor=a;
  IF FOUND AND at_time<previous.first_at+interval '24 hours' THEN RETURN; END IF;
 END IF;
 g:=k||':'||t||CASE WHEN social THEN ':'||(at_time AT TIME ZONE 'UTC')::date::text ELSE '' END;
 INSERT INTO public.user_notifications(user_id,type,payload,group_key,activity_at)
 VALUES(u,k,body||jsonb_build_object('target_id',t),g,at_time)
 ON CONFLICT(user_id,group_key) WHERE group_key IS NOT NULL DO UPDATE SET
 activity_at=greatest(user_notifications.activity_at,excluded.activity_at),read_at=NULL,payload=excluded.payload
 RETURNING id INTO nid;
 IF social THEN
  INSERT INTO private.notification_actors(user_id,kind,target,actor,notification_id,first_at) VALUES(u,k,t,a,nid,at_time)
  ON CONFLICT(user_id,kind,target,actor) DO UPDATE SET notification_id=excluded.notification_id,first_at=excluded.first_at;
 END IF;
END $$;

CREATE FUNCTION private.process_notification_events(p_limit integer DEFAULT 100) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e private.notification_events%rowtype; u uuid; c public.courses%rowtype; processed integer:=0;
BEGIN
 -- ponytail: one worker per database; partition by recipient if sustained queue lag grows.
 IF NOT pg_try_advisory_xact_lock(hashtextextended('notification-worker',0)) THEN RETURN 0; END IF;
 FOR e IN SELECT * FROM private.notification_events WHERE processed_at IS NULL AND next_attempt_at<=now() ORDER BY id LIMIT least(p_limit,500) FOR UPDATE SKIP LOCKED LOOP
  BEGIN
   IF e.data->>'operation'='DELETE' THEN
    UPDATE public.user_notifications n SET payload=n.payload WHERE n.type=e.kind AND n.payload->>'target_id'=e.target;
   ELSIF e.kind IN ('project_liked','project_followed') THEN
    FOR u IN SELECT owner_id FROM public.projects WHERE id=e.target::uuid AND NOT coalesce(blocked,false)
      UNION SELECT user_id FROM public.project_collaborators WHERE project_id=e.target::uuid LOOP
     PERFORM private.add_social_notification(u,e.kind,e.target,e.actor,e.happened_at,'{}');
    END LOOP;
   ELSIF e.kind='user_followed' THEN PERFORM private.add_social_notification(e.target::uuid,e.kind,e.target,e.actor,e.happened_at,'{}');
   ELSIF e.kind='milestone_liked' THEN
    SELECT actor_id INTO u FROM public.feed_milestones WHERE id=e.target::bigint;
    PERFORM private.add_social_notification(u,e.kind,e.target,e.actor,e.happened_at,'{}');
   ELSIF e.kind LIKE '%invite_%' THEN
    PERFORM private.add_social_notification((e.data->>'invited_by')::uuid,e.kind,e.target,e.actor,e.happened_at,
     jsonb_build_object('project_id',e.data->>'project_id','course_id',e.data->>'course_id'));
   ELSIF e.kind='submission_received' THEN
    SELECT * INTO c FROM public.courses WHERE id=e.data->>'course_id';
    FOR u IN SELECT c.instructor_id UNION SELECT key::uuid FROM jsonb_each(coalesce(c.data->'co_instructor_permissions','{}')) WHERE value->>'submissions'='true' LOOP
     IF u<>e.actor THEN PERFORM private.add_social_notification(u,e.kind,c.id,e.actor,e.happened_at,jsonb_build_object('course_id',c.id)); END IF;
    END LOOP;
   ELSIF e.kind IN ('submission_approved','submission_rejected') THEN
    PERFORM private.add_social_notification(e.actor,e.kind,e.target,NULL,e.happened_at,jsonb_build_object('course_id',e.data->>'course_id'));
   ELSIF e.kind='hackathon_announcement' THEN
    FOR u IN SELECT (value #>> '{}')::uuid FROM jsonb_array_elements(e.data->'recipients') LOOP
     PERFORM private.add_social_notification(u,e.kind,e.target,NULL,e.happened_at,e.data-'recipients');
    END LOOP;
   END IF;
   UPDATE private.notification_events SET processed_at=clock_timestamp(),last_error=NULL WHERE id=e.id;
   processed:=processed+1;
  EXCEPTION WHEN OTHERS THEN
   UPDATE private.notification_events SET attempts=attempts+1,last_error=SQLSTATE||':'||SQLERRM,
    next_attempt_at=now()+least(interval '1 hour',interval '10 seconds'*power(2,least(attempts,8))) WHERE id=e.id;
  END;
 END LOOP;
 RETURN processed;
END $$;

-- Build safe display data at read time; never cache private profile names in payloads.
CREATE FUNCTION private.notification_details(n public.user_notifications) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE t text:=n.payload->>'target_id'; b jsonb:=n.payload; project_row public.projects%rowtype; course_row public.courses%rowtype;
 a jsonb; total integer; submission_row public.final_assignment_submissions%rowtype; path text;
BEGIN
 IF n.type IN ('project_liked','project_followed') THEN
  IF NOT private.notification_project_member(t::uuid,n.user_id) THEN RETURN NULL; END IF;
  SELECT * INTO project_row FROM public.projects WHERE id=t::uuid;
  b:=b||jsonb_build_object('title',project_row.title,'target_path','/projects/'||coalesce(project_row.slug,project_row.id::text));
 ELSIF n.type='milestone_liked' THEN
  IF NOT private.feed_milestone_visible(t::bigint,n.user_id) THEN RETURN NULL; END IF;
  b:=b||jsonb_build_object('target_path','/feed?milestone='||t);
 ELSIF n.type='user_followed' THEN
  b:=b||jsonb_build_object('target_path','/account');
 ELSIF n.type LIKE 'project_invite_%' THEN
  IF NOT private.notification_project_member((b->>'project_id')::uuid,n.user_id) THEN RETURN NULL; END IF;
  SELECT * INTO project_row FROM public.projects WHERE id=(b->>'project_id')::uuid;
  b:=b||jsonb_build_object('title',project_row.title,'target_path','/projects/'||coalesce(project_row.slug,project_row.id::text));
 ELSIF n.type LIKE 'course_invite_%' OR n.type LIKE 'submission_%' THEN
  SELECT * INTO course_row FROM public.courses WHERE id=b->>'course_id';
  IF NOT FOUND OR course_row.archived_at IS NOT NULL THEN RETURN NULL; END IF;
  IF n.type='submission_received' THEN
   IF NOT private.notification_course_reviewer(course_row,n.user_id) THEN RETURN NULL; END IF;
   SELECT count(*) INTO total FROM public.final_assignment_submissions s WHERE s.course_id=course_row.id AND s.status='pending'
    AND NOT EXISTS(SELECT 1 FROM public.final_assignment_submissions newer WHERE newer.user_id=s.user_id AND newer.course_id=s.course_id AND (newer.submitted_at,newer.id)>(s.submitted_at,s.id));
   IF total=0 THEN RETURN NULL; END IF;
   b:=b||jsonb_build_object('count',total); path:='/instructor/courses/'||course_row.id||'/edit#assignments';
  ELSIF n.type LIKE 'course_invite_%' THEN
   IF course_row.instructor_id IS DISTINCT FROM n.user_id THEN RETURN NULL; END IF;
   path:='/instructor/courses/'||course_row.id||'/edit';
  ELSE
   SELECT * INTO submission_row FROM public.final_assignment_submissions WHERE id=t AND user_id=n.user_id;
   IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.enrollments WHERE user_id=n.user_id AND course_id=course_row.id) THEN RETURN NULL; END IF;
   path:='/learn/'||course_row.id||'/final-assignment';
  END IF;
  b:=b||jsonb_build_object('title',coalesce(course_row.data->>'title',course_row.id),'target_path',path);
 ELSIF n.type='hackathon_announcement' THEN
  SELECT '/hackathons/'||coalesce(h.document->>'slug',h.id) INTO path FROM public.hackathons h WHERE h.id=b->>'hackathon_id'
   AND EXISTS(SELECT 1 FROM public.hackathon_registrations r WHERE r.hackathon_id=h.id AND r.user_id=n.user_id);
  IF path IS NULL THEN RETURN NULL; END IF;
  b:=b||jsonb_build_object('target_path',path);
 ELSE
  -- Existing notification renderers keep their contracts. Remove stale project snapshots when access is lost.
  IF nullif(b->>'project_id','') IS NOT NULL AND n.type<>'project_collaboration_invite' THEN
   IF NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id::text=b->>'project_id' AND NOT coalesce(p.blocked,false)
    AND (p.visibility IN ('public','unlisted') OR private.notification_project_member(p.id,n.user_id))) THEN RETURN NULL; END IF;
  END IF;
  RETURN b;
 END IF;
 IF n.type LIKE 'project_invite_%' OR n.type LIKE 'course_invite_%' THEN
  SELECT jsonb_build_object('id',profile.id,'name',coalesce(nullif(profile.full_name,''),profile.username),'avatar_url',profile.avatar_url,'username',profile.username)
  INTO a FROM public.profiles profile WHERE profile.profile_public AND profile.id IN (
   SELECT i.invitee_user_id FROM public.project_collaboration_invites i WHERE i.id::text=t AND n.type LIKE 'project_invite_%'
   UNION ALL SELECT i.invitee_user_id FROM public.course_co_instructor_invites i WHERE i.id::text=t AND n.type LIKE 'course_invite_%'
  );
  b:=b||jsonb_build_object('actor',a);
 END IF;
 IF n.type IN ('project_liked','milestone_liked','user_followed','project_followed') THEN
  IF EXISTS(SELECT 1 FROM public.notification_preferences pref WHERE pref.user_id=n.user_id AND
   ((n.type IN ('project_liked','milestone_liked') AND NOT pref.in_app_likes) OR (n.type IN ('user_followed','project_followed') AND NOT pref.in_app_follows))) THEN RETURN NULL; END IF;
  SELECT count(*) INTO total FROM private.notification_actors x WHERE x.notification_id=n.id AND private.notification_actor_active(x.kind,x.target,x.actor);
  IF total=0 THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('id',p.id,'name',coalesce(nullif(p.full_name,''),p.username),'avatar_url',p.avatar_url,'username',p.username)
   INTO a FROM private.notification_actors x JOIN public.profiles p ON p.id=x.actor AND p.profile_public
   WHERE x.notification_id=n.id AND private.notification_actor_active(x.kind,x.target,x.actor) ORDER BY x.first_at DESC,x.actor LIMIT 1;
  b:=b||jsonb_build_object('count',total,'actor',a);
  IF n.type='user_followed' AND a IS NOT NULL THEN b:=b||jsonb_build_object('target_path','/@'||coalesce(a->>'username',a->>'id')); END IF;
 END IF;
 RETURN b;
END $$;

CREATE FUNCTION private.notification_can_read(nid uuid,u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u=auth.uid() AND EXISTS(SELECT 1 FROM public.user_notifications n WHERE n.id=nid AND n.user_id=u AND private.notification_details(n) IS NOT NULL)
$$;
CREATE POLICY notifications_visible ON public.user_notifications AS RESTRICTIVE FOR SELECT TO authenticated
 USING(private.notification_can_read(id,(SELECT auth.uid())));
-- Readers may only change read state through scoped RPCs. Legacy invite writers retain their existing policies.
REVOKE UPDATE ON public.user_notifications FROM authenticated;
-- Existing invoker invite RPCs resolve rows through their established RLS policies.
GRANT UPDATE(read_at,resolved_at) ON public.user_notifications TO authenticated;

CREATE FUNCTION private.notifications_page(p_cursor_at timestamptz DEFAULT NULL,p_cursor_id uuid DEFAULT NULL,p_unread boolean DEFAULT false,p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH visible AS MATERIALIZED (
  SELECT n.*,private.notification_details(n) AS display FROM public.user_notifications n WHERE user_id=auth.uid()
 ), page AS (
 SELECT * FROM visible WHERE display IS NOT NULL AND (NOT p_unread OR (read_at IS NULL AND resolved_at IS NULL))
 AND (p_cursor_at IS NULL OR (activity_at,id)<(p_cursor_at,p_cursor_id)) ORDER BY activity_at DESC,id DESC LIMIT least(greatest(p_limit,1),50)
 ) SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg((to_jsonb(page)-'display')||jsonb_build_object('payload',display) ORDER BY activity_at DESC,id DESC) FROM page),'[]'::jsonb),
 'unread_count',(SELECT count(*) FROM visible WHERE display IS NOT NULL AND read_at IS NULL AND resolved_at IS NULL))
$$;
CREATE FUNCTION private.notifications_read(p_id uuid DEFAULT NULL,p_opened boolean DEFAULT false,p_activity_at timestamptz DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.user_notifications n SET read_at=coalesce(read_at,now()),opened_at=CASE WHEN p_opened THEN coalesce(opened_at,now()) ELSE opened_at END
 WHERE user_id=auth.uid() AND (p_id IS NULL OR id=p_id) AND (p_activity_at IS NULL OR activity_at<=p_activity_at) AND private.notification_details(n) IS NOT NULL;
END $$;
CREATE FUNCTION private.notifications_feed_seen() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO private.notification_digest_state(user_id,feed_seen_at) SELECT auth.uid(),now() WHERE auth.uid() IS NOT NULL
 ON CONFLICT(user_id) DO UPDATE SET feed_seen_at=excluded.feed_seen_at
$$;

-- Public invoker wrappers; privileged bodies are kept out of the exposed schema.
CREATE FUNCTION public.notifications_page(p_cursor_at timestamptz DEFAULT NULL,p_cursor_id uuid DEFAULT NULL,p_unread boolean DEFAULT false,p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.notifications_page(p_cursor_at,p_cursor_id,p_unread,p_limit) $$;
CREATE FUNCTION public.notifications_read(p_id uuid DEFAULT NULL,p_opened boolean DEFAULT false,p_activity_at timestamptz DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.notifications_read(p_id,p_opened,p_activity_at) $$;
CREATE FUNCTION public.notifications_feed_seen() RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.notifications_feed_seen() $$;

-- Service-only enqueue for the explicit organizer announcement action.
CREATE FUNCTION public.enqueue_hackathon_notification(p_key text,p_hackathon text,p_subject text,p_recipients uuid[],p_body text DEFAULT '') RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 INSERT INTO private.notification_events(kind,target,data)
 VALUES('hackathon_announcement',p_key,jsonb_build_object('hackathon_id',p_hackathon,'title',p_subject,'body',p_body,'recipients',to_jsonb(p_recipients)))
$$;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT INSERT ON private.notification_events TO service_role;
GRANT USAGE ON SEQUENCE private.notification_events_id_seq TO service_role;

-- Delivery candidates and safe content are resolved again immediately before dispatch.
CREATE FUNCTION private.notification_digest_candidates() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(eligible.data),'[]') FROM (
 SELECT jsonb_build_object('user_id',p.user_id,'email',u.email,'locale',coalesce(pr.locale,'vi'),
 'unsubscribe_token',p.unsubscribe_token,'digest_key',coalesce((SELECT e.idempotency_key FROM public.email_outbox_events e
 WHERE e.event_type='social_digest' AND e.request_payload->>'notification_user_id'=p.user_id::text
 AND (e.status IN ('pending','sending','indeterminate') OR (e.status='accepted' AND (s.last_digest_at IS NULL OR e.updated_at>s.last_digest_at)))
 ORDER BY e.created_at LIMIT 1),'social-digest/'||p.user_id||'/'||(now() AT TIME ZONE p.digest_timezone)::date::text)) AS data
 FROM public.notification_preferences p JOIN auth.users u ON u.id=p.user_id JOIN public.profiles pr ON pr.id=p.user_id
 JOIN private.notification_digest_state s ON s.user_id=p.user_id
 WHERE p.email_social_digest AND u.email_confirmed_at IS NOT NULL
 AND extract(hour FROM now() AT TIME ZONE p.digest_timezone)>=9
 AND (s.last_digest_at IS NULL OR s.last_digest_at<=now()-interval '24 hours')
 AND (s.last_attempt_at IS NULL OR s.last_attempt_at<=now()-interval '5 minutes')
 AND NOT EXISTS(SELECT 1 FROM public.email_contacts c WHERE c.email=lower(u.email) AND c.global_suppressed_at IS NOT NULL)
 ORDER BY s.last_attempt_at NULLS FIRST,p.user_id LIMIT 25
 ) eligible
$$;
CREATE FUNCTION private.notification_digest_content(p_user uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.notification_preferences p JOIN auth.users u ON u.id=p.user_id WHERE p.user_id=p_user AND p.email_social_digest AND u.email_confirmed_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.email_contacts c WHERE c.email=lower(u.email) AND c.global_suppressed_at IS NOT NULL)) THEN RETURN '[]'; END IF;
 WITH candidates AS (
 SELECT 0 AS priority,n.activity_at AS at_time,'notification:'||n.id||':'||n.activity_at::text AS key,n.type,
 private.notification_details(n) AS payload FROM public.user_notifications n JOIN private.notification_digest_state s ON s.user_id=n.user_id
 WHERE n.user_id=p_user AND n.read_at IS NULL AND n.resolved_at IS NULL AND n.activity_at>=s.enabled_at
 AND n.type IN ('project_liked','project_followed','user_followed','milestone_liked','project_invite_accepted','project_invite_declined','course_invite_accepted','course_invite_declined','submission_received','submission_approved','submission_rejected')
 UNION ALL
 SELECT 1,m.created_at,'milestone:'||m.id,'followed_milestone',jsonb_build_object('target_path','/feed?milestone='||m.id,'title',coalesce(nullif(pr.full_name,''),pr.username),'kind',m.kind)
 FROM public.feed_milestones m JOIN public.profiles pr ON pr.id=m.actor_id
 JOIN private.notification_digest_state s ON s.user_id=p_user
 WHERE m.created_at>greatest(s.enabled_at,coalesce(s.feed_seen_at,s.enabled_at)) AND private.feed_milestone_visible(m.id,p_user)
 AND EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=p_user AND f.subject_type='user' AND f.subject_id=m.actor_id::text AND (f.muted_until IS NULL OR f.muted_until<now()))
 ), selected AS (
 SELECT key,type,payload FROM candidates c WHERE payload IS NOT NULL AND NOT EXISTS(SELECT 1 FROM private.notification_digest_items i WHERE i.user_id=p_user AND i.item_key=c.key)
 ORDER BY priority,at_time DESC,key LIMIT 10
 ) SELECT coalesce(jsonb_agg(to_jsonb(selected)),'[]') INTO result FROM selected;
 RETURN result;
END $$;
CREATE FUNCTION private.notification_digest_finish(p_user uuid,p_keys text[],p_accepted boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE private.notification_digest_state SET last_attempt_at=now(),last_digest_at=CASE WHEN p_accepted THEN now() ELSE last_digest_at END WHERE user_id=p_user;
 IF p_accepted THEN INSERT INTO private.notification_digest_items(user_id,item_key) SELECT p_user,unnest(p_keys) ON CONFLICT DO NOTHING; END IF;
END $$;
CREATE FUNCTION public.notification_digest_candidates() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.notification_digest_candidates() $$;
CREATE FUNCTION public.notification_digest_content(p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.notification_digest_content(p_user) $$;
CREATE FUNCTION public.notification_digest_finish(p_user uuid,p_keys text[],p_accepted boolean) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.notification_digest_finish(p_user,p_keys,p_accepted) $$;

-- Default privileges must never expose the worker, projection or queue to browser callers.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
 WHERE ns.nspname IN ('public','private') AND (p.proname LIKE 'notification_%' OR p.proname LIKE 'notifications_%' OR p.proname IN ('capture_notification_event','add_social_notification','process_notification_events','enqueue_hackathon_notification')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION private.notification_can_read(uuid,uuid),private.notifications_page(timestamptz,uuid,boolean,integer),public.notifications_page(timestamptz,uuid,boolean,integer),private.notifications_read(uuid,boolean,timestamptz),public.notifications_read(uuid,boolean,timestamptz),private.notifications_feed_seen(),public.notifications_feed_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_hackathon_notification(text,text,text,uuid[],text),private.notification_digest_candidates(),public.notification_digest_candidates(),private.notification_digest_content(uuid),public.notification_digest_content(uuid),private.notification_digest_finish(uuid,text[],boolean),public.notification_digest_finish(uuid,text[],boolean) TO service_role;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='user_notifications') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
 END IF;
END $$;
SELECT cron.schedule('corelia-notifications','10 seconds','SELECT private.process_notification_events(100)');

CREATE FUNCTION private.notifications_metrics() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE report jsonb;
BEGIN
 IF NOT public.is_admin_or_support() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'groups',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT type,count(*) AS created,count(opened_at) AS opened FROM public.user_notifications WHERE group_key IS NOT NULL GROUP BY type) x),
  'follow_backs',(SELECT count(DISTINCT n.id) FROM public.user_notifications n JOIN private.notification_actors a ON a.notification_id=n.id JOIN public.follows f ON f.follower_id=n.user_id AND f.subject_type='user' AND f.subject_id=a.actor::text WHERE n.type='user_followed' AND n.opened_at IS NOT NULL AND f.created_at BETWEEN n.opened_at AND n.opened_at+interval '24 hours'),
  'subsequent_likes',(SELECT count(DISTINCT n.id) FROM public.user_notifications n JOIN public.project_hearts h ON h.user_id=n.user_id WHERE n.opened_at IS NOT NULL AND h.created_at BETWEEN n.opened_at AND n.opened_at+interval '24 hours'),
  'preferences',(SELECT jsonb_build_object('users',count(*),'likes_off',count(*) FILTER(WHERE NOT in_app_likes),'follows_off',count(*) FILTER(WHERE NOT in_app_follows),'digest_on',count(*) FILTER(WHERE email_social_digest)) FROM public.notification_preferences),
  'queue',(SELECT jsonb_build_object('pending',count(*) FILTER(WHERE processed_at IS NULL),'errors',count(*) FILTER(WHERE last_error IS NOT NULL),'oldest_pending',min(happened_at) FILTER(WHERE processed_at IS NULL),'mean_seconds',avg(extract(epoch FROM processed_at-happened_at))) FROM private.notification_events),
  'email',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT status,count(*) FROM public.email_outbox_events WHERE event_type='social_digest' GROUP BY status) x)
 ) INTO report;
 RETURN report;
END $$;
CREATE FUNCTION public.notifications_metrics() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.notifications_metrics() $$;
REVOKE ALL ON FUNCTION private.notifications_metrics(),public.notifications_metrics() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.notifications_metrics(),public.notifications_metrics() TO authenticated;
