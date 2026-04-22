# App Check với reCAPTCHA v3 (chống DoS/lạm dụng)

Ứng dụng dùng **Firebase App Check** với **reCAPTCHA v3** để bảo vệ Auth (và các dịch vụ Firebase khác) khỏi truy cập lạm dụng, bot và tấn công DoS. reCAPTCHA v3 chạy nền, không yêu cầu user giải captcha.

Tài liệu tham khảo: [Get started using App Check with reCAPTCHA v3 in web apps](https://firebase.google.com/docs/app-check/web/recaptcha-provider?authuser=1).

## 1. Đăng ký reCAPTCHA v3

1. Vào [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin).
2. Đăng ký site mới: chọn **reCAPTCHA v3**, thêm domain (ví dụ `localhost` cho dev và domain production).
3. Lấy **Site key** (public) và **Secret key** (private). Site key dùng ở client; Secret key dùng trong Firebase Console.

## 2. Cấu hình App Check trong Firebase Console

1. Mở [Firebase Console](https://console.firebase.google.com/) → chọn project.
2. Vào **Build** → **App Check**.
3. Trong **Apps**, chọn app web của bạn (hoặc đăng ký app nếu chưa có).
4. Chọn provider **reCAPTCHA v3**, dán **Secret key** từ bước 1 → **Save**.
5. (Tùy chọn) Điều chỉnh **TTL** cho token (mặc định 1 ngày) và **App risk threshold** nếu cần.

## 3. Biến môi trường

Trong `.env` hoặc `.env.local`:

```env
VITE_RECAPTCHA_V3_SITE_KEY=your-recaptcha-v3-site-key-here
```

Thay `your-recaptcha-v3-site-key-here` bằng **Site key** (public key) từ bước 1. Nếu không set biến này, App Check sẽ không được khởi tạo (app vẫn chạy, nhưng không có bảo vệ App Check).

## 4. Bật enforcement (sau khi đã kiểm tra)

Sau khi deploy và xác nhận app gửi token App Check ổn định:

1. Trong **App Check** → **APIs** (hoặc từng product: Authentication, Firestore, Storage…).
2. Bật **Enforce** cho các API cần bảo vệ (ví dụ Authentication).

Chỉ bật enforcement khi đã kiểm tra metrics để tránh chặn user thật. Có thể dùng [App Check debug provider](https://firebase.google.com/docs/app-check/web/debug-provider) khi dev/local.

## 5. Đăng nhập Email/Mật khẩu

Ứng dụng dùng đăng nhập **Email & Mật khẩu** (và Google, GitHub). Trong Firebase Console → **Authentication** → **Sign-in method**, cần bật **Email/Password**. App Check giúp giảm rủi ro brute-force/DoS lên endpoint đăng nhập.
