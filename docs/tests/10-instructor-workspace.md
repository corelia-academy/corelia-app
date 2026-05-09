# 10 — Instructor workspace (`/instructor/*`)

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ RequireRole `instructorWorkspace`: khóa học, career tracks, partner finance, profile workspace.

## Gate

- [`RequireRole`](../../src/components/auth/RequireRole.tsx) với [`ROLE_GROUPS.instructorWorkspace`](../../src/config/roles.ts) = `instructor`, `support_staff`, `admin`.
- User **`student`** không vào được → redirect `/`.

## Tiền đề staging

- **Instructor_1** có quyền; có thể cần approve instructor (origin) theo policy — seed hoặc Admin.

## Tài khoản cần dùng

- **Instructor_1** — luồng chính.
- **Support_1** hoặc **Admin_1** — xác nhận cùng quyền vào workspace (smoke).
- **Student_1** — negative test.

## Checklist

### Negative

1. **Student_1**: mở `/instructor/courses` — redirect về `/` (hoặc fallback đã định nghĩa).

### Courses

2. **Instructor_1**: `/instructor/courses` — danh sách khóa của mình.
3. `/instructor/courses/new` — form tạo khóa; lưu nháp/submit.
4. `/instructor/courses/:id/edit` — với `id` seed — chỉnh và lưu.

### Career tracks

5. `/instructor/career-tracks` — list.
6. `/instructor/career-tracks/new` và `/instructor/career-tracks/:id/edit` — flow CRUD cơ bản.

### Partner finance

7. `/instructor/contracts`, `/instructor/invoices`, `/instructor/payments` — trang load; upload/list theo UI (có thể empty).

### Profile workspace

8. `/instructor/profile` — đồng bộ với account instructor nếu applicable.

### Redirect legacy cohorts

9. `/instructor/cohorts*` redirect về `/instructor/courses`.

### Admin-only shortcut

10. **Student_1** không được vào `/instructor/instructors`. **Admin/Support**: route có thể redirect `/admin/instructors` — smoke ([App.tsx](../../src/App.tsx)).

## Kết quả mong đợi

- Instructor thấy đủ workspace; student bị chặn nhất quán.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
