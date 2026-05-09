# 08 — Hackathons (công khai)

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ `/hackathons` và `/hackathons/:slug` với các tab: `overview`, `timeline`, `prizes`, `rules`, `faqs`, `projects`.

## Tiền đề staging

- Ít nhất một contest **published** có `slug` cố định để regression.

## Tài khoản cần dùng

- Khách.
- **Student_1** — đăng ký / submit (nếu flow có trên staging).

## Checklist

1. `/hackathons` — danh sách load; contest draft chỉ hiện với manager khi applicable ([09](./09-hackathons-manage-workspace.md)).
2. `/hackathons/<slug>/overview` — nội dung giới thiệu.
3. Lần lượt mở `/timeline`, `/prizes`, `/rules`, `/faqs`, `/projects` — không 404 layout shell.
4. Index `/hackathons/<slug>` redirect sang `overview` (hoặc hành vi hiện tại của app).
5. Đăng nhập **Student_1**: thử CTA đăng ký / vào workspace participant (ghi nhận kết quả).

## Kết quả mong đợi

- Public contest đọc được end-to-end; không lỗi auth lock khi chỉ xem ([STAGING_BUILD_VERIFY.md](../STAGING_BUILD_VERIFY.md)).

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
