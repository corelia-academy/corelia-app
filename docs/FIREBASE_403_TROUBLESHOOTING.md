# Xử lý lỗi 403 (Permission denied / Unregistered callers)

Khi app báo lỗi dạng:

```json
{
  "error": {
    "code": 403,
    "message": "Method doesn't allow unregistered callers (callers without established identity). Please use API Key or other form of API consumer identity to call this API.",
    "status": "PERMISSION_DENIED"
  }
}
```

Nghĩa là request tới Firebase/Google thiếu hoặc sai **API key** / danh tính. Làm lần lượt các bước sau.

## 1. Kiểm tra biến môi trường

Đảm bảo file **`.env.local`** (hoặc `.env`) có đủ và **không để trống**:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=corelia-a2e6d.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=corelia-a2e6d
VITE_FIREBASE_STORAGE_BUCKET=corelia-a2e6d.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=1:...
```

- Lấy các giá trị này tại: **Firebase Console** → **Project settings** (icon bánh răng) → **General** → phần **Your apps** (Web app).
- **Sau khi sửa `.env.local`** cần **restart dev server** (`pnpm dev` / `npm run dev`) để biến môi trường được nạp lại.

## 2. Bật Firestore API

1. Vào [Google Cloud Console](https://console.cloud.google.com/) và chọn **đúng project** (cùng Project ID với Firebase).
2. Menu **APIs & Services** → **Enabled APIs & services**.
3. Tìm **Cloud Firestore API** → nếu chưa bật thì **Enable**.

## 3. Kiểm tra hạn chế API Key (quan trọng)

Nếu bạn đã **giới hạn API key** theo HTTP referrer:

1. Vào **Google Cloud Console** → **APIs & Services** → **Credentials**.
2. Mở **API key** mà Web app đang dùng (thường tên kiểu "Web client" hoặc "Browser key").
3. Phần **Application restrictions**:
   - Nếu đang chọn **HTTP referrers**, cần thêm đúng nguồn chạy app, ví dụ:
     - `http://localhost:*`
     - `http://localhost:5173/*`
     - `https://yourdomain.com/*`
   - Hoặc tạm thời chọn **None** (chỉ để test) rồi **Save**.

Nếu key bị giới hạn mà không có referrer đúng (ví dụ thiếu `http://localhost:*`), Firestore sẽ trả **403** với message "unregistered callers".

## 4. App Check (nếu đang bật)

Nếu project đã bật **Firebase App Check** cho Firestore:

- Đảm bảo **reCAPTCHA v3** (hoặc provider bạn dùng) đã cấu hình đúng.
- Trong `.env.local` có `VITE_RECAPTCHA_V3_SITE_KEY` và domain hiện tại được thêm trong reCAPTCHA / App Check.

Nếu chưa dùng App Check, có thể tắt thử cho Firestore trong **Firebase Console** → **App Check** để xem 403 có hết không.

---

Sau khi chỉnh xong, **restart dev server** và thử lại. Nếu vẫn 403, mở **DevTools** → tab **Network**, tìm request bị lỗi (status 403), xem request URL và header để xác định đúng API (Firestore, Auth, v.v.) rồi kiểm tra lại API key và restrictions cho API đó.
