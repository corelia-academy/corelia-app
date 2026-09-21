-- XP uses the retained point ledger. Existing source keys and balances remain intact.
ALTER TABLE public.user_point_ledger DROP CONSTRAINT IF EXISTS user_point_ledger_source_check;
ALTER TABLE public.user_point_ledger ADD CONSTRAINT user_point_ledger_source_check CHECK (source IN (
  'daily_streak_claim', 'ocid_connected', 'github_connected',
  'ethereum_wallet', 'solana_wallet', 'lesson_completed', 'quiz_passed',
  'course_completed', 'first_hackathon_submission', 'project_liked', 'correction'
));
ALTER TABLE public.user_point_ledger
  ADD COLUMN rule_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN entity_type text,
  ADD COLUMN entity_id text,
  ADD COLUMN occurred_at timestamptz,
  ADD COLUMN reason text,
  ADD COLUMN reverses_id uuid REFERENCES public.user_point_ledger(id),
  ADD CONSTRAINT user_point_reversal_shape CHECK (
    (source = 'correction' AND reverses_id IS NOT NULL AND points < 0 AND reason IS NOT NULL)
    OR (source <> 'correction' AND reverses_id IS NULL AND points > 0)
  );
CREATE UNIQUE INDEX user_point_reversal_once ON public.user_point_ledger(reverses_id) WHERE reverses_id IS NOT NULL;
CREATE INDEX user_point_ledger_activity ON public.user_point_ledger(user_id, occurred_at DESC) WHERE occurred_at IS NOT NULL;

CREATE TABLE private.xp_tracking_config (started_at timestamptz NOT NULL);
INSERT INTO private.xp_tracking_config(started_at) VALUES(clock_timestamp());
REVOKE ALL ON private.xp_tracking_config FROM PUBLIC,anon,authenticated;

-- A first like never earns XP twice, even if the user unlikes or hits the daily cap.
CREATE TABLE public.xp_project_like_seen (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, project_id)
);
ALTER TABLE public.xp_project_like_seen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xp_project_like_seen FROM PUBLIC, anon, authenticated;

