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

### OCID và ví liên kết

`ocid.link` yêu cầu `OCID_CLIENT_ID` ở Edge Function, bằng `VITE_OCID_CLIENT_ID` của frontend. Đặt `OCID_SANDBOX=true` trên staging/local khi frontend dùng `VITE_OCID_SANDBOX=true`; production dùng `false`. Server xác minh chữ ký ES256, hạn token và audience trước khi ghi OCID và cộng XP. `wallets.challenge`/`wallets.verify` dùng Origin trong `CORELIA_CORS_ALLOWED_ORIGINS` hoặc `CORELIA_APP_ORIGIN`, challenge 5 phút và chữ ký Ethereum/Solana; không cần bật Supabase Web3 sign-in vì đây là liên kết ví với user hiện tại.

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

`projects.save` accepts optional `primary_content_locale` (`vi`/`en`) and
`locales` (language → title, summary, description, progress). Send both together;
the primary entry supplies canonical text. The RPC commits translations and
project data atomically. Omitted locales preserve stored translations for old
clients. Locale/config writes also enforce ownership, blocks, and submission deadlines.

`projects.translate` accepts `project_id`, `source_locale`, `target_locale`, and
`content` with the four text fields. It returns `{ content }` for review without
saving. It uses `gpt-5.4-mini`, no web tools, and the existing `OPENAI_API_KEY`.
A database reservation limits each authenticated user to 10 attempts per rolling
hour across Edge instances, including failed attempts. Logs contain request ID,
status and provider input/output token counts, never project text. Translation
is optional; provider failures do not prevent manual bilingual editing.

Project text/images use `omni-moderation-latest`. Resource URL fields (demo,
repository, slides, demo video, and pitch video) are validated locally for HTTPS,
length, and safe URL structure; embedded credentials and local/private addresses
are rejected. Repository URLs must have the form `github.com/owner/repo`. Saving
does not fetch resource destinations or use AI/web search to verify or moderate
them. Submitters are responsible for ensuring reviewers can access their links.

### Jobs ingestion và phân loại

| Biến | Bắt buộc? | Ghi chú |
|------|-----------|---------|
| `CORELIA_JOBS_CRON_SECRET` | Có cho lịch tự động | Secret dùng chung giữa `cron-jobs` và op `jobs.runScheduled`; gửi qua header `x-corelia-jobs-cron-secret`. |
| `OPENAI_API_KEY` | Không | Nếu thiếu, pipeline vẫn phân loại deterministic nhưng job mới sẽ vào hàng chờ review, không tự publish. |
| `CORELIA_JOBS_CLASSIFIER_MODEL` | Không | Mặc định `gpt-5.4-mini`; chỉ áp dụng cho job mới hoặc có payload thay đổi. |
| `WEB3_CAREER_API_TOKEN` | Có khi bật source `web3.career` | Token server-side truyền qua query parameter theo API contract; không đưa vào client hoặc log. |
| `CRYPTOJOBS_LIST_API_KEY` | Có khi bật source `CryptoJobsList` | API key server-side truyền bằng header `x-api-key`; không đưa vào client hoặc log. |
| `CORELIA_JOBS_ALERT_WEBHOOK_URL` | Không | HTTPS webhook Slack/Discord cho alert mới; alert vẫn được lưu và hiển thị trong admin khi không cấu hình. |

Admin có thể đọc/cập nhật cấu hình qua `jobs.admin`, chạy thủ công theo
company/source/adapter/all qua `jobs.run`, duyệt job qua `jobs.review`, và tạo
lại snapshot qua `jobs.refreshAnalytics`. Các op này yêu cầu Bearer token của
`admin` hoặc `support_staff`.

