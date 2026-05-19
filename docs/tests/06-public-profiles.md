# 06 — Hồ sơ công khai

Xem hub: [README.md](./README.md).

## Mục tiêu

Phủ `/u/:handle` và luồng redirect `:handle/*` (short URL profile).

## Tiền đề staging

- Biết **handle** public của ít nhất một user (Student_1 hoặc Instructor_1 sau khi set profile).

## Tài khoản cần dùng

- Khách (xem public).
- **Student_1** / **Instructor_1** — chỉnh profile và xác nhận hiển thị public.

## Checklist

1. Ẩn danh: `/u/<handle_hợp_lệ>` — layout load (bio, links, projects public nếu có).
2. Handle **không tồn tại** — 404 hoặc empty theo spec app (ghi nhận).
3. Nếu team dùng short URL `/<handle>/...`: thử path có seed — redirect đúng hoặc landing đúng ([App.tsx](../../src/App.tsx) route `:handle/*`). Tránh handle trùng reserved route (`hackathons`, `career`, `cora`, `courses`, …).
4. Đăng nhập chính chủ: so sánh một vài field private không lộ trên guest (theo thiết kế). Profile có thể dùng `ocid` làm handle public nếu đã link OCID.

## Kết quả mong đợi

- Không leak dữ liệu nhạy cảm cho guest; perf không đơ ~10s chờ auth không cần thiết ([STAGING_BUILD_VERIFY.md](../STAGING_BUILD_VERIFY.md)).

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
