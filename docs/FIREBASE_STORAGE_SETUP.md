# Thiết lập Firebase Storage (upload ảnh đại diện)

Ứng dụng dùng Firebase Storage để lưu ảnh đại diện (avatars). Làm theo các bước sau nếu bạn chưa bật Storage.

## 1. Bật Storage trong Firebase Console

1. Mở [Firebase Console](https://console.firebase.google.com/) và chọn project của bạn.
2. Trong menu trái, chọn **Build** → **Storage**.
3. Nếu chưa có Storage:
   - Bấm **Get started**.
   - Chọn **Start in production mode** (sau đó sẽ dùng rules tùy chỉnh) hoặc **Test mode** (chỉ để thử).
   - Chọn region (ví dụ: `asia-southeast1` cho gần Việt Nam).
   - Bấm **Done**.

Sau khi bật, Firebase tạo **default bucket** dạng: `{projectId}.appspot.com`.

## 2. Biến môi trường (Storage bucket)

Trong file `.env` hoặc `.env.local` của project, thêm (hoặc kiểm tra) biến:

```env
VITE_FIREBASE_STORAGE_BUCKET=ten-project-cua-ban.appspot.com
```

Thay `ten-project-cua-ban` bằng **Project ID** của bạn (có thể xem ở **Project settings** → **General** trong Firebase Console).

Nếu **không** set `VITE_FIREBASE_STORAGE_BUCKET`, SDK sẽ tự dùng `{projectId}.appspot.com` — chỉ cần đảm bảo project đã bật Storage như bước 1.

## 3. Deploy Storage Rules

Trong repo đã có file **`storage.rules`** ở thư mục gốc. Rules cho phép:

- User đăng nhập **đọc** mọi ảnh trong `avatars/`.
- User **chỉ ghi** (upload/xóa) vào thư mục của chính mình: `avatars/{userId}/*`.

**Cách 1: Firebase CLI**

```bash
# Cài Firebase CLI nếu chưa: npm i -g firebase-tools
firebase login
firebase init storage   # chọn project, dùng file storage.rules có sẵn
firebase deploy --only storage
```

**Cách 2: Copy rules trong Console**

1. Vào **Storage** → tab **Rules**.
2. Xóa nội dung cũ và dán nội dung từ file `storage.rules` trong repo.
3. Bấm **Publish**.

Nội dung rules mẫu:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 4. Kiểm tra

1. Chạy app: `pnpm dev`.
2. Đăng nhập → **Tài khoản** → **Thông tin cá nhân**.
3. Bấm **Tải ảnh lên (Firebase Storage)** và chọn một ảnh.
4. Nếu thành công, ảnh hiển thị ngay và được lưu trong Storage tại `avatars/{uid}/{timestamp}.jpg` (hoặc .png/.webp).

## Lỗi thường gặp

| Lỗi | Cách xử lý |
|-----|------------|
| `storage/unauthorized` hoặc permission denied | Kiểm tra lại Storage Rules đã deploy đúng và user đã đăng nhập. |
| `storage/object-not-found` | Bucket chưa được tạo — bật Storage trong Console (bước 1). |
| App báo lỗi khi khởi động liên quan storage | Kiểm tra `VITE_FIREBASE_STORAGE_BUCKET` trong `.env` hoặc bỏ trống để dùng bucket mặc định. |
