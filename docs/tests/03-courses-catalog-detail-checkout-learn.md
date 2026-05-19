# 03 — Khóa học (catalog, chi tiết, checkout, học)

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ `/courses`, `/courses/:id`, `/checkout/course/:courseId`, `/checkout/success/:purpose/:courseId`, `/learn/:courseId`, `/learn/:courseId/lesson/:lessonId` — kèm **Cora AI** trong learn.

## Tiền đề staging

- Ít nhất một khóa học **public** và một khóa **cần mua / enrolled** (seed hoặc tài khoản đã mua).
- Thanh toán: chỉ dùng **chế độ test SePay** — không thẻ thật. Ngữ cảnh: [COURSE_OWNERSHIP_REVENUE_SEPAY.md](../COURSE_OWNERSHIP_REVENUE_SEPAY.md), [COURSE_ACCESS_MODELS.md](../COURSE_ACCESS_MODELS.md).

## Tài khoản cần dùng

- **Student_1**: checkout và learn (RequireAuth).

## Checklist

### Catalog & chi tiết

1. Ẩn danh: `/courses` — danh sách load.
2. Mở `/courses/:id` với `id` hợp lệ — nội dung chi tiết, CTA (đăng ký/mua) hiển thị.

### Checkout & success

3. Đăng nhập **Student_1**, vào khóa cần thanh toán (theo seed).
4. Điều hướng `/checkout/course/:courseId` — form/step SePay không crash.
5. Hoàn tất hoặc **simulate** return URL thành công (theo hướng dẫn dev staging).
6. Mở `/checkout/success/:purpose/:courseId` — verify không spam refresh/session ([STAGING_BUILD_VERIFY.md](../STAGING_BUILD_VERIFY.md)).

### Learn

7. Với khóa **đã có quyền học**, mở `/learn/:courseId`.
8. Mở bài học `/learn/:courseId/lesson/:lessonId` — player/content load (video/link theo seed).
9. Trong learn: mở/đóng **Cora** sidebar hoặc assistant panel (`CoraSidebarPanel` / `GlobalCoraAssistant`) — không crash, không che hết nội dung bài học.
10. **Không có quyền**: truy cập URL learn trực tiếp — bị chặn hoặc redirect (ghi nhận hành vi spec).

### Cora subscription (cross-ref)

11. Gói AI / subscription: xem thêm `/cora` ([07-account-hub.md](./07-account-hub.md)).

### Redirect legacy

12. `/cohorts` và `/cohorts/:id` redirect về `/courses` (không 404).

## Kết quả mong đợi

- Luồng xem → (tuỳ quyền) checkout SePay → học + Cora smoke hoạt động trên staging.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