Function `cron-jobs` là endpoint tối giản cho scheduler. Cấu hình Supabase Cron
gọi `POST /functions/v1/cron-jobs` mỗi giờ, kèm header
`x-corelia-jobs-cron-secret`; body discovery: `{ "mode": "discovery", "max_targets": 1 }`.
Revalidation dùng `mode: "revalidation"` và không gọi AI; analytics dùng
`mode: "analytics"`. Scheduler
chỉ chọn company đã đến hạn (mặc định mỗi 24 giờ), còn batch nhỏ giúp mỗi Edge
invocation nằm trong giới hạn thời gian khi có nhiều job mới cần phân loại.
Source `web3.career` dùng một crawl-target được quản lý bởi migration và lấy tối
đa 25 job mới nhất mỗi lần chạy. Vì API không có cursor/offset, crawler không
đánh dấu hết hạn chỉ dựa trên việc job vắng khỏi cửa sổ kết quả này.
CryptoJobsList dùng API `/public/jobs`, phân trang tối đa 100 job/request và
gửi credential bằng `x-api-key`; canonical URL của provider được giữ nguyên để
đáp ứng attribution. Source này chỉ được enable sau khi operator review điều
khoản đi kèm access grant.
Himalayas dùng cursor; Remotive và Remote OK dùng public API; We Work Remotely
dùng official RSS; generic RSS/Atom dùng `adapter_config.feed_urls`. Các
aggregate source được seed `max_jobs_per_run = 25` để giữ một lượt Edge crawl
trong giới hạn thời gian và chi phí. Khi cấu hình giới hạn này, response là cửa
sổ rolling và không expire job chỉ vì vắng mặt; chỉ snapshot không bị giới hạn
hoặc `expires_at` do provider cung cấp mới là bằng chứng hết hạn. Mỗi RSS
provider có một `job_sources` policy
instance riêng và các crawl target tham chiếu bằng `source_id`; vì vậy cadence,
attribution, quyền hiển thị mô tả/SEO và log không bị trộn giữa nhiều feed.
Mỗi lượt crawl ghi riêng `ai_failed_count` khi phân loại AI lỗi và phải fallback
về deterministic; số này không bị trộn với `failed_count` của ingestion và là
đầu vào cho alert `classification_failure_spike`.
Expiry do provider cung cấp được lưu và chuyển status trong lần refresh
analytics kế tiếp. Mọi external feed mới được seed disabled để kiểm soát volume
và chi phí phân loại trước khi bật trên Staging.

Nếu thiếu `RESEND_API_KEY` hoặc `MAIL_FROM`, handler **không lỗi**: trả `{ skipped: true, reason: "email_not_configured" }` và log cảnh báo — phù hợp môi trường dev.

Code gửi mail chung: [`lib/mail/resend.ts`](lib/mail/resend.ts) (transport) + [`lib/mail/layout.ts`](lib/mail/layout.ts) (branded shell, i18n vi/en). Handler/builder lo `subject` + nội dung body; `wrapTransactionalEmail` / `wrapBlastEmail` bọc HTML cuối.

### Corelia Studio: tạo khóa AI

| Biến | Bắt buộc? | Ghi chú |
|------|-----------|---------|
| `CORELIA_STUDIO_A1_CATALOG_RESEARCH_OPENAI_API_KEY`, `…_A2_COURSE_RESEARCH_…`, `…_A3_CURRICULUM_…`, `…_A4_CURRICULUM_REVIEW_…`, `…_A5_LESSON_…`, `…_A6_LESSON_REVIEW_…` | Có cho bước của agent tương ứng | Mỗi agent một key OpenAI, đánh số theo thứ tự trong luồng (tên lấy từ `AGENT_NAME`), không dùng `OPENAI_API_KEY` của app. Bước thuộc agent nào lấy theo `STEP_OWNER`; poll dùng key của agent ghi trên `studio_generations`. Thiếu key thì lượt chạy dừng ở bước đó (`draft_failed`, lý do nêu tên biến); lượt chạy khác vẫn chạy. A1 thuộc luồng Catalog, chạy theo catalog job (`studio.catalog_research`), không có bước trong lượt chạy; thiếu key thì job kết thúc `failed`. |
| `CORELIA_STUDIO_CRON_SECRET` | Có cho `studio.tick` | Scheduler gửi qua header `x-corelia-studio-cron-secret`. |

`studio.start` (Bearer, chỉ `profiles.role = admin`; `support_staff` bị từ chối) nhận
`course_id` và `run_id` tùy chọn. RPC `studio_start_run` tạo lượt chạy và 9 bước trong
một transaction; gửi lại cùng `run_id` trả lượt chạy đã có. Khóa nháp (0 path) hoặc
khóa đang `queued`/`generating`/`published` trả 409.

`studio.tick` đẩy tối đa 5 lượt chạy đang mở, mỗi lượt một hành động: gửi yêu cầu
model ở background mode, lấy kết quả, hoặc kết thúc lượt chạy. Mỗi lần gọi model là một
dòng `studio_generations` được chèn trước khi gọi provider (unique theo bước và lượt
thử), nên hai tick chồng nhau không gửi trùng. Prompt nằm trong
[`studio/prompts.ts`](studio/prompts.ts); bước chưa có trong `STEP_SPECS` kết thúc lượt
chạy ở `draft_failed` kèm lý do và người chạy bước (agent hoặc code).

