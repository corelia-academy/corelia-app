# 07 — Account hub (`/account/*`)

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ các route con: `profile`, `cv`, `billing`, `settings`, `projects`, `instructor` (tab/workspace entry trong account).

## Tiền đề staging

- Đăng nhập ổn định ([01-auth-session-ocid.md](./01-auth-session-ocid.md)).

## Tài khoản cần dùng

- **Student_1** — hầu hết tab.
- **Instructor_1** — tab instructor trong account + field đối tác nếu có.

## Checklist

1. Đăng nhập, vào `/account` — redirect về `/account/profile`.
2. **`/account/profile`**: cập nhật họ tên/avatar (nếu có) — lưu và reload giữ được.
3. **`/account/cv`**: chỉnh sửa/lưu hoặc upload theo UI — không crash.
4. **`/account/billing`**: hiển thị lịch sử/subscription (mock hoặc staging); không hard fail khi empty.
5. **`/account/settings`**: đổi locale/email/password (theo phạm vi staging); confirm OCID section nếu bật ([01](./01-auth-session-ocid.md)).
6. **`/account/projects`**: danh sách project của user — nhất quán với `/projects` nếu applicable.
7. **`/account/instructor`**:
   - **Student_1**: kỳ vọng empty, upsell, hoặc redirect (ghi nhận hành vi đúng spec).
   - **Instructor_1**: form instructor hiển thị và lưu được.

## Kết quả mong đợi

- Toàn bộ tab RequireAuth không leak sang guest; không loop redirect.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
