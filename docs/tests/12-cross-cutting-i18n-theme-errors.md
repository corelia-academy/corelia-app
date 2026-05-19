# 12 — Cross-cutting: i18n, theme, 404, lỗi

Xem hub: [README.md](./README.md).

## Mục tiêu

Kiểm tra trải nghiệm xuyên suốt: ngôn ngữ (vi/en), dark/light mode, trang không tồn tại, phản ứng khi lỗi mạng nhẹ.

## Tiền đề staging

- Bundle đã verify ([README.md](./README.md)).

## Tài khoản cần dùng

- Bất kỳ (**Student_1** đủ).

## Checklist

### i18n

1. Đổi ngôn ngữ app (header/settings) sang **en**, reload Home và `/account/settings` — chuỗi không còn tiếng Việt rơi rớt rõ ràng.
2. Spot-check **`/cora`** và **`/learn/:courseId/lesson/:lessonId`** (nếu có quyền) sau khi đổi en — layout không vỡ.
3. Đổi lại **vi** — nhất quán.
4. Kiểm tra `document.documentElement.lang` phản ánh locale (tuỳ chọn — DevTools Elements).

### Theme

5. Chuyển **dark / light / system** (nếu có toggle) — không làm vỡ contrast text/button trên Home, `/courses`, `/hackathons/:slug`.

### 404

6. Mở path không tồn tại, ví dụ `/this-route-does-not-exist-xyz` — component NotFound hoặc message rõ.
7. `/admin/hackathons/*` — NotFound ([App.tsx](../../src/App.tsx)).

### Lỗi mạng (manual)

8. DevTools → Network → **Offline**, reload một trang public — có UI error/retry thân thiện hoặc splash rõ (ghi nhận).
9. Bật lại online — app recover không cần hard refresh (hoặc ghi nhận nếu cần).

## Kết quả mong đợi

- Không sót locale trầm trọng; theme đọc được; 404 không stack trace cho user.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
