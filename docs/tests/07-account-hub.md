# 07 — Account hub (`/account/*`)

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ các route con account: `profile`, `cv`, `billing`, `settings`, `projects`, `instructor`.
*(Ghi chú: Toàn bộ tính năng Cora và learner-facing AI đã được gỡ bỏ khỏi hệ thống theo Epic #332; các route cũ liên quan tới Cora không còn tồn tại).*

**Lưu ý:** `/account/projects` là **editor i18n/translation** cho project (`AccountProjectsRoute`), **không** phải gallery công khai `/projects` ([05](./05-projects-invites-search.md)).

## Tiền đề staging

- Đăng nhập ổn định ([01-auth-session-ocid.md](./01-auth-session-ocid.md)).

## Tài khoản cần dùng

- **Student_1** — hầu hết tab.
- **Instructor_1** — tab instructor (`profiles.role === instructor`).

## Checklist

1. Đăng nhập, vào `/account` — redirect về `/account/profile`.
2. **`/account/profile`**: cập nhật họ tên/avatar (nếu có) — lưu và reload giữ được.
3. **`/account/cv`**: chỉnh sửa/lưu hoặc upload theo UI — không crash.
4. **`/account/billing`**: hiển thị lịch sử giao dịch và thanh toán lịch sử; không hard fail khi empty.
5. **`/account/settings`**: đổi locale/email/password (theo phạm vi staging); OCID section nếu bật ([01](./01-auth-session-ocid.md)).
6. **`/account/projects`**: editor dịch/i18n project — load danh sách project user có quyền chỉnh; **không** nhầm với `/projects` gallery.
7. **`/account/instructor`**:
   - **Student_1**: empty, upsell, hoặc redirect (ghi nhận spec).
   - **Instructor_1**: form instructor hiển thị và lưu được.
8. **`/achievements`**: redirect về `/account` (top-level route dự phòng).
9. **OC Vault (Badges & Credentials)**: UI hiển thị trên trang public profile `/u/<username>` → section "Huy hiệu & Thành tích" → tabs OCA / Badges / Milestones. Test: mint ít nhất 1 credential trên staging → kiểm tra hiện trên profile. *(Route `/account/achievements` chưa có — in-app notification bell hiện link tạm về đây; sẽ wired ở sprint sau.)*

## Kết quả mong đợi

- Toàn bộ tab RequireAuth không leak sang guest; không loop redirect.
- Account tabs hoạt động độc lập với public `/projects`.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
