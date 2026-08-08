-- Xác minh chứng nhận công khai.
--
-- VÌ SAO: chứng nhận hiện không có định danh công khai nào — nhà tuyển dụng cầm tờ
-- chứng nhận Corelia không kiểm chứng được.
--
-- Mã xác minh KHÔNG đặt trên public.enrollments. Lúc thiết kế, policy
-- enrollments_select_public_certificates (20260702214400) còn cho anon SELECT TOÀN BỘ
-- dòng ở mọi enrollment có certificate_issued_at, nên đặt mã ở đó là để lộ sạch mã cho
-- bất kỳ ai. Policy đó đã được gỡ ngay sau migration này (20260804010000), nhưng lựa
-- chọn vẫn giữ nguyên và giờ là con đường duy nhất: enrollments không còn bất kỳ đường
-- đọc anon nào, mà xác minh thì bắt buộc phải công khai.
--
-- Nên: bảng riêng public.certificate_records, KHÔNG có policy anon SELECT. Đọc công
-- khai chỉ qua private.corelia_verify_certificate(), hàm này trả về field hiển thị và
-- không bao giờ trả user_id hay email (cùng quy tắc với credentials/claim_lookup.ts).
--
-- Snapshot (holder_name / course_title / instructor_name) đóng băng lúc cấp để trang
-- verify luôn khớp tờ giấy đã in kể cả sau khi đổi tên. course_id là ON DELETE SET NULL
-- vì xác minh phải sống lâu hơn khoá học (lưu ý enrollments.course_id là ON DELETE
-- CASCADE nên dòng enrollment sẽ biến mất theo).
--
-- Sinh mã bằng TRIGGER trên enrollments, theo đúng hình dạng của
-- private.emit_activity_on_course_completion() (20260702010000), để bao phủ cả các
-- script seed và mọi đường ghi trong tương lai — không chỉ edge function.
--
-- Gỡ certificate_issued_at về NULL KHÔNG xoá bản ghi; dùng op certificates.revoke.

BEGIN;

-- ── 1) Bảng ────────────────────────────────────────────────────────────────────
CREATE TABLE public.certificate_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id text REFERENCES public.courses (id) ON DELETE SET NULL,

  -- Snapshot bất biến, chụp lúc cấp.
  holder_name text,
  course_title text,
  instructor_name text,

  issued_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT certificate_records_code_key UNIQUE (code),
  CONSTRAINT certificate_records_user_course_key UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS certificate_records_user_idx ON public.certificate_records (user_id);
CREATE INDEX IF NOT EXISTS certificate_records_course_idx ON public.certificate_records (course_id);

ALTER TABLE public.certificate_records ENABLE ROW LEVEL SECURITY;

-- ── 2) RLS — cố ý KHÔNG có policy anon. Đọc công khai chỉ qua RPC. ─────────────
DROP POLICY IF EXISTS certificate_records_select_own ON public.certificate_records;
CREATE POLICY certificate_records_select_own
  ON public.certificate_records FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS certificate_records_all_staff ON public.certificate_records;
CREATE POLICY certificate_records_all_staff
  ON public.certificate_records FOR ALL
  TO authenticated
  USING (public.is_admin_or_support())
  WITH CHECK (public.is_admin_or_support());

REVOKE INSERT, UPDATE, DELETE ON public.certificate_records FROM anon, authenticated;
GRANT SELECT ON public.certificate_records TO authenticated;

-- ── 3) Sinh mã — Crockford base32, 10 ký tự = 50 bit, tiền tố CRL- ────────────
--     Bảng chữ bỏ I, L, O, U. 256 % 32 == 0 nên byte % 32 không lệch modulo.
CREATE OR REPLACE FUNCTION private.generate_certificate_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public, private, extensions
AS $$
DECLARE
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(10);
  v_out text := '';
  i int;
BEGIN
  FOR i IN 0..9 LOOP
    v_out := v_out || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  END LOOP;
  RETURN 'CRL-' || v_out;
END;
$$;

