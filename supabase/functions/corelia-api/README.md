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

### Jobs ingestion và phân loại

| Biến | Bắt buộc? | Ghi chú |
|------|-----------|---------|
| `CORELIA_JOBS_CRON_SECRET` | Có cho lịch tự động | Secret dùng chung giữa `cron-jobs` và op `jobs.runScheduled`; gửi qua header `x-corelia-jobs-cron-secret`. |
| `OPENAI_API_KEY` | Không | Nếu thiếu, pipeline vẫn phân loại deterministic nhưng job mới sẽ vào hàng chờ review, không tự publish. |
| `CORELIA_JOBS_CLASSIFIER_MODEL` | Không | Mặc định `gpt-5.4-mini`; chỉ áp dụng cho job mới hoặc có payload thay đổi. |

Admin có thể đọc/cập nhật cấu hình qua `jobs.admin`, chạy thủ công theo
company/source/adapter/all qua `jobs.run`, duyệt job qua `jobs.review`, và tạo
lại snapshot qua `jobs.refreshAnalytics`. Các op này yêu cầu Bearer token của
`admin` hoặc `support_staff`.

Function `cron-jobs` là endpoint tối giản cho scheduler. Cấu hình Supabase Cron
gọi `POST /functions/v1/cron-jobs` mỗi giờ, kèm header
`x-corelia-jobs-cron-secret`; body tùy chọn: `{ "max_targets": 1 }`. Scheduler
chỉ chọn company đã đến hạn (mặc định mỗi 24 giờ), còn batch nhỏ giúp mỗi Edge
invocation nằm trong giới hạn thời gian khi có nhiều job mới cần phân loại.

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
