# Xác thực hai yếu tố (Multi-Factor Authentication – MFA)

Ứng dụng hỗ trợ **SMS Multi-Factor Authentication** của Firebase: người dùng có thể đăng ký số điện thoại làm bước xác thực thứ hai khi đăng nhập.

Tài liệu Firebase: [Add multi-factor authentication to your web app](https://firebase.google.com/docs/auth/web/multi-factor).

## Điều kiện

1. **Firebase Authentication với Identity Platform**  
   MFA (SMS) yêu cầu nâng cấp lên Identity Platform. Kiểm tra trong [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → xem đã bật Identity Platform chưa (hoặc theo hướng dẫn nâng cấp trong Firebase Console).

2. **Bật ít nhất một provider hỗ trợ MFA**  
   Email/Password, Google, GitHub đều hỗ trợ. **Không** hỗ trợ: Phone auth (đăng nhập bằng SĐT), Anonymous, Apple Game Center.

3. **Xác thực email**  
   Firebase khuyến nghị bật xác thực email cho user để tránh lạm dụng khi bật MFA.

4. **Vùng SMS**  
   Trong Firebase Console có thể cần bật các vùng (region) nơi bạn gửi SMS. Mặc định Firebase dùng chính sách vùng SMS “fully blocking” – cần mở vùng tương ứng (ví dụ Việt Nam) nếu cần.

## Bật MFA trong Firebase Console

1. Mở [Firebase Console](https://console.firebase.google.com/) → chọn project.
2. Vào **Build** → **Authentication** → **Sign-in method**.
3. Trong mục **Advanced**, tìm **SMS Multi-factor Authentication** (hoặc **Multi-factor authentication**).
4. Bật **SMS Multi-factor Authentication**.
5. (Khuyến nghị) Thêm **Test phone numbers** để test mà không bị giới hạn khi gửi SMS trong lúc phát triển.
6. Ở **Authentication** → **Settings**, đảm bảo domain của app (localhost, domain production) đã được thêm vào **Authorized domains**.

## Luồng trong ứng dụng

- **Đăng nhập**: Nếu tài khoản đã bật MFA, sau khi nhập email/mật khẩu (hoặc đăng nhập Google/GitHub), Firebase trả về lỗi `auth/multi-factor-auth-required`. Ứng dụng hiển thị bước 2: nhấn “Gửi mã” → nhập mã SMS → “Xác nhận” để hoàn tất đăng nhập.
- **Đăng ký MFA**: Trong **Tài khoản** → **Thông tin cá nhân**, có card **Bảo mật hai lớp (MFA)**. User bấm “Thêm số điện thoại xác thực” → xác thực lại (mật khẩu hoặc đăng nhập lại Google/GitHub) → nhập số điện thoại (E.164, ví dụ +84901234567) → nhận mã SMS → nhập mã → hoàn tất.

## reCAPTCHA cho SMS

Firebase dùng **RecaptchaVerifier** (từ `firebase/auth`) cho việc gửi mã SMS, **tách biệt** với App Check (reCAPTCHA v3). Ứng dụng dùng **invisible reCAPTCHA**: không cần widget hiển thị, gắn vào nút “Gửi mã”. Domain của app phải nằm trong **Authorized domains** của Firebase Auth; nếu dùng reCAPTCHA v2 (invisible) cho phone, có thể cần cấu hình thêm trong [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin) (domain cho reCAPTCHA v2 invisible) nếu Firebase yêu cầu.

## Lưu ý

- Nên khuyến khích user đăng ký **ít nhất hai** second factor (ví dụ hai số điện thoại) để phòng trường hợp mất quyền truy cập một số.
- MFA (SMS) có thể phát sinh chi phí (Firebase/Identity Platform). Xem bảng giá và giới hạn trong Google Cloud / Firebase.
