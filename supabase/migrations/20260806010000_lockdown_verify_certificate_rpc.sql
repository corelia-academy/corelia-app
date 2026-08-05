-- Security: corelia_verify_certificate is SECURITY DEFINER and must only run from Edge (service_role).
-- Supabase default privileges grant EXECUTE to anon/authenticated on new public functions.
-- REVOKE FROM PUBLIC alone leaves direct grants on anon/authenticated (see 20260607110000).
--
-- pg_proc.proacl xác nhận thực tế: public.corelia_verify_certificate hiện là
-- {postgres=X, anon=X, authenticated=X, service_role=X} dù migration gốc
-- (20260804000000:288) đã REVOKE ALL ... FROM PUBLIC — vì lệnh đó chỉ gỡ quyền
-- của pseudo-role PUBLIC, không đụng tới quyền Supabase default-privilege đã
-- cấp trực tiếp cho anon/authenticated lúc tạo function. Kết quả: anon gọi
-- thẳng được /rest/v1/rpc/corelia_verify_certificate, bỏ qua throttle/log ở
-- Edge Function certificates.verify.

REVOKE ALL ON FUNCTION public.corelia_verify_certificate(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.corelia_verify_certificate(text) FROM anon;
REVOKE ALL ON FUNCTION public.corelia_verify_certificate(text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.corelia_verify_certificate(text) TO service_role;
