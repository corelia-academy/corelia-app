# `corelia-api` (Supabase Edge Function)

Single HTTP entry: `/functions/v1/corelia-api?op=<operation>`. Secrets are configured in the Supabase Dashboard (**Project Settings → Edge Functions → Secrets**) or via CLI (`supabase secrets set KEY=value`).

Supabase usually injects **`SUPABASE_URL`** and **`SUPABASE_SECRET_KEYS`** for deployed functions; confirm they exist if you override secrets manually.
You cannot create secrets starting with `SUPABASE_` in the Dashboard because this prefix is reserved internally by Supabase.

---

## Bắt buộc để function khởi động

| Biến | Ghi chú |
|------|---------|
| `SUPABASE_URL` | URL project do Supabase Edge runtime tự inject |
| `SUPABASE_SECRET_KEYS` | Secret-key dictionary do Supabase Edge runtime tự inject; backend chọn key mặc định |

---

## Theo tính năng

### Mail giao dịch — Resend (**dùng chung** cho mọi flow gọi `sendTransactionalEmailViaResend`, hiện có `hackathons.notifyRegistrationReview`)

| Biến | Bắt buộc để gửi được mail? | Ghi chú |
|------|-----------------------------|---------|
| `RESEND_API_KEY` | Có | API key Resend |
| `MAIL_FROM` | Có | Địa chỉ đã verify trên Resend (vd. `Corelia <noreply@yourdomain.com>`) |
| `CORELIA_APP_ORIGIN` | Không | URL app production (không slash cuối); dùng để dựng link và làm fallback cho allowlist CORS |

### Project moderation

| Biến | Bắt buộc? | Ghi chú |
|------|---------|---------|
| `OPENAI_API_KEY` | Có | Dùng cho `projects.save` và `projects.media.upload`; thiếu key thì project save/upload fail-closed. |

Project text/images use `omni-moderation-latest`. Public project links use the
Responses API with `gpt-5.4-mini` and web search. `video_url` is deliberately
excluded from AI checks.

Nếu thiếu `RESEND_API_KEY` hoặc `MAIL_FROM`, handler **không lỗi**: trả `{ skipped: true, reason: "email_not_configured" }` và log cảnh báo — phù hợp môi trường dev.

Code gửi mail chung: [`lib/mail/resend.ts`](lib/mail/resend.ts) (transport) + [`lib/mail/layout.ts`](lib/mail/layout.ts) (branded shell, i18n vi/en). Handler/builder lo `subject` + nội dung body; `wrapTransactionalEmail` / `wrapBlastEmail` bọc HTML cuối.

## Local

Local secrets dùng chung file [`supabase/functions/.env`](../.env). Khởi tạo từ [`supabase/functions/.env.example`](../.env.example), rồi serve function với:

```bash
supabase functions serve corelia-api --env-file supabase/functions/.env
```

Khi cần sync secrets lên hosted project, có thể dùng `supabase secrets set --env-file supabase/functions/.env` hoặc Dashboard.

Tham khảo: [Supabase Edge Functions secrets](https://supabase.com/docs/guides/functions/secrets).

## Auth mode

Function này có cả op public (IPN) và op yêu cầu đăng nhập trong cùng một entrypoint, nên `verify_jwt` được cấu hình tại [`supabase/config.toml`](../../config.toml) là `false`; các op protected sẽ tự kiểm tra Bearer token trong code.
