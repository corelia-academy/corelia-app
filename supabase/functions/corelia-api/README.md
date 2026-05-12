# `corelia-api` (Supabase Edge Function)

Single HTTP entry: `/functions/v1/corelia-api?op=<operation>`. Secrets are configured in the Supabase Dashboard (**Project Settings → Edge Functions → Secrets**) or via CLI (`supabase secrets set KEY=value`).

Supabase usually injects **`SUPABASE_URL`** and **`SUPABASE_SECRET_KEYS`** for deployed functions; confirm they exist if you override secrets manually.

---

## Bắt buộc để function khởi động

| Biến | Ghi chú |
|------|---------|
| `SUPABASE_URL` | URL project (vd. `https://xxx.supabase.co`) |
| `SUPABASE_SECRET_KEYS` | JSON dictionary (vd. `{\"default\":\"sb_secret_...\"}`) — dùng trên server / Edge |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy fallback (deprecated) — chỉ dùng nếu không có `SUPABASE_SECRET_KEYS` |

---

## Theo tính năng (chỉ thêm khi dùng đúng `op`)

### Thanh toán SePay (`payments.sepay.*`, `payments.transactions`)

| Biến | Bắt buộc? | Ghi chú |
|------|------------|---------|
| `SEPAY_MERCHANT_ID` | Có (checkout) | |
| `SEPAY_SECRET_KEY` | Có (checkout, ký request; dùng làm fallback IPN nếu không set secret riêng) | |
| `SEPAY_IPN_SECRET` | Khuyến nghị (IPN webhook) | Nếu thiếu, code fallback sang `SEPAY_SECRET_KEY` |
| `SEPAY_ENV` | Không | `sandbox` (mặc định) hoặc `production` — chọn URL checkout SePay |
| `SEPAY_SANDBOX` | Không | `true` → PG API sandbox (`SEPAY_PGAPI_BASE_URL` ưu tiên hơn nếu có) |
| `SEPAY_PGAPI_BASE_URL` | Không | Override base URL tra cứu đơn PG API |
| `CORELIA_PAYMENT_CALLBACK_ORIGINS` | Khuyến nghị | Comma-separated allowlist cho `success_url` / `error_url` / `cancel_url` |

### Mail giao dịch — Resend (**dùng chung** cho mọi flow gọi `sendTransactionalEmailViaResend`, hiện có `hackathons.notifyRegistrationReview`)

| Biến | Bắt buộc để gửi được mail? | Ghi chú |
|------|-----------------------------|---------|
| `RESEND_API_KEY` | Có | API key Resend |
| `MAIL_FROM` | Có | Địa chỉ đã verify trên Resend (vd. `Corelia <noreply@yourdomain.com>`) |
| `CORELIA_APP_ORIGIN` | Không | URL app production (không slash cuối); dùng để dựng link trong một số template (vd. deep link hackathon) |

Nếu thiếu `RESEND_API_KEY` hoặc `MAIL_FROM`, handler **không lỗi**: trả `{ skipped: true, reason: "email_not_configured" }` và log cảnh báo — phù hợp môi trường dev.

Code gửi mail chung: [`lib/mail/resend.ts`](lib/mail/resend.ts). Handler chỉ lo `subject` + `html`.

### Google Meet (chỉ khi gọi `meetApiFetch` — hiện chưa gắn route)

| Biến | Ghi chú |
|------|---------|
| `GOOGLE_MEET_CLIENT_EMAIL` | Service account client email |
| `GOOGLE_MEET_PRIVATE_KEY` | PEM PKCS8 (trong secret có thể dùng `\n` cho newline) |
| `GOOGLE_MEET_DELEGATED_USER` | User để domain-wide delegation |

---

## Local

Copy secrets vào `.env` trong thư mục function hoặc dùng `supabase secrets` / Dashboard tương ứng khi `supabase functions serve`.

Tham khảo: [Supabase Edge Functions secrets](https://supabase.com/docs/guides/functions/secrets).

## Auth mode

Function này có cả op public (IPN) và op yêu cầu đăng nhập trong cùng một entrypoint, nên `verify_jwt` được cấu hình tại [`supabase/config.toml`](../../config.toml) là `false`; các op protected sẽ tự kiểm tra Bearer token trong code.
