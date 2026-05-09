# 09 — Hackathons — quản lý & workspace

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ `/hackathons/manage`, `/hackathons/new`, và `/hackathons/:slug/manage/:section` (workspace organizer).

## Gate quyền (code)

- [`RequireContestManager`](../../src/components/auth/RequireContestManager.tsx) cho phép:
  - User có `profiles.role` thuộc **instructor workspace**: `instructor`, `support_staff`, `admin` (xem [`ROLE_GROUPS.instructorWorkspace`](../../src/config/roles.ts)).
  - **Hoặc** user đã login có **email** xuất hiện trong **`co_organizer_emails`** của ít nhất một contest trên DB (hàm `hasHackathonCoOrganizerAccess`).
- Workspace `/hackathons/:slug/manage/*` bọc `RequireAuth`; quyền chi tiết từng section có thể phụ thuộc contest + email (judge, reviewer, …) — logic scoped xem [`permissions.ts`](../../src/lib/permissions.ts).

## Tiền đề staging

- Contest seed có `slug` đã biết.
- Tài khoản **Scoped_coorganizer**: email đã được gán vào `co_organizer_emails` của contest đó (staging).

## Tài khoản cần dùng

| Account | Mục đích |
|---------|----------|
| **Instructor_1** | `/hackathons/manage`, `/hackathons/new`, manage đầy đủ |
| **Admin_1** hoặc **Support_1** | Giống instructor cho gate catalog + manage |
| **Scoped_coorganizer** (`student` + email trong contest) | Vào được `/hackathons/manage` & `/hackathons/new` dù không phải instructor |
| **Student_1** (không trong co_organizer) | Truy cập `/hackathons/manage` → redirect `/hackathons` (fallback mặc định) |

## Checklist

### Catalog quản lý

1. Đăng nhập **Instructor_1**, mở `/hackathons/manage` — danh sách contest có quyền quản lý.
2. Đăng nhập **Scoped_coorganizer** (`student`), mở `/hackathons/manage` — **được vào** (không bị đá về `/hackathons` ngay).
3. Đăng nhập **Student_1** (không scoped), mở `/hackathons/manage` — **bị redirect** về `/hackathons`.

### Tạo contest

4. **Instructor_1**: `/hackathons/new` — điền form tối thiểu, submit (hoặc save draft theo UI).
5. **Scoped_coorganizer**: `/hackathons/new` — xác nhận có quyền tạo hoặc bị chặn bưởi RLS/API (ghi nhận hành vi đúng spec backend).

### Workspace theo slug

6. Với slug seed, mở `/hackathons/<slug>/manage/<section>` — shell load; tab quản lý (overview, submissions, judges, … theo UI) không crash.
7. Kiểm tra user chỉ có quyền **đọc một phần** nếu chỉ là mentor/judge (seed email vào `mentor_emails` / `judge_emails`) — đối chiếu [`getContestScopedViewerRoles`](../../src/lib/permissions.ts).

### Tuỳ chọn — reviewer applications

8. Seed email **Student_1** vào `reviewer_emails` — xác nhận có thể review applications nếu UI có.

## Kết quả mong đợi

- Phân biệt rõ ba nhóm: instructor/admin/support vs co-organizer scoped vs student thường.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
