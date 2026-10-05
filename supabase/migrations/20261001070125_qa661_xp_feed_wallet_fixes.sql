-- QA #661: B-07 quiz XP threshold, H-01 concurrent XP milestone, B-08 transferred
-- project card, B-03 wallet re-link result. Forward-only; no historical XP rewrite.

-- B-07: quiz XP follows the threshold the learning RPC stored for this attempt
-- (default 0.7), not a hardcoded 0.8.
CREATE OR REPLACE FUNCTION private.xp_quiz_passed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.courses%ROWTYPE; l public.course_lessons%ROWTYPE;
BEGIN
  IF NEW.lesson_id IS NULL OR NEW.attempt_group_id IS NULL OR NEW.group_total IS NULL
     OR NEW.group_total < 1
     OR NEW.group_correct::numeric / NEW.group_total < COALESCE(NEW.passing_ratio, 0.7) THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.courses WHERE id = NEW.course_id;
  SELECT * INTO l FROM public.course_lessons WHERE course_id = NEW.course_id AND id = NEW.lesson_id;
  IF NOT FOUND OR NOT c.published OR c.archived_at IS NOT NULL OR NOT l.published OR l.archived_at IS NOT NULL
     OR c.instructor_id = NEW.user_id OR COALESCE(c.data->'co_instructor_permissions','{}'::jsonb) ? NEW.user_id::text
     OR l.data->>'lesson_format' <> 'quiz'
     OR NOT EXISTS(SELECT 1 FROM public.enrollments WHERE user_id=NEW.user_id AND course_id=NEW.course_id)
     THEN RETURN NEW; END IF;
  PERFORM private.xp_award(NEW.user_id,'quiz_passed','quiz_passed:'||NEW.course_id||':'||NEW.lesson_id,
    20,'quiz',NEW.course_id||':'||NEW.lesson_id,NEW.attempted_at);
  PERFORM private.xp_award(NEW.user_id,'lesson_completed','lesson_completed:'||NEW.course_id||':'||NEW.lesson_id,
    10,'lesson',NEW.course_id||':'||NEW.lesson_id,NEW.attempted_at);
  RETURN NEW;
END $$;

-- H-01: serialize per user so a concurrent award is visible to the threshold sum.
CREATE OR REPLACE FUNCTION private.feed_on_xp_awarded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE total_points bigint; previous_points bigint; milestone integer;
BEGIN
  IF new.points<=0 OR new.source='correction' OR NOT private.feed_actor_public(new.user_id) THEN RETURN new; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('feed_xp:'||new.user_id::text,0));
  SELECT coalesce(sum(points),0) INTO total_points FROM public.user_point_ledger WHERE user_id=new.user_id;
  previous_points:=total_points-new.points;
  SELECT max(x) INTO milestone FROM unnest(array[250,500,1000,2500,5000,10000,25000,50000,100000]) x
  WHERE x>previous_points AND x<=total_points;
  IF milestone IS NOT NULL THEN
    INSERT INTO public.feed_milestones(actor_id,kind,source_key,xp_total,created_at)
    VALUES(new.user_id,'xp_reached',milestone::text,milestone,coalesce(new.occurred_at,now()))
    ON CONFLICT(actor_id,kind,source_key) DO NOTHING;
  END IF;
  RETURN new;
END $$;

-- B-08: a re-submission of the same project (staff transfer) moves the existing
-- card to the current hackathon instead of leaving it on the old one.
CREATE OR REPLACE FUNCTION private.feed_on_project_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF new.project_id IS NULL OR (tg_op='UPDATE' AND old.project_id IS NOT NULL) OR NOT private.feed_actor_public(new.user_id) THEN RETURN new; END IF;
  IF EXISTS(SELECT 1 FROM public.projects p WHERE p.id=new.project_id AND p.owner_id=new.user_id AND p.source_type='hackathon' AND p.source_id=new.hackathon_id AND p.visibility='public' AND NOT coalesce(p.blocked,false))
    AND EXISTS(SELECT 1 FROM public.hackathons h WHERE h.id=new.hackathon_id AND h.status IN ('published','running')) THEN
    INSERT INTO public.feed_milestones(actor_id,kind,source_key,hackathon_id,project_id)
    VALUES(new.user_id,'project_submitted',new.project_id::text,new.hackathon_id,new.project_id)
    ON CONFLICT(actor_id,kind,source_key) DO UPDATE SET hackathon_id=EXCLUDED.hackathon_id
      WHERE public.feed_milestones.hackathon_id IS DISTINCT FROM EXCLUDED.hackathon_id;
  END IF;
  RETURN new;
END $$;

-- B-03: distinguish own-wallet re-link and foreign-owned wallet from an expired challenge.
CREATE OR REPLACE FUNCTION private.xp_consume_wallet_challenge(p_challenge_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE challenge public.wallet_link_challenges%ROWTYPE; inserted integer; awarded boolean;
BEGIN
  UPDATE public.wallet_link_challenges SET consumed_at=clock_timestamp()
  WHERE id=p_challenge_id AND user_id=p_user_id AND consumed_at IS NULL AND expires_at>clock_timestamp()
  RETURNING * INTO challenge;
  IF NOT FOUND THEN RETURN jsonb_build_object('linked',false,'awarded',false,'reason','challenge_expired'); END IF;
  INSERT INTO public.connected_wallets(user_id,chain,address)
  VALUES(challenge.user_id,challenge.chain,challenge.address) ON CONFLICT(chain,address) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 0 THEN
    IF EXISTS(SELECT 1 FROM public.connected_wallets WHERE chain=challenge.chain AND address=challenge.address AND user_id=challenge.user_id) THEN
      RETURN jsonb_build_object('linked',true,'awarded',false);
    END IF;
    RETURN jsonb_build_object('linked',false,'awarded',false,'reason','wallet_taken');
  END IF;
  awarded := private.xp_award(challenge.user_id,challenge.chain||'_wallet',challenge.chain||'_wallet',30,
    'wallet',challenge.address,clock_timestamp());
  RETURN jsonb_build_object('linked',true,'awarded',awarded);
END $$;
