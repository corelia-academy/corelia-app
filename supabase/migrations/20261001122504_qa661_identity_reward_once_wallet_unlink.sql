-- QA #661 B-02 / B-10: wallet unlink, and one connection reward per external identity.
-- The seen table survives unlink and account deletion, so an identity cannot be
-- rewarded again by moving between accounts. XP already granted is never reversed.

CREATE TABLE private.xp_identity_reward_seen (
  kind text NOT NULL CHECK (kind IN ('ocid','github','ethereum','solana')),
  identity text NOT NULL,
  user_id uuid NOT NULL,
  rewarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, identity)
);
REVOKE ALL ON private.xp_identity_reward_seen FROM PUBLIC,anon,authenticated,service_role;

-- Identities that already produced a reward before this migration.
INSERT INTO private.xp_identity_reward_seen(kind,identity,user_id)
SELECT 'ocid',v.ocid,v.user_id FROM public.xp_verified_ocid v
JOIN public.user_point_ledger l ON l.user_id=v.user_id AND l.source_key='ocid_connected'
ON CONFLICT DO NOTHING;
INSERT INTO private.xp_identity_reward_seen(kind,identity,user_id)
SELECT w.chain,w.address,w.user_id FROM public.connected_wallets w
JOIN public.user_point_ledger l ON l.user_id=w.user_id AND l.source_key=w.chain||'_wallet'
ON CONFLICT DO NOTHING;
INSERT INTO private.xp_identity_reward_seen(kind,identity,user_id)
SELECT 'github',i.provider_id,i.user_id FROM auth.identities i
JOIN public.user_point_ledger l ON l.user_id=i.user_id AND l.source_key='github_connected'
WHERE i.provider='github'
ON CONFLICT DO NOTHING;

-- Awards at most once per (kind, identity) and once per user source key.
CREATE FUNCTION private.xp_award_identity_once(p_user uuid, p_kind text, p_identity text,
  p_source text, p_points integer, p_source_type text, p_source_ref text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE inserted integer; awarded boolean;
BEGIN
  INSERT INTO private.xp_identity_reward_seen(kind,identity,user_id) VALUES(p_kind,p_identity,p_user)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 0 THEN RETURN false; END IF;
  awarded := private.xp_award(p_user,p_source,p_source,p_points,p_source_type,p_source_ref,clock_timestamp());
  IF NOT awarded THEN
    DELETE FROM private.xp_identity_reward_seen WHERE kind=p_kind AND identity=p_identity;
  END IF;
  RETURN awarded;
END $$;
REVOKE ALL ON FUNCTION private.xp_award_identity_once(uuid,text,text,text,integer,text,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.xp_link_verified_ocid(p_user_id uuid,p_ocid text,p_eth_address text)
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
  RETURN private.xp_award_identity_once(p_user_id,'ocid',btrim(p_ocid),'ocid_connected',50,'identity','ocid');
END $$;

CREATE OR REPLACE FUNCTION private.xp_sync_connections() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); v_ocid text; v_github text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT ocid INTO v_ocid FROM public.xp_verified_ocid WHERE user_id=u;
  IF v_ocid IS NOT NULL THEN
    PERFORM private.xp_award_identity_once(u,'ocid',v_ocid,'ocid_connected',50,'identity','ocid');
  END IF;
  SELECT provider_id INTO v_github FROM auth.identities WHERE user_id=u AND provider='github' LIMIT 1;
  IF v_github IS NOT NULL THEN
    PERFORM private.xp_award_identity_once(u,'github',v_github,'github_connected',50,'identity','github');
  END IF;
END $$;

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
  awarded := private.xp_award_identity_once(challenge.user_id,challenge.chain,challenge.address,
    challenge.chain||'_wallet',30,'wallet',challenge.address);
  RETURN jsonb_build_object('linked',true,'awarded',awarded);
END $$;

-- B-02: the owner can unlink a wallet; XP already granted is kept.
CREATE FUNCTION private.xp_unlink_wallet(p_chain text, p_address text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  DELETE FROM public.connected_wallets WHERE user_id=u AND chain=p_chain AND address=p_address;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION private.xp_unlink_wallet(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.xp_unlink_wallet(text,text) TO authenticated;
CREATE FUNCTION public.xp_unlink_wallet(p_chain text, p_address text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.xp_unlink_wallet(p_chain,p_address);
$$;
REVOKE ALL ON FUNCTION public.xp_unlink_wallet(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.xp_unlink_wallet(text,text) TO authenticated;
