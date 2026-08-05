-- Bổ sung toạ độ bố cục chứng nhận vào RPC xác minh.
--
-- Giảng viên giờ chỉnh được vị trí/kích thước của khối footer ("Date of Issue" +
-- "Certificate ID") và của mã QR, cùng cỡ chữ tên học viên — lưu trong courses.data.
--
-- VÌ SAO phải sửa RPC: trang /verify KHÔNG hiển thị file
-- cdn/certificates/{userId}/{courseId}.png (file đó do chính học viên upload nên
-- không đáng tin) mà VẼ LẠI tờ chứng nhận từ dữ liệu RPC trả về. Thiếu một key ở đây
-- là trang verify âm thầm vẽ ở giá trị mặc định và lệch với đúng tờ PDF/PNG mà học
-- viên đã tải về — đúng thứ mà danh sách key tường minh này sinh ra để ngăn.
--
-- Chỉ thay thân hàm `private`. Chữ ký `public.corelia_verify_certificate` không đổi
-- và CREATE OR REPLACE giữ nguyên ACL, nên KHÔNG chạy lại khối REVOKE/GRANT của
-- 20260804000000.

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
     ORDER BY x.minted_at DESC NULLS LAST LIMIT 1
  ) ci ON true
  WHERE r.code = v_norm;

  RETURN coalesce(v_out, json_build_object('status', 'not_found'));
END;
$$;
