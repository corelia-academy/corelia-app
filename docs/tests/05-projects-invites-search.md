# 05 — Projects, invite, Search

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ `/projects` (gallery công khai), `/invites/project/:token`, `/search?q=...`.

**Lưu ý:** Chỉnh sửa project i18n nằm ở `/account/projects` ([07](./07-account-hub.md)), không phải `/projects`.

## Tiền đề staging

- Một **token invite** hợp lệ do dev seed hoặc user khác tạo (ghi rõ token trong sheet nội bộ, không commit).

## Tài khoản cần dùng

- **Student_1**
- **Student_2** *(tuỳ chọn)* — nhận invite khi cần hai người.

## Checklist

### Projects (gallery)

1. Ẩn danh hoặc đã login: `/projects` — gallery load; empty state hợp lý nếu chưa có project public.
2. Click một project card — chi tiết / link ngoài hoạt động; link hackathon (nếu có) trỏ **`/hackathons/:slug`** (canonical), không `/overview`.

### Invite

3. Mở `/invites/project/:token` với token **hợp lệ** — flow accept/decline hoặc join theo spec.
4. Token **không hợp lệ** — thông báo lỗi rõ, không crash.

### Search

5. `/search?q=<từ_khóa>` — kết quả đa loại (projects, hackathons, courses, career tracks, profiles) hoặc empty state.
6. `/search` không có query — UI search load, submit query hoạt động.
7. Click một kết quả — điều hướng đúng entity.

## Kết quả mong đợi

- Invite không expose PII thừa; search không lock UI; phân biệt rõ `/projects` vs `/account/projects`.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