-- ── 4) Chuẩn hoá input — soi gương bản TS ở certificates/code.ts ──────────────
--     Crockford: O -> 0, I/L -> 1. An toàn vì generator không bao giờ sinh I/L/O/U.
CREATE OR REPLACE FUNCTION private.normalize_certificate_code(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, private
AS $$
DECLARE
  v text;
BEGIN
  IF p_raw IS NULL THEN RETURN NULL; END IF;
  v := upper(btrim(p_raw));
  v := regexp_replace(v, '^CRL[-_ ]*', '');
  v := regexp_replace(v, '[^0-9A-Z]', '', 'g');
  v := translate(v, 'OIL', '011');
  IF v !~ '^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$' THEN RETURN NULL; END IF;
  RETURN 'CRL-' || v;
END;
$$;

-- ── 5) Thân cấp phát dùng chung cho CẢ trigger LẪN backfill ───────────────────
CREATE OR REPLACE FUNCTION private.ensure_certificate_record(
  p_user_id uuid, p_course_id text, p_issued_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_code text; v_existing text;
  v_holder_name text; v_course_title text; v_instructor_name text;
  v_instructor_id uuid; v_constraint text; v_attempt int := 0;
BEGIN
  IF p_user_id IS NULL OR p_course_id IS NULL THEN RETURN NULL; END IF;

  SELECT r.code INTO v_existing FROM public.certificate_records r
   WHERE r.user_id = p_user_id AND r.course_id = p_course_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  SELECT nullif(btrim(coalesce(p.full_name, '')), '') INTO v_holder_name
    FROM public.profiles p WHERE p.id = p_user_id;

  SELECT nullif(btrim(coalesce(c.data->>'title', '')), ''),
         nullif(btrim(coalesce(c.data->>'instructor_name', '')), ''),
         c.instructor_id
    INTO v_course_title, v_instructor_name, v_instructor_id
    FROM public.courses c WHERE c.id = p_course_id;

  -- Khoá học không ghi tên giảng viên thì lấy từ profile chủ khoá.
  IF v_instructor_name IS NULL AND v_instructor_id IS NOT NULL THEN
    SELECT nullif(btrim(coalesce(p.full_name, '')), '') INTO v_instructor_name
      FROM public.profiles p WHERE p.id = v_instructor_id;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := private.generate_certificate_code();
    BEGIN
      INSERT INTO public.certificate_records (
        code, user_id, course_id, holder_name, course_title, instructor_name, issued_at
      ) VALUES (
        v_code, p_user_id, p_course_id,
        v_holder_name, v_course_title, v_instructor_name, coalesce(p_issued_at, now())
      );
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint = 'certificate_records_user_course_key' THEN
        -- Một lượt cấp song song cho cùng học viên+khoá đã thắng race.
        SELECT r.code INTO v_existing FROM public.certificate_records r
         WHERE r.user_id = p_user_id AND r.course_id = p_course_id;
        RETURN v_existing;
      END IF;
      -- Còn lại là đụng mã (p ~ 1e-15 mỗi lần): thử lại.
      IF v_attempt >= 5 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

-- ── 6) Trigger trên enrollments ───────────────────────────────────────────────
--     Cùng guard với private.emit_activity_on_course_completion (20260702010000).
CREATE OR REPLACE FUNCTION private.issue_certificate_record_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.certificate_issued_at IS NOT NULL
    AND (TG_OP = 'INSERT' OR OLD.certificate_issued_at IS NULL)
  THEN
    PERFORM private.ensure_certificate_record(NEW.user_id, NEW.course_id, NEW.certificate_issued_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_certificate_record_issue ON public.enrollments;
CREATE TRIGGER trg_certificate_record_issue
  AFTER INSERT OR UPDATE OF certificate_issued_at ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION private.issue_certificate_record_on_completion();

-- ── 7) Vá holder_name một lần ─────────────────────────────────────────────────
--     Nhiều học viên có profiles.full_name rỗng lúc cấp. Tờ chứng nhận in ra lại
--     render full_name TRỰC TIẾP, nên nếu không có bước này thì trang verify sẽ
--     trống tên trong khi tờ giấy có tên. Chỉ điền vào chỗ trống, không ghi đè.
CREATE OR REPLACE FUNCTION private.fill_missing_certificate_holder_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF nullif(btrim(coalesce(NEW.full_name, '')), '') IS NULL THEN RETURN NEW; END IF;
  UPDATE public.certificate_records
     SET holder_name = btrim(NEW.full_name)
   WHERE user_id = NEW.id AND holder_name IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_certificate_records_fill_holder_name ON public.profiles;
