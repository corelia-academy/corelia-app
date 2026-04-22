# Firebase environments (dev / staging / prod) + .env setup

Tài liệu này mô tả cách chia môi trường theo **Firebase projects** và cách cấu hình **Vite `.env.*`** cho frontend trong repo này.

## 1) Mô hình môi trường

Khuyến nghị: **1 môi trường = 1 Firebase project**.

- **dev**: dùng SePay sandbox, dev data
- **staging**: dùng SePay sandbox, gần giống production để test
- **prod**: dùng SePay production, data thật

Repo đã cấu hình alias trong `.firebaserc`:

- `dev` → `corelia-dev`
- `staging` → `corelia-staging`
- `prod` → `corelia-a2e6d`

Bạn cần tự tạo 2 project `corelia-dev` và `corelia-staging` trong Firebase Console (prod đã có sẵn theo repo).

## 2) Frontend: cấu hình `.env` cho Vite

### 2.1 Các biến bắt buộc

Frontend dùng Firebase client SDK trong `src/lib/firebase.ts`, cần các biến:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Repo có 3 file mẫu:

- `.env.development.example`
- `.env.staging.example`
- `.env.production.example`

Bạn tạo file thật tương ứng:

- `.env.development`
- `.env.staging`
- `.env.production`

### 2.2 App Check (tuỳ chọn)

Nếu dùng App Check (reCAPTCHA v3), set:

- `VITE_RECAPTCHA_V3_SITE_KEY`

Lưu ý: mỗi Firebase project có thể có cấu hình App Check khác nhau.

### 2.3 SePay checkout endpoint (tuỳ chọn)

Mặc định frontend gọi:

- `/api/payments/sepay/checkout`

Nếu bạn **không dùng Firebase Hosting rewrite** (ví dụ host frontend ở Netlify), hãy set:

- `VITE_SEPAY_CHECKOUT_API="https://<your-domain>/api/payments/sepay/checkout"`

## 3) Deploy theo môi trường

### 3.1 Chọn project khi deploy

Chạy trực tiếp:

- `firebase deploy --project dev`
- `firebase deploy --project staging`
- `firebase deploy --project prod`

Hoặc dùng scripts có sẵn trong `package.json`:

- `pnpm deploy:dev`
- `pnpm deploy:staging`
- `pnpm deploy:prod`

### 3.2 Hosting vs Functions

- **Deploy Functions**:
  - `firebase deploy --only functions --project <env>`
- **Deploy Hosting**:
  - `pnpm build` (hoặc `pnpm build:staging`) rồi
  - `firebase deploy --only hosting --project <env>`

Nếu bạn dùng Firebase Hosting, `firebase.json` đã có rewrite:

- `/api/**` → Cloud Function `api`
- `**` → `/index.html` (SPA fallback)

## 4) Backend (Cloud Functions): secrets theo môi trường

Cloud Functions **không** lấy secret từ Vite `.env.*`.

Mỗi Firebase project cần set các env/secrets riêng cho SePay:

- `SEPAY_ENV` = `sandbox` (dev/staging) hoặc `production` (prod)
- `SEPAY_MERCHANT_ID`
- `SEPAY_SECRET_KEY`
- `SEPAY_IPN_SECRET` (header `X-Secret-Key` mà SePay gửi vào IPN)

Sau khi set xong, deploy Functions cho đúng project.

## 5) Checklist nhanh

- **Dev**
  - Firebase project `corelia-dev` tồn tại
  - `.env.development` trỏ đúng project dev
  - SePay sandbox keys + IPN sandbox cấu hình đúng URL dev
  - Deploy: `pnpm deploy:dev`

- **Staging**
  - Firebase project `corelia-staging` tồn tại
  - `.env.staging` trỏ đúng project staging
  - SePay sandbox keys + IPN cấu hình đúng URL staging
  - Deploy: `pnpm deploy:staging`

- **Prod**
  - `.env.production` trỏ đúng project prod
  - SePay production keys + IPN production cấu hình đúng URL prod
  - Deploy: `pnpm deploy:prod`

