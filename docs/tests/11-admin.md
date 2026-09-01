# 11 — Admin (`/admin/*`)

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ `/admin` (index users), `/admin/instructors`, `/admin/instructors/:id`, `/admin/activity-milestones` và `/admin/hackathons`.

## Gate & role

- [`RequireRole`](../../src/components/auth/RequireRole.tsx) với [`ROLE_GROUPS.admin`](../../src/config/roles.ts) = **`admin`** và **`support_staff`**.
- **Cả hai role đều được vào `/admin`** và các route con trong layout admin.
- **Khuyến nghị QA:** smoke ít nhất **một** tài khoản (`admin` **hoặc** `support_staff`). Nếu policy nghiệp vụ khác nhau (audit, PII), chạy **song song** hai account và so sánh UI/API errors.

## Tiền đề staging

- Tài khoản **Admin_1** (`role = admin`) và/hoặc **Support_1** (`role = support_staff`) đã được gán trong bảng `profiles` trên **staging**.

## Tài khoản cần dùng

- **Admin_1** và/hoặc **Support_1**
- **Student_1** / **Instructor_1** — negative

## Checklist

### Negative

1. **Student_1**: `/admin` — redirect `/` (fallback mặc định RequireRole).
2. **Instructor_1** (nếu không đồng thời admin/support): `/admin` — bị chặn.

### Positive

3. **Admin_1** hoặc **Support_1**: `/admin` — danh sách users ([AdminUsers](../../src/pages/admin/AdminUsers.tsx)) load.
4. `/admin/dashboard` — pinned programs / widgets không lỗi profile ([STAGING_BUILD_VERIFY.md](../STAGING_BUILD_VERIFY.md)).
5. `/admin/instructors` — danh sách.
6. `/admin/instructors/:id` — chi tiết một instructor seed.
7. `/admin/activity-milestones` — trang load; danh sách / form milestone không crash (empty state hợp lý nếu chưa seed).
8. `/admin/hackathons` — danh sách load; tạo mới và mở editor được.
9. `/admin/hackathons/:id/edit` — sidebar, VI/EN, lưu section, publish/end và winner hoạt động theo [checklist Hackathon](../hackathon/acceptance-checklist.md).

### Đổi role (nếu UI cho phép)

10. Từ admin users, thử đổi role test user staging (chỉ user test) — xác nhận sau khi đổi, user vào đúng/không vào đúng khu vực ([README matrix](./README.md)).

### Route không tồn tại

11. `/hackathons/manage`, `/hackathons/new` và `/hackathons/:slug/manage/*` — NotFound; editor hợp lệ chỉ nằm trong `/admin/hackathons`.

## Kết quả mong đợi

- Chỉ admin/support_staff truy cập admin layout; instructor/student không bypass.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
