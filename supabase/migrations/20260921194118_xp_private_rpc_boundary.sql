-- Keep XP authorization and atomic writes in the unexposed private schema.
-- Public RPC contracts remain unchanged through caller-privileged wrappers.
GRANT USAGE ON SCHEMA private TO anon,authenticated,service_role;

ALTER FUNCTION public.xp_link_verified_ocid(uuid,text,text) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.xp_link_verified_ocid(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.xp_link_verified_ocid(uuid,text,text) TO service_role;
CREATE FUNCTION public.xp_link_verified_ocid(p_user_id uuid,p_ocid text,p_eth_address text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.xp_link_verified_ocid(p_user_id,p_ocid,p_eth_address);
$$;
REVOKE ALL ON FUNCTION public.xp_link_verified_ocid(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.xp_link_verified_ocid(uuid,text,text) TO service_role;

ALTER FUNCTION public.xp_unlink_ocid() SET SCHEMA private;
REVOKE ALL ON FUNCTION private.xp_unlink_ocid() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.xp_unlink_ocid() TO authenticated;
CREATE FUNCTION public.xp_unlink_ocid()
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.xp_unlink_ocid();
$$;
REVOKE ALL ON FUNCTION public.xp_unlink_ocid() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.xp_unlink_ocid() TO authenticated;

ALTER FUNCTION public.xp_toggle_project_heart(uuid) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.xp_toggle_project_heart(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.xp_toggle_project_heart(uuid) TO authenticated;
CREATE FUNCTION public.xp_toggle_project_heart(p_project_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.xp_toggle_project_heart(p_project_id);
$$;
REVOKE ALL ON FUNCTION public.xp_toggle_project_heart(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.xp_toggle_project_heart(uuid) TO authenticated;

ALTER FUNCTION public.xp_sync_connections() SET SCHEMA private;
REVOKE ALL ON FUNCTION private.xp_sync_connections() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.xp_sync_connections() TO authenticated;
CREATE FUNCTION public.xp_sync_connections()
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.xp_sync_connections();
$$;
REVOKE ALL ON FUNCTION public.xp_sync_connections() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.xp_sync_connections() TO authenticated;

ALTER FUNCTION public.xp_summary(uuid,date,date) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.xp_summary(uuid,date,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.xp_summary(uuid,date,date) TO anon,authenticated;
CREATE FUNCTION public.xp_summary(p_user_id uuid,p_from date DEFAULT NULL,p_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.xp_summary(p_user_id,p_from,p_to);
$$;
REVOKE ALL ON FUNCTION public.xp_summary(uuid,date,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.xp_summary(uuid,date,date) TO anon,authenticated;

ALTER FUNCTION public.xp_totals(uuid[]) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.xp_totals(uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.xp_totals(uuid[]) TO anon,authenticated;
CREATE FUNCTION public.xp_totals(p_user_ids uuid[])
RETURNS TABLE(user_id uuid,total_xp bigint) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM private.xp_totals(p_user_ids);
$$;
REVOKE ALL ON FUNCTION public.xp_totals(uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.xp_totals(uuid[]) TO anon,authenticated;

ALTER FUNCTION public.xp_day_breakdown(date) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.xp_day_breakdown(date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.xp_day_breakdown(date) TO authenticated;
CREATE FUNCTION public.xp_day_breakdown(p_day date)
RETURNS TABLE(source text,xp bigint) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM private.xp_day_breakdown(p_day);
$$;
REVOKE ALL ON FUNCTION public.xp_day_breakdown(date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.xp_day_breakdown(date) TO authenticated;

ALTER FUNCTION public.xp_consume_wallet_challenge(uuid,uuid) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.xp_consume_wallet_challenge(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.xp_consume_wallet_challenge(uuid,uuid) TO service_role;
CREATE FUNCTION public.xp_consume_wallet_challenge(p_challenge_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.xp_consume_wallet_challenge(p_challenge_id,p_user_id);
$$;
REVOKE ALL ON FUNCTION public.xp_consume_wallet_challenge(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.xp_consume_wallet_challenge(uuid,uuid) TO service_role;

ALTER FUNCTION public.xp_reverse_award(uuid,text) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.xp_reverse_award(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.xp_reverse_award(uuid,text) TO service_role;
CREATE FUNCTION public.xp_reverse_award(p_award_id uuid,p_reason text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.xp_reverse_award(p_award_id,p_reason);
$$;
REVOKE ALL ON FUNCTION public.xp_reverse_award(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.xp_reverse_award(uuid,text) TO service_role;
