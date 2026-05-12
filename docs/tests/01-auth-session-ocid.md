# 01 — Auth, phiên, OCID

Xem hub: [README.md](./README.md).

## Mục tiêu

Xác minh đăng ký, đăng nhập, đăng xuất, giữ phiên, và luồng redirect OCID (`/ocid-redirect`).

## Tiền đề staging

- Đã có URL staging và verify bundle ([README.md](./README.md)).
- OCID: chỉ test khi team đã cấu hình `VITE_OCID_CLIENT_ID` / redirect URI cho staging ([README.md](../../README.md)).

## Tài khoản cần dùng

- **Student_1** (hoặc user mới): để đăng ký và đăng nhập lần đầu.
- **Student_1** hoặc **Instructor_1**: để test OCID khi đã có OCID staging.

## Checklist

### Đăng ký & đăng nhập

1. Mở staging **chưa đăng nhập**, vào `/login`.
2. **Đăng ký** tài khoản email mới (hoặc provider team cho phép).
3. Xác nhận email nếu Supabase yêu cầu (kiểm tra hướng dẫn team — có thể tắt confirm trên staging).
4. **Đăng nhập** lại sau khi tài khoản hoạt động.
5. Refresh trang: **vẫn đăng nhập**, không mất session bất thường (không redirect vòng về `/login`).

### Đăng xuất & deep link

1. Đăng nhập, mở `/account/profile`.
2. **Đăng xuất** từ UI header/menu (theo thiết kế hiện tại).
3. Truy cập lại `/account/profile`: **bị chặn**, redirect về `/login` (hoặc trang chủ + yêu cầu login).
4. Truy cập `/login` khi đã logout: form đăng nhập hiển thị bình thường.

### OCID (nếu bật trên staging)

1. Đăng nhập, mở trang có nút kết nối OCID (ví dụ Account hoặc dialog Connect trong header — theo UI hiện tại).
2. Hoàn tất flow OAuth OCID của nhà cung cấp.
3. Sau redirect về **`/ocid-redirect`**: không báo lỗi chết trắng; profile được cập nhật (OCID đã liên kết nếu thành công).
4. Reload `/account/profile`: trạng thái OCID nhất quán.

### Regression nhẹ (auth console)

Theo [STAGING_BUILD_VERIFY.md](../STAGING_BUILD_VERIFY.md): trên Home (đã login / ẩn danh), không có spam lỗi auth/token trong console trong lần paint đầu.

## Kết quả mong đợi

- Luồng đăng ký → đăng nhập → protected route hoạt động.
- Logout xóa quyền truy cập `/account/*`.
- OCID (nếu cấu hình): redirect và profile không broken.

## Ghi chú bug

| ID case | Bước | Mong đợi | Thực tế | Severity |
|---------|------|----------|---------|----------|
