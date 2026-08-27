# 02 — Trang chủ & khám phá

Xem hub: [README.md](./README.md).

## Mục tiêu

Kiểm tra trang chủ `/` khi **ẩn danh** và khi **đã đăng nhập** (momentum cards, continue learning, explore courses).

**Lưu ý:** Home hiện tại **không** có learner AI assistant hoặc chat panel trên `/`.

## Tiền đề staging

- Verify bundle ([README.md](./README.md)).
- Có ít nhất vài khóa học / contest hiển thị public trên staging (seed).

## Tài khoản cần dùng

- Không cần (ảnh khách).
- **Student_1**: so sánh trạng thái đã login.

## Checklist

1. **Ẩn danh**: mở `/`.
   - Trang load không blank lâu bất thường.
   - Hero / catalog guest không báo lỗi user-visible.
2. **Ẩn danh**: click vào một khóa học public → điều hướng đến `/courses/:id` hợp lệ.
3. Đăng nhập **Student_1**, mở lại `/`.
   - Các block **momentum**, **continue learning**, **explore courses** (hoặc pinned programs) hiển thị không crash.
4. Đổi ngôn ngữ (vi/en): Home không vỡ layout (chi tiết: [12-cross-cutting-i18n-theme-errors.md](./12-cross-cutting-i18n-theme-errors.md)).

## Kết quả mong đợi

- Home ổn định cho guest và authenticated; không infinite spinner không có thông báo.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
