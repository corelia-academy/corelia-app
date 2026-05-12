# 05 — Projects, invite, Search

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ `/projects`, `/invites/project/:token`, `/search`.

## Tiền đề staging

- Một **token invite** hợp lệ do dev seed hoặc user khác tạo (ghi rõ token trong sheet nội bộ, không commit).

## Tài khoản cần dùng

- **Student_1**
- **Student_2** *(tuỳ chọn)* — nhận invite khi cần hai người.

## Checklist

### Projects

1. Ẩn danh hoặc đã login: `/projects` load danh sách / empty state hợp lý.
2. Thao tác tạo/chỉnh project (nếu có trong UI) — lưu và hiển thị lại được.

### Invite

3. Mở `/invites/project/:token` với token **hợp lệ** — flow accept/decline hoặc join theo spec.
4. Token **không hợp lệ** — thông báo lỗi rõ, không crash.

### Search

5. `/search` — ô tìm kiếm; submit/query — kết quả hoặc empty state.
6. Click một kết quả — điều hướng đúng entity.

## Kết quả mong đợi

- Invite không expose PII thừa; search không lock UI.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
