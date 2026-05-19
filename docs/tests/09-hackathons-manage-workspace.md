# 09 — Hackathons — quản lý & workspace

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ `/hackathons/manage`, `/hackathons/new`, và workspace **`/hackathons/:slug/manage/:section`** với các tab theo role: `overview`, `applications`, `judging`, `analytics`, `translations`, `awards`, `email`, `settings`.

## Gate quyền (code)

- [`RequireContestManager`](../../src/components/auth/RequireContestManager.tsx) cho catalog `/hackathons/manage` và `/hackathons/new`:
  - `profiles.role` thuộc **instructor workspace**: `instructor`, `support_staff`, `admin` ([`ROLE_GROUPS.instructorWorkspace`](../../src/config/roles.ts)).
  - **Hoặc** email user trong **`co_organizer_emails`** của ít nhất một contest (`hasHackathonCoOrganizerAccess`).
- Workspace `/hackathons/:slug/manage/*` chỉ bọc `RequireAuth`; tab và hành động theo scoped roles — [`permissions.ts`](../../src/lib/permissions.ts), [`ContestDetailManageSectionTabs.tsx`](../../src/pages/hackathon-detail/components/ContestDetailManageSectionTabs.tsx).

### Ma trận tab manage

| Section | Manager | Reviewer | Judge | Aggregate observer |
|---------|---------|----------|-------|-------------------|
| overview | ✓ | ✓ | ✓ | ✓ |
| applications | ✓ | ✓ | — | — |
| judging | ✓ | — | ✓ | — |
| analytics | ✓ | — | — | ✓ |
| translations, awards, email, settings | ✓ | — | — | — |

## Tiền đề staging

- Contest seed có `slug` đã biết, có registrations ở nhiều status (approved / pending / rejected) cho email blast.
- **Scoped_coorganizer**: email trong `co_organizer_emails`.
- *(Tuỳ chọn)* **Scoped_reviewer**: email trong `reviewer_emails`.
- *(Tuỳ chọn)* **Scoped_judge**: email trong `judge_emails`.
- Edge Function `hackathons.blastEmail` đã deploy staging; biến `RESEND_API_KEY`, `MAIL_FROM` (hoặc ghi nhận `notConfigured`).

## Tài khoản cần dùng

| Account | Mục đích |
|---------|----------|
| **Instructor_1** | Catalog, new, manage đầy đủ (manager) |
| **Admin_1** hoặc **Support_1** | Giống instructor cho gate catalog + manage |
| **Scoped_coorganizer** | `/hackathons/manage` & `/hackathons/new` dù role `student` |
| **Scoped_reviewer** *(tuỳ chọn)* | Tab `applications` only |
| **Scoped_judge** *(tuỳ chọn)* | Tab `judging` only |
| **Student_1** (không scoped) | `/hackathons/manage` → redirect `/hackathons` |

## Checklist

### Catalog quản lý

1. **Instructor_1**: `/hackathons/manage` — danh sách contest có quyền quản lý.
2. **Scoped_coorganizer**: `/hackathons/manage` — **được vào** (không redirect ngay).
3. **Student_1** (không scoped): `/hackathons/manage` — **redirect** về `/hackathons`.

### Tạo contest

4. **Instructor_1**: `/hackathons/new` — form tối thiểu, submit hoặc save draft.
5. **Scoped_coorganizer**: `/hackathons/new` — quyền tạo hoặc chặn RLS/API (ghi nhận hành vi backend).

### Workspace — manager (Instructor_1)

6. `/hackathons/<slug>/manage` — redirect/index tới `.../manage/overview`.
7. **overview**: operating model 4 phase, metrics strip; **publish results** (leaderboard / winners) — sau publish kiểm tra `#results` trên public ([08](./08-hackathons-public.md)).
8. **applications**: search, filter theo status, pagination — không crash với nhiều registration.
9. **judging**, **analytics**, **translations**, **awards**, **settings** — smoke load từng tab.
10. **email** (Email blast):
    - Filter all / approved / pending / rejected — số lượng khớp tab applications.
    - Subject (≤200 ký tự), HTML body, toggle preview.
    - Confirm dialog → banner kết quả (sent / failed / skipped) + toast.
    - Staging: dùng nội dung test; nếu thiếu Resend env → message `notConfigured`, không crash.
11. **Negative**: **Scoped_reviewer** — **không** thấy tab `email` (ghi nhận; API có thể khác UI).

### Workspace — scoped roles

12. **Scoped_reviewer**: chỉ thấy `overview` + `applications`; không thấy `email`, `settings`, `judging`.
13. **Scoped_judge**: chỉ thấy `overview` + `judging`; không thấy `applications` list đầy đủ nếu policy chặn.
14. User chỉ trong `mentor_emails` / `judge_emails` — đối chiếu [`getContestScopedViewerRoles`](../../src/lib/permissions.ts) (ghi nhận quyền đọc một phần).

### Liên kết public

15. Sau publish results trên overview — mở `/hackathons/<slug>#results` ([08](./08-hackathons-public.md)) và xác nhận dữ liệu hiển thị.

## Kết quả mong đợi

- Phân biệt rõ: instructor/admin/support vs co-organizer vs reviewer/judge scoped vs student thường.
- Tab manage khớp ma trận role; email blast hoạt động hoặc báo cấu hình thiếu rõ ràng.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
