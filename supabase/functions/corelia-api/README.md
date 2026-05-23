# `corelia-api` (Supabase Edge Function)

Single HTTP entry: `/functions/v1/corelia-api?op=<operation>`. Secrets are configured in the Supabase Dashboard (**Project Settings → Edge Functions → Secrets**) or via CLI (`supabase secrets set KEY=value`).

Supabase usually injects **`SUPABASE_URL`** and **`SUPABASE_SECRET_KEYS`** for deployed functions; confirm they exist if you override secrets manually.
You cannot create secrets starting with `SUPABASE_` in the Dashboard because this prefix is reserved internally by Supabase.

---

## Bắt buộc để function khởi động

| Biến | Ghi chú |
|------|---------|
| `CORELIA_SUPABASE_URL` | URL project cho local/dev |
| `CORELIA_SUPABASE_SECRET_KEYS` | Secret key cho backend (vd. `sb_secret_...`). Vẫn hỗ trợ format JSON cũ để tương thích ngược |

---

## Theo tính năng (chỉ thêm khi dùng đúng `op`)

### Thanh toán SePay (`payments.sepay.*`, `payments.transactions`)

| Biến | Bắt buộc? | Ghi chú |
|------|------------|---------|
| `SEPAY_MERCHANT_ID` | Có (checkout) | |
| `SEPAY_SECRET_KEY` | Có (checkout) | Dùng ký form `pay*.sepay.vn/v1/checkout/init` |
| `SEPAY_IPN_SECRET` | Khuyến nghị (IPN webhook) | Nếu thiếu, code fallback sang `SEPAY_SECRET_KEY` |
| `SEPAY_ENV` | Không | `sandbox` (mặc định) hoặc `production` — chọn URL checkout và base URL SePay API v2 mặc định |
| `SEPAY_API_TOKEN` | Có (verify lookup) | Bearer token cho SePay API v2 `userapi` |
| `SEPAY_USERAPI_BASE_URL` | Không | Override base URL v2 (mặc định: sandbox `https://userapi-sandbox.sepay.vn/v2`, production `https://userapi.sepay.vn/v2`) |
| `SEPAY_BANK_ACCOUNT_ID` | Không | UUID bank account để thu hẹp truy vấn `v2/transactions` |
| `CORELIA_CORS_ALLOWED_ORIGINS` | Khuyến nghị | Comma-separated allowlist cho browser `Origin` được phép gọi Edge Function; nếu thiếu sẽ fallback sang `CORELIA_PAYMENT_CALLBACK_ORIGINS`, rồi `CORELIA_APP_ORIGIN` |
| `CORELIA_PAYMENT_CALLBACK_ORIGINS` | Khuyến nghị | Comma-separated allowlist cho `success_url` / `error_url` / `cancel_url` |

Luồng checkout của SePay Payment Gateway hiện vẫn dùng endpoint `/v1/checkout/init`; phần tra soát giao dịch trong `payments.sepay.verify` đã dùng SePay API v2 (`/v2/transactions`).

`payments.sepay.debugLookup` (POST) là op nội bộ để debug lookup v2 bằng `orderId + amountVnd`, chỉ cho `admin` / `support_staff`.

### Mail giao dịch — Resend (**dùng chung** cho mọi flow gọi `sendTransactionalEmailViaResend`, hiện có `hackathons.notifyRegistrationReview`)

| Biến | Bắt buộc để gửi được mail? | Ghi chú |
|------|-----------------------------|---------|
| `RESEND_API_KEY` | Có | API key Resend |
| `MAIL_FROM` | Có | Địa chỉ đã verify trên Resend (vd. `Corelia <noreply@yourdomain.com>`) |
| `CORELIA_APP_ORIGIN` | Không | URL app production (không slash cuối); dùng để dựng link trong một số template (vd. deep link hackathon), và là fallback cuối cho allowlist CORS / callback nếu chưa cấu hình biến chuyên biệt |

Nếu thiếu `RESEND_API_KEY` hoặc `MAIL_FROM`, handler **không lỗi**: trả `{ skipped: true, reason: "email_not_configured" }` và log cảnh báo — phù hợp môi trường dev.

Code gửi mail chung: [`lib/mail/resend.ts`](lib/mail/resend.ts). Handler chỉ lo `subject` + `html`.

## Local

Local secrets dùng chung file [`supabase/functions/.env`](../.env). Khởi tạo từ [`supabase/functions/.env.example`](../.env.example), rồi serve function với:

```bash
supabase functions serve corelia-api --env-file supabase/functions/.env
```

Khi cần sync secrets lên hosted project, có thể dùng `supabase secrets set --env-file supabase/functions/.env` hoặc Dashboard.

Tham khảo: [Supabase Edge Functions secrets](https://supabase.com/docs/guides/functions/secrets).

## Auth mode

Function này có cả op public (IPN) và op yêu cầu đăng nhập trong cùng một entrypoint, nên `verify_jwt` được cấu hình tại [`supabase/config.toml`](../../config.toml) là `false`; các op protected sẽ tự kiểm tra Bearer token trong code.