-- One project can only fund one user's first hackathon submission award.
CREATE TABLE public.xp_hackathon_project_seen (
  project_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hackathon_id text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xp_hackathon_project_seen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xp_hackathon_project_seen FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.xp_award(p_user uuid, p_source text, p_key text, p_points integer,
  p_entity_type text, p_entity_id text, p_occurred timestamptz) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE awarded boolean;
BEGIN
  IF p_user IS NULL OR p_key IS NULL OR p_points <= 0 THEN RAISE EXCEPTION 'INVALID_XP_AWARD'; END IF;
  INSERT INTO public.user_point_ledger(user_id, source, source_key, points, rule_version, entity_type, entity_id, occurred_at)
  VALUES(p_user, p_source, p_key, p_points, 1, p_entity_type, p_entity_id, p_occurred)
  ON CONFLICT(user_id, source_key) DO NOTHING;
  GET DIAGNOSTICS awarded = ROW_COUNT;
  RETURN awarded;
END $$;
REVOKE ALL ON FUNCTION private.xp_award(uuid,text,text,integer,text,text,timestamptz) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.xp_verified_ocid (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ocid text NOT NULL UNIQUE,
  verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xp_verified_ocid ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xp_verified_ocid FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.xp_verified_ocid TO service_role;

CREATE FUNCTION private.xp_guard_ocid_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    changed := NEW.ocid IS NOT NULL OR NEW.ocid_eth_address IS NOT NULL OR NEW.ocid_connected_at IS NOT NULL;
  ELSE
    changed := (NEW.ocid,NEW.ocid_eth_address,NEW.ocid_connected_at)
      IS DISTINCT FROM (OLD.ocid,OLD.ocid_eth_address,OLD.ocid_connected_at);
  END IF;
  IF changed AND current_setting('app.xp_verified_ocid_write',true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'OCID_VERIFIED_LINK_REQUIRED' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.xp_guard_ocid_profile() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER xp_guard_ocid_profile BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.xp_guard_ocid_profile();

CREATE FUNCTION public.xp_link_verified_ocid(p_user_id uuid,p_ocid text,p_eth_address text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS NULL OR NULLIF(btrim(p_ocid),'') IS NULL OR length(p_ocid)>200 THEN
    RAISE EXCEPTION 'INVALID_OCID';
  END IF;
  PERFORM set_config('app.xp_verified_ocid_write','on',true);
  INSERT INTO public.xp_verified_ocid(user_id,ocid) VALUES(p_user_id,btrim(p_ocid))
  ON CONFLICT(user_id) DO UPDATE SET ocid=EXCLUDED.ocid,verified_at=clock_timestamp();
  UPDATE public.profiles SET ocid=btrim(p_ocid),ocid_eth_address=p_eth_address,
    ocid_connected_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  RETURN private.xp_award(p_user_id,'ocid_connected','ocid_connected',50,'identity','ocid',clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION public.xp_link_verified_ocid(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xp_link_verified_ocid(uuid,text,text) TO service_role;

CREATE FUNCTION public.xp_unlink_ocid() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid:=auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM set_config('app.xp_verified_ocid_write','on',true);
  DELETE FROM public.xp_verified_ocid WHERE user_id=u;
  UPDATE public.profiles SET ocid=NULL,ocid_eth_address=NULL,ocid_connected_at=NULL,
    updated_at=clock_timestamp() WHERE id=u;
END $$;
REVOKE ALL ON FUNCTION public.xp_unlink_ocid() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.xp_unlink_ocid() TO authenticated;

-- Only a transition to completed on an available lesson earns XP.
CREATE FUNCTION private.xp_lesson_completed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.courses%ROWTYPE; l public.course_lessons%ROWTYPE;
BEGIN
  IF NEW.completed_at IS NULL OR (TG_OP = 'UPDATE' AND OLD.completed_at IS NOT NULL) THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.courses WHERE id = NEW.course_id;
  SELECT * INTO l FROM public.course_lessons WHERE course_id = NEW.course_id AND id = NEW.lesson_id;
  IF NOT FOUND OR NOT c.published OR c.archived_at IS NOT NULL OR NOT l.published OR l.archived_at IS NOT NULL
     OR c.instructor_id = NEW.user_id OR (c.data->'co_instructor_permissions') ? NEW.user_id::text
     OR l.data->>'lesson_format' = 'quiz'
     OR NOT EXISTS(SELECT 1 FROM public.enrollments WHERE user_id=NEW.user_id AND course_id=NEW.course_id)
     THEN RETURN NEW; END IF;
  PERFORM private.xp_award(NEW.user_id,'lesson_completed','lesson_completed:'||NEW.course_id||':'||NEW.lesson_id,
    10,'lesson',NEW.course_id||':'||NEW.lesson_id,NEW.completed_at);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.xp_lesson_completed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER xp_lesson_completed AFTER INSERT OR UPDATE OF completed_at ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION private.xp_lesson_completed();

-- Quiz groups receive results in the trusted submit RPC, which writes group_total last.
CREATE FUNCTION private.xp_quiz_passed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.courses%ROWTYPE; l public.course_lessons%ROWTYPE;
BEGIN
  IF NEW.lesson_id IS NULL OR NEW.attempt_group_id IS NULL OR NEW.group_total IS NULL
     OR NEW.group_total < 1 OR NEW.group_correct::numeric / NEW.group_total < 0.8 THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.courses WHERE id = NEW.course_id;
  SELECT * INTO l FROM public.course_lessons WHERE course_id = NEW.course_id AND id = NEW.lesson_id;
  IF NOT FOUND OR NOT c.published OR c.archived_at IS NOT NULL OR NOT l.published OR l.archived_at IS NOT NULL
     OR c.instructor_id = NEW.user_id OR (c.data->'co_instructor_permissions') ? NEW.user_id::text
     OR l.data->>'lesson_format' <> 'quiz'
     OR NOT EXISTS(SELECT 1 FROM public.enrollments WHERE user_id=NEW.user_id AND course_id=NEW.course_id)
     THEN RETURN NEW; END IF;
  PERFORM private.xp_award(NEW.user_id,'quiz_passed','quiz_passed:'||NEW.course_id||':'||NEW.lesson_id,
    20,'quiz',NEW.course_id||':'||NEW.lesson_id,NEW.attempted_at);
  PERFORM private.xp_award(NEW.user_id,'lesson_completed','lesson_completed:'||NEW.course_id||':'||NEW.lesson_id,
    10,'lesson',NEW.course_id||':'||NEW.lesson_id,NEW.attempted_at);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.xp_quiz_passed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER xp_quiz_passed AFTER UPDATE OF group_total ON public.section_question_attempts
  FOR EACH ROW EXECUTE FUNCTION private.xp_quiz_passed();

CREATE FUNCTION private.xp_course_completed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.courses%ROWTYPE;
BEGIN
  IF NEW.completed_at IS NULL OR (TG_OP = 'UPDATE' AND OLD.completed_at IS NOT NULL) THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.courses WHERE id=NEW.course_id;
  IF c.published AND c.archived_at IS NULL AND c.instructor_id <> NEW.user_id
     AND NOT ((c.data->'co_instructor_permissions') ? NEW.user_id::text) THEN
    PERFORM private.xp_award(NEW.user_id,'course_completed','course_completed:'||NEW.course_id,
      100,'course',NEW.course_id,NEW.completed_at);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.xp_course_completed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER xp_course_completed AFTER INSERT OR UPDATE OF completed_at ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION private.xp_course_completed();

CREATE FUNCTION private.xp_project_liked() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.projects%ROWTYPE; first_like boolean; earned integer;
BEGIN
  -- Serialize the daily allowance across tabs and separate project likes.
  PERFORM pg_advisory_xact_lock(hashtextextended('xp_like:'||NEW.user_id::text,0));
  SELECT * INTO p FROM public.projects WHERE id = NEW.project_id;
  IF NOT FOUND OR p.visibility <> 'public' OR p.owner_id = NEW.user_id OR EXISTS(
    SELECT 1 FROM public.project_collaborators WHERE project_id=NEW.project_id AND user_id=NEW.user_id
  ) THEN RETURN NEW; END IF;
  INSERT INTO public.xp_project_like_seen(user_id,project_id) VALUES(NEW.user_id,NEW.project_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS first_like = ROW_COUNT;
  IF NOT first_like THEN RETURN NEW; END IF;
  SELECT count(*) INTO earned FROM public.user_point_ledger
  WHERE user_id=NEW.user_id AND source='project_liked' AND (occurred_at AT TIME ZONE 'UTC')::date=(now() AT TIME ZONE 'UTC')::date;
  IF earned < 5 THEN
    PERFORM private.xp_award(NEW.user_id,'project_liked','project_liked:'||NEW.project_id,
      2,'project',NEW.project_id::text,clock_timestamp());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.xp_project_liked() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER xp_project_liked AFTER INSERT ON public.project_hearts
  FOR EACH ROW EXECUTE FUNCTION private.xp_project_liked();

-- The toggle returns an award only when this transaction inserted that award.
CREATE FUNCTION public.xp_toggle_project_heart(p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); was_awarded boolean; now_awarded boolean;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('xp_like:'||u::text,0));
  IF EXISTS(SELECT 1 FROM public.project_hearts WHERE user_id=u AND project_id=p_project_id) THEN
    DELETE FROM public.project_hearts WHERE user_id=u AND project_id=p_project_id;
    RETURN jsonb_build_object('hearted',false,'awarded',false);
  END IF;
  IF NOT private.can_read_project_content(p_project_id,u) THEN
    RAISE EXCEPTION 'PROJECT_NOT_VISIBLE' USING ERRCODE='42501';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_point_ledger WHERE user_id=u AND source_key='project_liked:'||p_project_id)
    INTO was_awarded;
  INSERT INTO public.project_hearts(project_id,user_id) VALUES(p_project_id,u);
  SELECT EXISTS(SELECT 1 FROM public.user_point_ledger WHERE user_id=u AND source_key='project_liked:'||p_project_id)
    INTO now_awarded;
  RETURN jsonb_build_object('hearted',true,'awarded',now_awarded AND NOT was_awarded);
END $$;
REVOKE ALL ON FUNCTION public.xp_toggle_project_heart(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.xp_toggle_project_heart(uuid) TO authenticated;

CREATE FUNCTION private.xp_hackathon_submitted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE first_project boolean; p public.projects%ROWTYPE; h public.hackathons%ROWTYPE; deadline text;
BEGIN
  IF NEW.project_id IS NULL OR (TG_OP='UPDATE' AND OLD.project_id IS NOT NULL) THEN RETURN NEW; END IF;
  SELECT * INTO p FROM public.projects WHERE id=NEW.project_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT * INTO h FROM public.hackathons WHERE id=NEW.hackathon_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF p.owner_id IS DISTINCT FROM NEW.user_id OR p.source_type<>'hackathon'
     OR p.source_id IS DISTINCT FROM NEW.hackathon_id OR p.visibility<>'public'
     OR h.status NOT IN ('published','running')
     OR NOT EXISTS(SELECT 1 FROM public.hackathon_registrations r
       WHERE r.hackathon_id=NEW.hackathon_id AND r.user_id=NEW.user_id
         AND r.document->>'status' IN ('registered','approved'))
     THEN RETURN NEW; END IF;
  deadline := COALESCE(NULLIF(btrim(h.document->>'submission_deadline'),''),
    NULLIF(btrim(h.document->>'ends_at'),''));
  IF deadline IS NOT NULL AND clock_timestamp()>deadline::timestamptz THEN RETURN NEW; END IF;
  INSERT INTO public.xp_hackathon_project_seen(project_id,user_id,hackathon_id)
  VALUES(NEW.project_id,NEW.user_id,NEW.hackathon_id) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS first_project = ROW_COUNT;
  IF first_project THEN
    PERFORM private.xp_award(NEW.user_id,'first_hackathon_submission','first_hackathon_submission',
      100,'project',NEW.project_id::text,clock_timestamp());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.xp_hackathon_submitted() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER xp_hackathon_submitted AFTER INSERT OR UPDATE OF project_id ON public.hackathon_submissions
  FOR EACH ROW EXECUTE FUNCTION private.xp_hackathon_submitted();

-- Existing linked identities are awarded lazily on an authenticated XP read.
CREATE FUNCTION public.xp_sync_connections() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.xp_verified_ocid WHERE user_id=u) THEN
    PERFORM private.xp_award(u,'ocid_connected','ocid_connected',50,'identity','ocid',clock_timestamp());
  END IF;
  IF EXISTS(SELECT 1 FROM auth.identities WHERE user_id=u AND provider='github') THEN
    PERFORM private.xp_award(u,'github_connected','github_connected',50,'identity','github',clock_timestamp());
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.xp_sync_connections() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.xp_sync_connections() TO authenticated;

-- Public totals/calendar are filtered by profile visibility; detailed history remains owner-only.
CREATE FUNCTION public.xp_summary(p_user_id uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE allowed boolean; total bigint; days jsonb;
BEGIN
  SELECT (profile_public OR id=auth.uid()) INTO allowed FROM public.profiles WHERE id=p_user_id;
  IF NOT COALESCE(allowed,false) THEN RETURN NULL; END IF;
  SELECT COALESCE(sum(points),0) INTO total FROM public.user_point_ledger WHERE user_id=p_user_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date',activity_date,'xp',xp) ORDER BY activity_date),'[]'::jsonb) INTO days
  FROM (
    SELECT (COALESCE(original.occurred_at, l.occurred_at) AT TIME ZONE 'UTC')::date AS activity_date, sum(l.points) AS xp
    FROM public.user_point_ledger l LEFT JOIN public.user_point_ledger original ON original.id=l.reverses_id
    WHERE l.user_id=p_user_id AND COALESCE(original.occurred_at,l.occurred_at) IS NOT NULL
      AND (p_from IS NULL OR (COALESCE(original.occurred_at,l.occurred_at) AT TIME ZONE 'UTC')::date >= p_from)
      AND (p_to IS NULL OR (COALESCE(original.occurred_at,l.occurred_at) AT TIME ZONE 'UTC')::date <= p_to)
    GROUP BY 1
  ) daily;
  RETURN jsonb_build_object('total',total,'days',days,'tracking_since',
    (SELECT (started_at AT TIME ZONE 'UTC')::date FROM private.xp_tracking_config LIMIT 1));
END $$;
REVOKE ALL ON FUNCTION public.xp_summary(uuid,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.xp_summary(uuid,date,date) TO anon,authenticated;

-- Batch totals keep feed and project cards to one read, with the same visibility rule.
CREATE FUNCTION public.xp_totals(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, total_xp bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF cardinality(p_user_ids) > 100 THEN RAISE EXCEPTION 'TOO_MANY_USERS'; END IF;
  RETURN QUERY
  SELECT p.id, COALESCE(sum(l.points),0)::bigint
  FROM public.profiles p LEFT JOIN public.user_point_ledger l ON l.user_id=p.id
  WHERE p.id=ANY(p_user_ids) AND (p.profile_public OR p.id=auth.uid())
  GROUP BY p.id;
END $$;
REVOKE ALL ON FUNCTION public.xp_totals(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.xp_totals(uuid[]) TO anon,authenticated;

CREATE FUNCTION public.xp_day_breakdown(p_day date)
RETURNS TABLE(source text, xp bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(original.source,l.source),sum(l.points)::bigint
  FROM public.user_point_ledger l
  LEFT JOIN public.user_point_ledger original ON original.id=l.reverses_id
  WHERE l.user_id=auth.uid()
    AND (COALESCE(original.occurred_at,l.occurred_at) AT TIME ZONE 'UTC')::date=p_day
  GROUP BY 1 HAVING sum(l.points)<>0
$$;
REVOKE ALL ON FUNCTION public.xp_day_breakdown(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.xp_day_breakdown(date) TO authenticated;

-- Wallets are verified off-chain by the Edge API, then consumed atomically here.
CREATE TABLE public.wallet_link_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain text NOT NULL CHECK (chain IN ('ethereum','solana')),
  address text NOT NULL,
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_link_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallet_link_challenges FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.wallet_link_challenges TO service_role;
CREATE INDEX wallet_link_challenges_expiry ON public.wallet_link_challenges(expires_at);

CREATE TABLE public.connected_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chain text NOT NULL CHECK (chain IN ('ethereum','solana')),
  address text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chain,address)
);
CREATE INDEX connected_wallets_owner ON public.connected_wallets(user_id,chain);
ALTER TABLE public.connected_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY connected_wallets_owner_read ON public.connected_wallets FOR SELECT TO authenticated
  USING (user_id=auth.uid());
REVOKE ALL ON public.connected_wallets FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.connected_wallets TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.connected_wallets TO service_role;

CREATE FUNCTION public.xp_consume_wallet_challenge(p_challenge_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE challenge public.wallet_link_challenges%ROWTYPE; linked boolean; awarded boolean;
BEGIN
  UPDATE public.wallet_link_challenges SET consumed_at=clock_timestamp()
  WHERE id=p_challenge_id AND user_id=p_user_id AND consumed_at IS NULL AND expires_at>clock_timestamp()
  RETURNING * INTO challenge;
  IF NOT FOUND THEN RETURN jsonb_build_object('linked',false,'awarded',false); END IF;
  INSERT INTO public.connected_wallets(user_id,chain,address)
  VALUES(challenge.user_id,challenge.chain,challenge.address) ON CONFLICT(chain,address) DO NOTHING;
  GET DIAGNOSTICS linked = ROW_COUNT;
  IF NOT linked THEN RETURN jsonb_build_object('linked',false,'awarded',false); END IF;
  awarded := private.xp_award(challenge.user_id,challenge.chain||'_wallet',challenge.chain||'_wallet',30,
    'wallet',challenge.address,clock_timestamp());
  RETURN jsonb_build_object('linked',true,'awarded',awarded);
END $$;
REVOKE ALL ON FUNCTION public.xp_consume_wallet_challenge(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xp_consume_wallet_challenge(uuid,uuid) TO service_role;

-- Privileged support/reconciliation path: reversals stay in the append-only ledger.
CREATE FUNCTION public.xp_reverse_award(p_award_id uuid, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE award public.user_point_ledger%ROWTYPE; reversed boolean;
BEGIN
  IF NULLIF(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  SELECT * INTO award FROM public.user_point_ledger WHERE id=p_award_id AND points>0 AND source<>'correction';
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.user_point_ledger(user_id,source,source_key,points,rule_version,entity_type,entity_id,occurred_at,reason,reverses_id)
  VALUES(award.user_id,'correction','correction:'||award.id,-award.points,award.rule_version,
    award.entity_type,award.entity_id,clock_timestamp(),btrim(p_reason),award.id)
  ON CONFLICT(user_id,source_key) DO NOTHING;
  GET DIAGNOSTICS reversed = ROW_COUNT;
  RETURN reversed;
END $$;
REVOKE ALL ON FUNCTION public.xp_reverse_award(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xp_reverse_award(uuid,text) TO service_role;
