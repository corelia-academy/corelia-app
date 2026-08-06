-- Security: /verify lộ oc_credential_id (và link "Xem trên Open Campus") bất kể
-- credential_issuances.show_on_profile — cột này chính là cơ chế chủ tài khoản tự
-- chọn credential nào công khai (xem comment ở 20260727031028_profile_occ_visibility.sql
-- và RLS credential_issuances_select_public_profile ở đó, đòi show_on_profile = true).
-- RPC verify là SECURITY DEFINER nên bỏ qua RLS đó hoàn toàn — chỉ lọc theo
-- status='minted', không lọc show_on_profile.
--
-- Xác nhận trên data thật (corelia-staging): 13/17 credential đã mint đang có
-- show_on_profile=false nhưng /verify vẫn trả oc_credential_id cho cả 13 cái, và
-- openCampusCredentialExplorerUrl(id) không cần username vẫn tạo được link thật
-- (?id=... trên id.opencampus.xyz) — không phải ID chết, click được thật.
--
-- Chỉ thêm 1 điều kiện AND vào LATERAL join. Không đổi field nào khác, không đổi
-- chữ ký. CREATE OR REPLACE giữ nguyên ACL (đã REVOKE anon/authenticated ở
-- 20260806010000), không cần chạy lại khối GRANT/REVOKE.

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
    -- Template + toàn bộ toạ độ bố cục để trang verify VẼ LẠI từ dữ liệu đáng tin.
    -- File cdn/certificates/*.png do học viên tự upload nên KHÔNG dùng được.
    -- Giá trị NULL là bình thường: certificateLayout() phía client áp mặc định và
    -- kẹp biên — đây cũng là tuyến phòng thủ duy nhất vì courses.data không hề có
    -- validation phía server.
    'certificate_template_url',       c.data->>'certificate_template_url',
    'certificate_name_x_percent',     (c.data->>'certificate_name_x_percent')::numeric,
    'certificate_name_y_percent',     (c.data->>'certificate_name_y_percent')::numeric,
    'certificate_name_size_percent',  (c.data->>'certificate_name_size_percent')::numeric,
    'certificate_name_color',         c.data->>'certificate_name_color',
    'certificate_footer_x_percent',   (c.data->>'certificate_footer_x_percent')::numeric,
    'certificate_footer_y_percent',   (c.data->>'certificate_footer_y_percent')::numeric,
    'certificate_footer_size_percent',(c.data->>'certificate_footer_size_percent')::numeric,
    'certificate_footer_color',       c.data->>'certificate_footer_color',
    'certificate_qr_x_percent',       (c.data->>'certificate_qr_x_percent')::numeric,
    'certificate_qr_y_percent',       (c.data->>'certificate_qr_y_percent')::numeric,
    'certificate_qr_size_percent',    (c.data->>'certificate_qr_size_percent')::numeric,
    'oc_credential_id',               ci.oc_credential_id
  ) INTO v_out
  FROM public.certificate_records r
  LEFT JOIN public.courses c ON c.id = r.course_id
  LEFT JOIN public.public_profiles pp ON pp.id = r.user_id AND pp.profile_public = true
  LEFT JOIN LATERAL (
    SELECT x.oc_credential_id FROM public.credential_issuances x
     WHERE x.user_id = r.user_id AND x.course_id = r.course_id
       AND x.status = 'minted' AND x.oc_credential_id IS NOT NULL
       AND x.show_on_profile = true
     ORDER BY x.minted_at DESC NULLS LAST LIMIT 1
  ) ci ON true
  WHERE r.code = v_norm;

  RETURN coalesce(v_out, json_build_object('status', 'not_found'));
END;
$$;
