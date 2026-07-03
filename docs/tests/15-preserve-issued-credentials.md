# Preserve issued OCA/OCB credentials

## Mục tiêu

Xác nhận OCA/OCB đã cấp vẫn tồn tại và hiển thị sau khi course, hackathon hoặc credential template nguồn bị xóa.

## Điều kiện trước khi kiểm thử

- Apply migration `20260701154437_preserve_issued_credentials.sql` trên Staging.
- Có một Admin/Instructor, Learner A và Learner B.
- Learner A đã kết nối OCID.
- Ghi lại ID của course, hackathon, template và issuance dùng trong từng case.

## Case 1: Xóa course sau khi cấp OCA

1. Tạo course có OCA template hợp lệ.
2. Cho Learner A hoàn thành course và mint OCA.
3. Xác nhận `credential_issuances.display_snapshot` có title, image, scope và course metadata.
4. Xóa course.
5. Kiểm tra Database:
   - `credential_templates` vẫn tồn tại và `course_id IS NULL`.
   - `credential_issuances` vẫn tồn tại và `course_id IS NULL`.
   - `template_id` vẫn trỏ đến template còn tồn tại.
6. Mở Achievements của Learner A.

Kết quả mong đợi: OCA vẫn hiển thị bằng snapshot/template, modal không crash và link Open Campus vẫn hoạt động.

## Case 2: Xóa course sau khi cấp course OCB

1. Tạo course có OCB template.
2. Cấp và mint badge cho Learner A.
3. Xóa course.
4. Mở Achievements và User Profile Achievements của Learner A.

Kết quả mong đợi: OCB vẫn hiển thị; title, image, achievement type và Open Campus ID không bị mất.

## Case 3: Xóa hackathon sau khi cấp OCB

1. Tạo hackathon và OCB template có `hackathon_role`.
2. Cấp và mint badge cho Learner A.
3. Xóa hackathon.
4. Kiểm tra template và issuance đều có `hackathon_id IS NULL` nhưng không bị xóa.
5. Mở Achievements của Learner A.

Kết quả mong đợi: OCB vẫn hiển thị bằng snapshot và link Open Campus vẫn hoạt động.

## Case 4: Xóa template sau khi issuance đã được mint

1. Chọn một issuance đã mint và xác nhận snapshot không rỗng.
2. Xóa credential template nguồn bằng tài khoản có quyền.
3. Kiểm tra issuance vẫn tồn tại và `template_id IS NULL`.
4. Tải lại Achievements.

Kết quả mong đợi: frontend dựng credential từ `display_snapshot`; không có lỗi nested relation hoặc lỗi null.

## Case 5: RLS giữa hai learner

1. Đăng nhập Learner A và truy vấn issuance của chính mình.
2. Dùng session của Learner A truy vấn issuance thuộc Learner B.

Kết quả mong đợi: Learner A đọc được issuance của mình và không đọc được issuance của Learner B, kể cả khi source IDs đều null.

## Case 6: Constraint Hackathon

Thử tạo template với `scope_type = 'hackathon'` nhưng `hackathon_role IS NULL`.

Kết quả mong đợi: Database từ chối bởi `credential_templates_scope_consistency`.

## Case 7: Dữ liệu và migration cũ

1. Trước khi apply, kiểm tra có hackathon template nào thiếu role hay không.
2. Apply migration trên bản sao Staging có đầy đủ migration history.
3. Xác nhận issuance cũ còn tồn tại và snapshot đã được backfill.
4. Chạy lại lệnh kiểm tra migration history để bảo đảm migration không bị bỏ qua do thứ tự timestamp.

Kết quả mong đợi: migration chạy một lần, không trùng tên constraint và không xóa dữ liệu cũ.

## Truy vấn kiểm tra nhanh

```sql
select
  id,
  template_id,
  user_id,
  course_id,
  hackathon_id,
  status,
  minted_at,
  display_snapshot
from public.credential_issuances
where id = '<issuance-id>';
```

```sql
select
  id,
  scope_type,
  course_id,
  hackathon_id,
  hackathon_role
from public.credential_templates
where id = '<template-id>';
```

## Giới hạn

Issuance/template đã bị `ON DELETE CASCADE` xóa trước khi migration được apply không thể tự phục hồi. Trường hợp đó cần restore từ backup hoặc đồng bộ có kiểm soát từ Open Campus.
