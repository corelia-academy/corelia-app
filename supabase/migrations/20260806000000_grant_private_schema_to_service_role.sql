-- Fix: service_role thiếu USAGE trên schema private, khiến mọi RPC gọi qua
-- wrapper public.* -> private.* từ Edge Function (service_role client) bị chặn
-- bởi Postgres ở bước name-resolution, TRƯỚC CẢ khi chạm quyền GRANT EXECUTE
-- trên hàm đích. Không liên quan RLS: đây là ACL cấp schema.
--
-- Root cause: 20260506071954_tighten_rls_and_lockdown_functions.sql:37 chỉ
-- GRANT USAGE ON SCHEMA private cho anon, authenticated khi tạo schema
-- private — bỏ sót service_role. Từ đó tới nay, mọi hàm private.* mới thêm
-- dành cho service_role (vd 20260804000000_certificate_public_verification.sql:
-- private.corelia_verify_certificate) đều bị lỗi "permission denied for
-- schema private" khi gọi trực tiếp bằng service_role, dù đã GRANT EXECUTE
-- đúng trên hàm.
--
-- Không sửa lại migration 20260506071954 (đã apply, checksum đã lưu trong
-- supabase_migrations.schema_migrations) — vá bằng migration mới, idempotent.

GRANT USAGE ON SCHEMA private TO service_role;
