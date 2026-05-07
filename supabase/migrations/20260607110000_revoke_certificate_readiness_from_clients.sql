-- Security: corelia_certificate_readiness is SECURITY DEFINER and must only run from Edge (service_role).
-- Supabase linter warns when anon/authenticated can EXECUTE via PostgREST /rpc.
-- REVOKE FROM PUBLIC alone may leave direct grants on anon/authenticated.

REVOKE ALL ON FUNCTION public.corelia_certificate_readiness(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.corelia_certificate_readiness(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.corelia_certificate_readiness(text, uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.corelia_certificate_readiness(text, uuid) TO service_role;
