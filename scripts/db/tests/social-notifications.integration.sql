BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at)
SELECT ('aabc0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'notice-'||n||'@corelia.local',now() FROM generate_series(1,7) n;
UPDATE public.profiles SET profile_public=true WHERE id::text LIKE 'aabc0000-%';
INSERT INTO public.projects(id,owner_id,slug,title,source_type,visibility)
 VALUES('aabc9999-0000-4000-8000-000000000001','aabc0000-0000-4000-8000-000000000002','notification-project','Team project','standalone','public');
INSERT INTO public.project_collaborators(project_id,user_id) VALUES('aabc9999-0000-4000-8000-000000000001','aabc0000-0000-4000-8000-000000000003');
INSERT INTO public.project_hearts(project_id,user_id) VALUES
 ('aabc9999-0000-4000-8000-000000000001','aabc0000-0000-4000-8000-000000000001'),
 ('aabc9999-0000-4000-8000-000000000001','aabc0000-0000-4000-8000-000000000002');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.user_notifications WHERE type='project_liked' AND user_id::text LIKE 'aabc0000-%') THEN RAISE EXCEPTION 'Fanout happened on the save path'; END IF;
 PERFORM private.process_notification_events();
 IF EXISTS(SELECT 1 FROM private.notification_events WHERE actor::text LIKE 'aabc0000-%' AND last_error IS NOT NULL) THEN RAISE EXCEPTION 'Worker failed'; END IF;
 IF (SELECT count(*) FROM public.user_notifications WHERE type='project_liked' AND user_id::text LIKE 'aabc0000-%')<>2 THEN RAISE EXCEPTION 'Wrong team recipients'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','aabc0000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE page jsonb; BEGIN
 page:=public.notifications_page();
 IF (page->>'unread_count')::int<>1 OR (page#>>'{items,0,payload,count}')::int<>1 THEN RAISE EXCEPTION 'Self-like leaked into owner count: %',page; END IF;
 PERFORM public.notifications_read((page#>>'{items,0,id}')::uuid,true);
 IF (public.notifications_page()->>'unread_count')::int<>0 THEN RAISE EXCEPTION 'Mark read failed'; END IF;
 BEGIN UPDATE public.user_notifications SET payload='{}'; RAISE EXCEPTION 'Browser may forge payload'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM private.process_notification_events(); RAISE EXCEPTION 'Browser may run worker'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.notification_digest_content(auth.uid()); RAISE EXCEPTION 'Browser may read digest'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
-- Undo/repeat must not manufacture an unread notification or increase counts.
DELETE FROM public.project_hearts WHERE user_id='aabc0000-0000-4000-8000-000000000001';
SELECT private.process_notification_events();
DO $$ BEGIN
 IF jsonb_array_length(public.notifications_page()->'items')<>0 THEN RAISE EXCEPTION 'Unlike did not retract'; END IF;
END $$;
INSERT INTO public.project_hearts(project_id,user_id) VALUES('aabc9999-0000-4000-8000-000000000001','aabc0000-0000-4000-8000-000000000001');
SELECT private.process_notification_events();
DO $$ BEGIN
 IF (public.notifications_page()->>'unread_count')::int<>0 THEN RAISE EXCEPTION 'Repeated like manufactured unread state'; END IF;
END $$;
-- New person makes the group unread; private actor identity is never returned.
UPDATE public.profiles SET profile_public=false WHERE id='aabc0000-0000-4000-8000-000000000004';
INSERT INTO public.project_hearts(project_id,user_id) VALUES('aabc9999-0000-4000-8000-000000000001','aabc0000-0000-4000-8000-000000000004');
SELECT private.process_notification_events();
DO $$ DECLARE page jsonb:=public.notifications_page(); BEGIN
 IF (page->>'unread_count')::int<>1 OR (page#>>'{items,0,payload,count}')::int<>2 THEN RAISE EXCEPTION 'Group update failed'; END IF;
 IF page::text LIKE '%aabc0000-0000-4000-8000-000000000004%' THEN RAISE EXCEPTION 'Private actor leaked'; END IF;
END $$;
DELETE FROM public.project_collaborators WHERE user_id='aabc0000-0000-4000-8000-000000000003';
SELECT set_config('request.jwt.claim.sub','aabc0000-0000-4000-8000-000000000003',true);
DO $$ BEGIN IF jsonb_array_length(public.notifications_page()->'items')<>0 THEN RAISE EXCEPTION 'Departed member retained notification'; END IF; END $$;
-- Follow recipients and same group counter.
INSERT INTO public.follows(follower_id,subject_type,subject_id) VALUES('aabc0000-0000-4000-8000-000000000001','user','aabc0000-0000-4000-8000-000000000002');
SELECT private.process_notification_events();
SELECT set_config('request.jwt.claim.sub','aabc0000-0000-4000-8000-000000000002',true);
-- Total unread is independent of page size. Stable cursor yields 20 distinct records.
INSERT INTO public.user_notifications(user_id,type,created_at,activity_at)
 SELECT 'aabc0000-0000-4000-8000-000000000002','course_completed',now()-n*interval '1 second',now()-n*interval '1 second' FROM generate_series(1,45) n;
DO $$ DECLARE first_page jsonb; second_page jsonb; last_row jsonb; BEGIN
 first_page:=public.notifications_page(); last_row:=first_page->'items'->19;
 second_page:=public.notifications_page((last_row->>'activity_at')::timestamptz,(last_row->>'id')::uuid);
 IF (first_page->>'unread_count')::int<>47 OR jsonb_array_length(first_page->'items')<>20 OR jsonb_array_length(second_page->'items')<>20 THEN RAISE EXCEPTION 'Pagination/count failed: %',first_page; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(first_page->'items') a JOIN jsonb_array_elements(second_page->'items') b ON a->>'id'=b->>'id') THEN RAISE EXCEPTION 'Duplicate cursor page'; END IF;
END $$;
-- Email explicit opt-in, unread filtering, suppression and no repeat.
DO $$ BEGIN IF jsonb_array_length(public.notification_digest_content('aabc0000-0000-4000-8000-000000000002'))<>0 THEN RAISE EXCEPTION 'Digest opted in by default'; END IF; END $$;
INSERT INTO public.notification_preferences(user_id,email_social_digest) VALUES('aabc0000-0000-4000-8000-000000000002',true)
 ON CONFLICT(user_id) DO UPDATE SET email_social_digest=true;
UPDATE private.notification_digest_state SET enabled_at=now()-interval '1 day' WHERE user_id='aabc0000-0000-4000-8000-000000000002';
UPDATE public.notification_preferences SET digest_timezone=(SELECT name FROM pg_timezone_names WHERE extract(hour FROM now() AT TIME ZONE name)>=9 ORDER BY name LIMIT 1) WHERE user_id='aabc0000-0000-4000-8000-000000000002';
DO $$ BEGIN
 IF public.notification_digest_candidates()::text NOT LIKE '%notice-2@corelia.local%' THEN RAISE EXCEPTION 'Opted-in recipient not scheduled after 09:00'; END IF;
END $$;

DO $$ DECLARE items jsonb; keys text[]; BEGIN
 items:=public.notification_digest_content('aabc0000-0000-4000-8000-000000000002');
 IF jsonb_array_length(items)<>2 THEN RAISE EXCEPTION 'Digest contains duplicate transactional messages or missing social events: %',items; END IF;
 SELECT array_agg(x->>'key') INTO keys FROM jsonb_array_elements(items) x;
 PERFORM public.notification_digest_finish('aabc0000-0000-4000-8000-000000000002',keys,true);
 IF jsonb_array_length(public.notification_digest_content('aabc0000-0000-4000-8000-000000000002'))<>0 THEN RAISE EXCEPTION 'Digest repeats'; END IF;
 IF public.notification_digest_candidates()::text LIKE '%notice-2@corelia.local%' THEN RAISE EXCEPTION 'More than one daily digest'; END IF;
END $$;
INSERT INTO public.email_contacts(email,global_suppressed_at) VALUES('notice-2@corelia.local',now()) ON CONFLICT(email) DO UPDATE SET global_suppressed_at=now();
DO $$ BEGIN IF public.notification_digest_candidates()::text LIKE '%notice-2@corelia.local%' THEN RAISE EXCEPTION 'Suppressed address eligible'; END IF; END $$;

-- Assignment queue groups pending work and review results go only to the learner.
INSERT INTO public.courses(id,slug,instructor_id,published,data) VALUES('notification-course','notification-course','aabc0000-0000-4000-8000-000000000005',true,'{"title":"Course","co_instructor_permissions":{"aabc0000-0000-4000-8000-000000000007":{"submissions":true}}}');
INSERT INTO public.enrollments(id,user_id,course_id,enrolled_at,last_accessed_at) VALUES('notification-enrollment','aabc0000-0000-4000-8000-000000000006','notification-course',now(),now());
INSERT INTO public.final_assignment_submissions(id,user_id,course_id,submitted_at,content) VALUES('notification-assignment','aabc0000-0000-4000-8000-000000000006','notification-course',now(),'Private student content');
SELECT private.process_notification_events();
SELECT set_config('request.jwt.claim.sub','aabc0000-0000-4000-8000-000000000005',true);
DO $$ DECLARE page jsonb:=public.notifications_page(); BEGIN
 IF NOT page @> '{"items":[{"type":"submission_received","payload":{"count":1}}]}' THEN RAISE EXCEPTION 'Missing instructor review task: %',page; END IF;
 IF page::text LIKE '%Private student content%' THEN RAISE EXCEPTION 'Submission content copied into inbox'; END IF;
END $$;
UPDATE public.final_assignment_submissions SET status='rejected',reviewer_comment='Private feedback',reviewed_at=now() WHERE id='notification-assignment';
SELECT private.process_notification_events();
DO $$ BEGIN IF jsonb_array_length(public.notifications_page()->'items')<>0 THEN RAISE EXCEPTION 'Reviewed task remains pending'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','aabc0000-0000-4000-8000-000000000006',true);
DO $$ DECLARE page jsonb:=public.notifications_page(); BEGIN
 IF NOT page @> '{"items":[{"type":"submission_rejected"}]}' THEN RAISE EXCEPTION 'Missing review result: %',page; END IF;
 IF page::text LIKE '%Private feedback%' THEN RAISE EXCEPTION 'Feedback copied into inbox'; END IF;
END $$;
-- Both invitation acceptance paths already tested by the team suite; test response delivery here.
INSERT INTO public.projects(id,owner_id,slug,title,source_type,visibility)
 VALUES('aabc9999-0000-4000-8000-000000000002','aabc0000-0000-4000-8000-000000000005','notification-invite-project','Invited project','standalone','private');
DO $$ DECLARE invitation json; BEGIN
 PERFORM set_config('request.jwt.claim.sub','aabc0000-0000-4000-8000-000000000005',true); SET LOCAL ROLE authenticated;
 invitation:=public.create_project_collaboration_invite('aabc9999-0000-4000-8000-000000000002','aabc0000-0000-4000-8000-000000000007');
 PERFORM set_config('request.jwt.claim.sub','aabc0000-0000-4000-8000-000000000007',true);
 PERFORM public.accept_project_collaboration_invite_by_id((invitation->>'invite_id')::uuid);
 RESET ROLE;
 PERFORM private.process_notification_events();
 PERFORM set_config('request.jwt.claim.sub','aabc0000-0000-4000-8000-000000000005',true);
 IF NOT public.notifications_page() @> '{"items":[{"type":"project_invite_accepted"}]}' THEN RAISE EXCEPTION 'Inviter did not receive response'; END IF;
END $$;
-- Milestone links use the exact source ID and vanish when it becomes private.
INSERT INTO public.user_point_ledger(user_id,source,source_key,points) VALUES('aabc0000-0000-4000-8000-000000000006','lesson_completed','notification-milestone',100);
INSERT INTO public.feed_milestones(actor_id,kind,source_key,xp_total) VALUES('aabc0000-0000-4000-8000-000000000006','xp_reached','notification-milestone',100);
INSERT INTO public.feed_milestone_likes(milestone_id,user_id) SELECT id,'aabc0000-0000-4000-8000-000000000001' FROM public.feed_milestones WHERE source_key='notification-milestone';
SELECT private.process_notification_events();
SELECT set_config('request.jwt.claim.sub','aabc0000-0000-4000-8000-000000000006',true);
DO $$ DECLARE page jsonb:=public.notifications_page(); BEGIN
 IF NOT page @> '{"items":[{"type":"milestone_liked"}]}' OR page::text NOT LIKE '%/feed?milestone=%' THEN RAISE EXCEPTION 'Missing milestone deep link'; END IF;
END $$;
UPDATE public.profiles SET profile_public=false WHERE id='aabc0000-0000-4000-8000-000000000006';
DO $$ BEGIN
 IF public.notifications_page() @> '{"items":[{"type":"milestone_liked"}]}' THEN RAISE EXCEPTION 'Private milestone leaked'; END IF;
 IF EXISTS(SELECT 1 FROM private.notification_events WHERE actor::text LIKE 'aabc0000-%' AND last_error IS NOT NULL) THEN RAISE EXCEPTION 'Unprocessed event errors'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','aabc0000-0000-4000-8000-000000000002',true);
-- Valid sources survive repeated worker runs; invalid source is hidden in both RPC and raw table access.
UPDATE public.profiles SET role='admin' WHERE id='aabc0000-0000-4000-8000-000000000002';
UPDATE public.projects SET blocked=true,visibility='private' WHERE id='aabc9999-0000-4000-8000-000000000001';
SELECT set_config('row_security','on',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.user_notifications WHERE type='project_liked') THEN RAISE EXCEPTION 'Raw table leaked blocked content'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','aabc0000-0000-4000-8000-000000000004',true);
DO $$ BEGIN IF (public.notifications_page()->>'unread_count')::int<>0 THEN RAISE EXCEPTION 'Cross-account cache/query scope'; END IF; END $$;
ROLLBACK;