`studio.catalog_research` (Bearer, admin) nhận `course_id` và `job_id` tùy chọn, tạo catalog job `manual` cho khóa
(RPC `studio_start_catalog_job`; gửi lại cùng `job_id` trả job đã có). Khóa không có path hoặc nhóm chưa có
scope trả 409 và không tạo job; khóa đã có job đang chạy trả 409 `course_has_running_job`. `studio.tick` đẩy
thêm tối đa 3 catalog job đang chạy (`catalog` trong phản hồi): A1 gọi với `web_search` giới hạn
`max_tool_calls`, kết quả qua `acceptCatalogResearch`; thiếu `trend`/`demand` thì nghiên cứu lại tối đa
`MAX_CATALOG_RESEARCH_ROUNDS` vòng rồi kết thúc `needs_more_sources`, lỗi kỹ thuật quá ngân sách thử lại thì
`failed`. Trước mỗi attempt mới, chi phí ước lượng (cận trên, theo `usage` đã ghi gồm `web_search_calls`) đạt `CATALOG_JOB_BUDGET_USD` thì job kết thúc `failed`. Job không ghi `studio_run_events`; lý do kết thúc nằm ở `studio_catalog_jobs.reason`.

Local không có scheduler, nên lượt chạy chỉ tiến khi có ai gọi `studio.tick`. Với
`pnpm functions:serve` đang chạy:

```bash
pnpm studio:tick                  # mặc định 15s/lần, tới http://127.0.0.1:54321/functions/v1
pnpm studio:tick --interval 30 --url http://127.0.0.1:54321/functions/v1
```

Script đọc `CORELIA_STUDIO_CRON_SECRET` từ `supabase/functions/.env` lúc khởi động, không
in ra. Mỗi tick log `processed` và hành động của từng lượt chạy; Ctrl+C để dừng.

`studio.start` nhận thêm `resume_from_run_id` (lượt `draft_failed` mới nhất của khóa) để chạy tiếp
từ bản nháp: lượt mới chép các generation đã được chấp nhận (brief, research, curriculum và review
nếu đã xong; lesson đã đạt; bản nháp lesson chưa được review) với `origin = 'resumed'`, chỉ tạo lại
phần còn lại với ngân sách mới. Chi phí của một lượt chạy là tổng `usage` của các dòng `origin = 'ai'`.
Kết quả có `resume` (số bước và lesson đã chép) hoặc `resume_skipped` kèm lý do, khi đó lượt chạy bắt
đầu từ đầu. Kiểm bằng `scripts/studio/verify-resume.ts`.

Các bước sau lesson chạy trong chính tick, không gọi model: `structure_check` kiểm mọi lesson
bằng quy tắc publish của app, vẽ sơ đồ thành PNG vào bucket `studio-drafts` và kiểm link;
`journey_test` kiểm thứ tự học; `publish` ghi `courses`, `course_sections`, `course_lessons`,
`course_section_questions` trong một transaction (`studio_publish_course`), nên trigger
publication của app chặn thì không có gì được ghi và lượt chạy dừng ở `draft_failed` kèm lý do.
Kiểm hai bước cuối với DB local, không tốn model:

```bash
eval "$(npx supabase status -o env)"
SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY deno run -A --no-config scripts/studio/verify-publish.ts
SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY deno run -A --no-config scripts/studio/verify-tick.ts
deno run -A --no-config scripts/studio/measure-diagram.ts <thư mục *.json đặc tả sơ đồ>
```

### Email Center

`email.admin` cung cấp API quản trị contact/list/import, template/version, campaign và automation. `email.worker` chỉ nhận request có `EMAIL_WORKER_SECRET`; `email.webhook` xác minh chữ ký Svix bằng `RESEND_WEBHOOK_SIGNING_SECRET`; `email.unsubscribe` là endpoint public cho marketing unsubscribe. Dữ liệu Email Center chỉ truy cập qua service-role boundary và các bảng không cấp quyền Data API cho `anon`/`authenticated`.

Worker theo lô dùng Resend Batch API, lease từng recipient và idempotency key ổn định. `accepted` không đồng nghĩa `delivered`; delivery/bounce/complaint được cập nhật từ webhook. Hướng dẫn vận hành đầy đủ ở [`docs/EMAIL_CENTER_ADMIN_GUIDE.md`](../../../docs/EMAIL_CENTER_ADMIN_GUIDE.md).

## Local

Local secrets dùng chung file [`supabase/functions/.env`](../.env). Khởi tạo từ [`supabase/functions/.env.example`](../.env.example), rồi serve function với:

```bash
supabase functions serve corelia-api --env-file supabase/functions/.env
```

Khi cần sync secrets lên hosted project, có thể dùng `supabase secrets set --env-file supabase/functions/.env` hoặc Dashboard.

Tham khảo: [Supabase Edge Functions secrets](https://supabase.com/docs/guides/functions/secrets).

## Auth mode

Function này có cả op public (IPN) và op yêu cầu đăng nhập trong cùng một entrypoint, nên `verify_jwt` được cấu hình tại [`supabase/config.toml`](../../config.toml) là `false`; các op protected sẽ tự kiểm tra Bearer token trong code.