CREATE TRIGGER trg_certificate_records_fill_holder_name
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.fill_missing_certificate_holder_name();

-- ── 8) RPC xác minh — thân DEFINER ở private + wrapper INVOKER ở public ───────
--     (pattern nhà: 20260709000002_definer_rpc_private_wrappers.sql)
CREATE OR REPLACE FUNCTION private.corelia_verify_certificate(p_code text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE v_norm text; v_out json;
BEGIN
  v_norm := private.normalize_certificate_code(p_code);
  IF v_norm IS NULL THEN RETURN json_build_object('status', 'not_found'); END IF;

  SELECT json_build_object(
    'status',          CASE WHEN r.revoked_at IS NOT NULL THEN 'revoked' ELSE 'valid' END,
    'code',            r.code,
    'holder_name',     r.holder_name,
    'course_title',    r.course_title,
    'instructor_name', r.instructor_name,
    'issued_at',       r.issued_at,
    'revoked_at',      r.revoked_at,
    'revoked_reason',  r.revoked_reason,
    -- Chỉ link ra ngoài khi đích thực sự công khai.
    'course_path',     CASE WHEN c.published THEN '/courses/' || c.id END,
    'holder_path',     CASE WHEN pp.id IS NOT NULL
                             AND nullif(btrim(coalesce(pp.username, '')), '') IS NOT NULL
                        THEN '/@' || pp.username END,
    -- Template + toạ độ tên để trang verify VẼ LẠI từ dữ liệu đáng tin.
    -- File cdn/certificates/*.png do học viên tự upload nên KHÔNG dùng được.
    'certificate_template_url',   c.data->>'certificate_template_url',
    'certificate_name_x_percent', (c.data->>'certificate_name_x_percent')::numeric,
    'certificate_name_y_percent', (c.data->>'certificate_name_y_percent')::numeric,
    'certificate_name_color',     c.data->>'certificate_name_color',
    'oc_credential_id',           ci.oc_credential_id
  ) INTO v_out
  FROM public.certificate_records r
  LEFT JOIN public.courses c ON c.id = r.course_id
  LEFT JOIN public.public_profiles pp ON pp.id = r.user_id AND pp.profile_public = true
  LEFT JOIN LATERAL (
    SELECT x.oc_credential_id FROM public.credential_issuances x
     WHERE x.user_id = r.user_id AND x.course_id = r.course_id
       AND x.status = 'minted' AND x.oc_credential_id IS NOT NULL
     ORDER BY x.minted_at DESC NULLS LAST LIMIT 1
  ) ci ON true
  WHERE r.code = v_norm;

  RETURN coalesce(v_out, json_build_object('status', 'not_found'));
END;
$$;

CREATE OR REPLACE FUNCTION public.corelia_verify_certificate(p_code text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.corelia_verify_certificate(p_code); $$;

-- CHỆCH CÓ CHỦ Ý khỏi grant `TO anon, authenticated` thường dùng: đây là lookup công
-- khai brute-force được, nên chỉ cho gọi qua op certificates.verify của corelia-api
-- (service role) — nơi đặt throttle và log. Grant cho anon sẽ biến chốt chặn ở edge
-- thành vô nghĩa vì ai cũng gọi thẳng /rest/v1/rpc được.
REVOKE ALL ON FUNCTION private.corelia_verify_certificate(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.corelia_verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.corelia_verify_certificate(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.corelia_verify_certificate(text) TO service_role;

REVOKE ALL ON FUNCTION private.generate_certificate_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.normalize_certificate_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.ensure_certificate_record(uuid, text, timestamptz) FROM PUBLIC;

-- ── 9) Backfill mọi chứng nhận đã cấp ────────────────────────────────────────
DO $backfill$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT e.user_id, e.course_id, e.certificate_issued_at
      FROM public.enrollments e
     WHERE e.certificate_issued_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.certificate_records cr
                        WHERE cr.user_id = e.user_id AND cr.course_id = e.course_id)
     ORDER BY e.certificate_issued_at
  LOOP
    PERFORM private.ensure_certificate_record(r.user_id, r.course_id, r.certificate_issued_at);
  END LOOP;
END;
$backfill$;

COMMIT;
