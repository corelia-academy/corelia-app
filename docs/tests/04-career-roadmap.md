# 04 — Career & Roadmap

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ `/career`, `/career/corelia/:slug`, `/career/:handle/:slug`, `/roadmap`.

## Tiền đề staging

- Có ít nhất một career track / slug **Corelia** và (tuỳ chọn) track gắn handle instructor có seed.

## Tài khoản cần dùng

- Khách và **Student_1** (để đối chiếu nếu có gated content).

## Checklist

1. `/career` — danh sách hiển thị; filter/tab hoạt động nếu có.
2. Mở `/career/corelia/:slug` với slug tồn tại trên staging — chi tiết load.
3. Nếu có seed `/career/:handle/:slug` — URL đúng format handle + slug.
4. `/roadmap` — trang load đầy đủ (timeline/graph theo UI hiện tại).
5. Link nội bộ từ career sang instructor hoặc khóa học không gây 404 khi dữ liệu có seed.

## Kết quả mong đợi

- Không blank page; lỗi mạng có thông báo thân thiện.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
