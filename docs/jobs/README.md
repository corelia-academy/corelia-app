# Corelia Jobs — Setup và vận hành

Tài liệu này là runbook cho phần Jobs đã được triển khai trong repository. Phạm
vi hiện tại gồm catalog public, trang chi tiết, Saved/Applied/Hidden, market
snapshot, admin vận hành nguồn, bốn ATS adapter, sáu external feed adapter,
generic RSS/Atom, pipeline phân loại, revalidation và lịch crawl.

- Thiết kế và phạm vi đầy đủ: [corelia-jobs-complete-implementation-plan.md](./corelia-jobs-complete-implementation-plan.md)
- Checklist kiểm thử: [TEST_CHECKLIST.md](./TEST_CHECKLIST.md)
- Quy trình release chung: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md)

## 1. Những thành phần phải được setup

| Thành phần | Bắt buộc | Mục đích |
|---|---:|---|
| Migration `20260903033132_jobs_mvp_foundation.sql` | Có | Tạo schema, taxonomy, source policy, RLS, grants, lifecycle và market tables |
| Migration `20260903055155_jobs_advisor_remediation.sql` | Có | Bổ sung index phủ foreign key và hợp nhất policy đọc theo khuyến nghị Advisor |
| Migration `20260903062207_normalize_job_ai_quality_score.sql` | Có | Chuẩn hóa output AI dạng tỷ lệ `0–1` về thang quality gate `0–100` và sửa dữ liệu lịch sử bị reject sai |
| Migrations Jobs đến `20260903110012_configure_jobs_schedules.sql` | Có | Thêm Tech/Non-tech, structured feeds, provider-specific RSS, revalidation, operational alerts, CryptoJobsList contract, AI fallback counters và ba lịch Vault-backed |
| Frontend env Supabase | Có | Cho browser đọc catalog/taxonomy và ghi trạng thái Saved/Applied qua RLS |
| Edge Function `corelia-api` | Có để vận hành | Admin CRUD, crawl thủ công, review và refresh analytics |
| Edge Function `cron-jobs` | Có cho tự động hóa | Endpoint nhỏ nhận lịch và gọi `jobs.runScheduled` |
| `CORELIA_JOBS_CRON_SECRET` | Có cho tự động hóa | Xác thực riêng giữa Supabase Cron, `cron-jobs` và `corelia-api` |
| Tài khoản `admin` hoặc `support_staff` | Có để vận hành | Quản lý company/source, chạy crawl và duyệt job |
| Ít nhất một company ATS đã verify | Có để có dữ liệu | Xác định feed tuyển dụng được crawl |
| `OPENAI_API_KEY` | Không | Bật phân loại AI và auto-publish khi vượt quality gate |
| `WEB3_CAREER_API_TOKEN` | Có khi bật web3.career | Credential server-side cho API chính thức của web3.career |
| `CRYPTOJOBS_LIST_API_KEY` | Có khi bật CryptoJobsList | API key server-side gửi bằng header `x-api-key` |
| `CORELIA_JOBS_ALERT_WEBHOOK_URL` | Không | Gửi alert mới đến webhook Slack/Discord; alert vẫn lưu trong admin nếu thiếu |
| Supabase Cron | Không cho local/manual; có cho production tự động | Kích hoạt crawl định kỳ |

Không đưa `SUPABASE_SECRET_KEYS`, `CORELIA_JOBS_CRON_SECRET` hoặc
`OPENAI_API_KEY` vào biến `VITE_*`, source code, log, screenshot hay Git.
`SUPABASE_SECRET_KEYS` là biến mặc định do Edge runtime cung cấp và có quyền bỏ
qua RLS; nó chỉ được dùng trong Edge Function.

## 2. Yêu cầu máy local

- Node.js 22 trở lên.
- pnpm 9 trở lên.
- Docker Desktop hoặc container runtime tương thích Docker đang chạy.
- Dependencies của repository đã được cài bằng `pnpm install`.

Repository quản lý Supabase CLI trong `devDependencies`, vì vậy dùng
`pnpm exec supabase ...` thay vì phụ thuộc vào một CLI global khác phiên bản.

## 3. Setup local từ đầu

### 3.1. Khởi động Supabase và áp dụng migration

Từ root repository:

```bash
pnpm install
pnpm exec supabase start
pnpm exec supabase migration up --local
pnpm exec supabase migration list --local
```

Danh sách migration local phải có các dòng từ `20260903033132` đến
`20260903110012` ở cả cột local và database.
`migration up --local` áp dụng migration còn thiếu mà không chủ động xóa dữ
liệu hiện có.

Khi cần xác minh toàn bộ migration chain trên database local có thể tạo lại:

```bash
pnpm db:verify:local
```

> Cảnh báo: lệnh trên chạy `db reset --local --no-seed`, xóa và tạo lại
> database **local**. Không dùng nó để giữ fixture local. Script có guard từ
> chối URL database không phải localhost và không được dùng với `--linked`.

### 3.2. Cấu hình frontend

Lấy URL và publishable key local bằng:

```bash
pnpm exec supabase status
```

Tạo hoặc cập nhật file local đã được `.gitignore` bảo vệ, ví dụ
`.env.development`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key-tu-supabase-status>
VITE_CORELIA_FUNCTIONS_URL=http://127.0.0.1:54321/functions/v1/corelia-api
```

Có thể dùng `VITE_SUPABASE_ANON_KEY` legacy nếu project chưa chuyển sang
publishable key. Không cấu hình cả hai project khác nhau giữa URL, key và
Functions URL.

Sau khi đổi biến `VITE_*`, dừng và chạy lại Vite vì các biến này được đọc lúc
khởi động/build:

```bash
pnpm dev
```

### 3.3. Cấu hình Edge Functions local

Tạo file secret local từ template:

```bash
cp supabase/functions/.env.example supabase/functions/.env
```

Đặt tối thiểu:

```dotenv
CORELIA_CORS_ALLOWED_ORIGINS=http://localhost:5173
CORELIA_APP_ORIGIN=http://localhost:5173
APP_URL=http://localhost:5173
CORELIA_JOBS_CRON_SECRET=<random-secret-dai-va-khong-dung-lai>
CORELIA_JOBS_CLASSIFIER_MODEL=gpt-5.4-mini
# OPENAI_API_KEY=<optional-server-side-key>
```

`supabase/functions/.env` đã bị Git ignore. Supabase Edge runtime tự cung cấp
`SUPABASE_URL` và `SUPABASE_SECRET_KEYS`; không copy secret backend vào file env
frontend.

Chạy frontend và Functions ở các terminal riêng:

```bash
# Terminal 1
pnpm dev

# Terminal 2
pnpm functions:serve

# Terminal 3, chỉ cần khi test endpoint scheduler
pnpm functions:serve:cron-jobs
```

`corelia-api` và `cron-jobs` phải nhận cùng một giá trị
`CORELIA_JOBS_CRON_SECRET`.

### 3.4. Chuẩn bị tài khoản vận hành

Các thao tác `/admin/jobs/*` chỉ chấp nhận Bearer token của profile có role
`admin` hoặc `support_staff`. Với local/staging, đăng nhập bằng tài khoản test đã
được cấp một trong hai role qua quy trình quản trị hiện có. Không đổi role trực
tiếp trên production chỉ để smoke test.

## 4. Đăng ký company và tạo dữ liệu đầu tiên

Migration seed sẵn bốn source policy đã review: Greenhouse, Lever, Ashby và
SmartRecruiters. Migration **không** seed company thật, nên `/jobs` hiển thị
empty state hợp lệ cho đến khi có company được crawl và job được publish.
Các dòng trong `/admin/jobs/sources` là adapter/policy, không phải feed có thể
tự suy ra công ty. Nếu bấm **Run now** khi source chưa có company active phù
hợp, API chọn `0 target`, không tạo `crawler_runs` và giao diện sẽ cảnh báo thay
vì báo hoàn tất.

`web3.career`, CryptoJobsList, Himalayas, We Work Remotely, Remotive và Remote
OK đã có adapter nhưng được seed disabled để rollout có kiểm soát.
`web3.career` chỉ chạy khi có `WEB3_CAREER_API_TOKEN`; CryptoJobsList chỉ chạy
khi có `CRYPTOJOBS_LIST_API_KEY` và policy của access grant đã được operator
review. Không dùng HTML scraping để thay thế hai API này.

Các aggregate feed được seed `max_jobs_per_run = 25` để một Edge invocation
không phải phân loại hàng nghìn bản ghi. Khi có giới hạn này, feed được xem là
một cửa sổ rolling: job vắng khỏi lượt hiện tại **không** bị expire theo
absence; chỉ `expires_at` do provider cung cấp hoặc một snapshot thật sự đầy đủ
mới được dùng làm bằng chứng hết hạn. Có thể tăng giới hạn sau khi đã đo thời
gian chạy và chi phí trên staging.
Generic RSS/Atom chỉ chấp nhận URL HTTP(S) public; localhost, loopback và dải
IPv4 private/link-local bị từ chối ở cả admin validation lẫn adapter để tránh
biến crawler thành đường truy cập mạng nội bộ.
Analytics và lịch sử market đọc theo page 1.000 dòng với hard cap 100.000;
vượt cap sẽ fail rõ ràng thay vì âm thầm công bố số liệu bị cắt bởi giới hạn
response của PostgREST.

1. Đăng nhập bằng `admin` hoặc `support_staff`.
2. Mở `/admin/jobs/companies` và chọn **Thêm công ty**.
3. Điền `name`, slug duy nhất, ATS, identifier, region và domain.
4. Chỉ bật **Đã xác minh** sau khi kiểm tra company/feed là chính chủ và nằm
   trong chính sách nguồn đã duyệt.
5. Lưu company, sau đó chạy riêng company đó.
6. Kiểm tra `/admin/jobs/crawlers` và `last_error` của company/source.
7. Nếu job vào `review`, mở `/admin/jobs/review` để publish hoặc reject.
8. Mở `/admin/jobs/analytics`, refresh snapshot, rồi kiểm tra `/jobs` và
   `/jobs/market`.

### Cách lấy `source_identifier`

| ATS | URL careers thường gặp | `source_identifier` | `source_region` |
|---|---|---|---|
| Greenhouse | `https://boards.greenhouse.io/acme` | `acme` | `global` |
| Lever | `https://jobs.lever.co/acme` | `acme` | `global` |
| Lever EU | `https://jobs.eu.lever.co/acme` | `acme` | `eu` |
| Ashby | `https://jobs.ashbyhq.com/acme` | `acme` | `global` |
| SmartRecruiters | `https://jobs.smartrecruiters.com/Acme` | `Acme` | `global` |

Identifier là segment của job board, không phải URL đầy đủ. Nên mở thử endpoint
public tương ứng trước khi verify company. Adapter giới hạn tối đa 5.000 job cho
mỗi company/run và timeout mỗi request sau 20 giây; feed vượt giới hạn sẽ fail
closed thay vì ingest một phần không an toàn.

## 5. Hành vi khi có hoặc không có OpenAI

- Có `OPENAI_API_KEY`: job mới hoặc payload đã thay đổi được deterministic
  filter trước, sau đó mới gọi Responses API. Job chỉ auto-publish khi qua
  quality gate.
- Không có key, provider lỗi hoặc output không hợp lệ: crawl vẫn lưu dữ liệu cần
  thiết, nhưng job mới vào `review` với lý do
  `ai_not_configured_or_unavailable`.
- Payload không đổi: không gọi AI lại.
- Job rõ ràng không thuộc phạm vi kỹ thuật: deterministic filter reject mà
  không gọi AI.

Vì vậy, thiếu OpenAI không được xử lý bằng cách đưa key vào browser. Với local
QA có thể chạy hoàn toàn không có key và kiểm tra flow review thủ công.

## 6. Setup hosted/staging/production

Backend và frontend có pipeline release tách biệt. Làm theo
[quy trình release của repository](../RELEASE_PROCESS.md), không chạy lệnh ghi
remote tùy ý ngoài flow được phê duyệt.

Thứ tự vận hành:

1. Đưa migration Jobs vào approved pending migration set của release và làm
   `pnpm db:verify` xanh. Không sửa frozen baseline để né guardrail.
2. Apply migration trên môi trường đích qua workflow Supabase của repository.
3. Deploy cả `corelia-api` và `cron-jobs` từ cùng commit.
   Workflow kiểm tra `CORELIA_JOBS_CRON_SECRET` tồn tại trước khi deploy và
   fail sớm nếu runtime setup chưa đầy đủ.
4. Giữ nguyên các biến dùng chung hiện có (`CORELIA_CORS_ALLOWED_ORIGINS`,
   `CORELIA_APP_ORIGIN`, `APP_URL`) và thêm Jobs secrets trên đúng project.
   Có thể dùng Dashboard, hoặc tạo một file untracked `.env.jobs.hosted` chỉ
   chứa các giá trị cần sync:

   ```dotenv
   CORELIA_JOBS_CRON_SECRET=replace-with-a-strong-random-secret
   CORELIA_JOBS_CLASSIFIER_MODEL=gpt-5.4-mini
   # OPENAI_API_KEY=replace-with-a-server-side-key
   ```

   Sau đó sync file vào project đã link:

   ```bash
   pnpm exec supabase secrets set --env-file .env.jobs.hosted
   ```

   Nếu không dùng AI, bỏ hẳn đối số `OPENAI_API_KEY`; không đặt chuỗi giả.
5. Publish frontend riêng với `VITE_SUPABASE_URL`, publishable key và Functions
   URL trỏ đúng cùng môi trường.
6. Đăng ký một company test được phê duyệt, manual crawl và hoàn tất smoke test
   trước khi bật lịch định kỳ.

Supabase cung cấp `SUPABASE_URL` và `SUPABASE_SECRET_KEYS` mặc định cho hosted
Edge Functions. Không cố tạo secret tên `SUPABASE_*` thủ công vì prefix này do
platform quản lý.

## 7. Cấu hình Supabase Cron

Migration `20260903110012_configure_jobs_schedules.sql` quản lý ba lịch với
batch nhỏ; handler chỉ chọn company thực sự đến hạn theo cadence mặc định 24
giờ. Cấu hình này phân tán tải thay vì crawl mọi company trong một invocation
dài và tránh live configuration drift.

1. Bật `pg_cron` và `pg_net` trong project nếu chưa có.
2. Lưu project URL và cron secret trong Supabase Vault.
3. Apply migration cuối. Migration thay mọi lịch Jobs cũ bằng ba schedule gọi
   `POST /functions/v1/cron-jobs`: discovery lúc phút 7 mỗi giờ, revalidation
   lúc phút 17 mỗi 6 giờ, và analytics lúc 04:30 UTC hằng ngày. Cadence trong
   DB vẫn quyết định target nào thực sự đến hạn.

Template SQL sau dùng tên Vault riêng cho Corelia Jobs:

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co',
  'corelia_jobs_project_url'
);

select vault.create_secret(
  '<same-value-as-CORELIA_JOBS_CRON_SECRET>',
  'corelia_jobs_cron_secret'
);

```

Các câu lệnh trên chỉ tạo/rotate Vault secret; không copy scheduler secret vào
migration. Hai workflow staging/production chạy
`scripts/db/verify-jobs-scheduler-vault.sql` sau migrations và dừng release nếu
một trong hai giá trị thiếu, rỗng hoặc project URL không hợp lệ. Guard này chỉ
kiểm tra trong database, không in giá trị secret ra log.

Sau khi migration chạy, kiểm tra đúng ba lịch và không còn lịch cũ:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname like 'corelia-jobs%';
```

Kiểm tra kết quả gần nhất trong `cron.job_run_details`, `net._http_response`,
Edge Function logs và `/admin/jobs/crawlers`. Không coi HTTP `207` là success
toàn phần: nó có nghĩa invocation chạy được nhưng có ít nhất một company thất
bại.

## 8. Xử lý lỗi “Không thể tải danh sách việc làm”

Empty state hợp lệ hiển thị thông báo không có job phù hợp. Khung lỗi màu đỏ
“Không thể tải danh sách việc làm” nghĩa là ít nhất một query `jobs`, taxonomy
hoặc quan hệ `job_sources` đã thất bại.

Kiểm tra theo thứ tự:

1. DevTools → Network, mở request REST thất bại và ghi lại status/error code.
2. Xác nhận app đang trỏ đúng project:
   - `VITE_SUPABASE_URL` và publishable/anon key cùng project;
   - `VITE_CORELIA_FUNCTIONS_URL` cùng môi trường;
   - restart Vite sau khi đổi env.
3. Xác nhận migration có trên database đó:

   ```bash
   pnpm exec supabase migration list --local
   ```

   Với hosted project, dùng live-history workflow/read-only check theo release
   process; không tự apply SQL production trong lúc debug.
4. Nếu local stack có từ trước khi migration Jobs được thêm, chạy:

   ```bash
   pnpm exec supabase migration up --local
   ```
5. Hard reload và thử lại `/jobs`.

Các lỗi thường gặp:

| Dấu hiệu | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `PGRST205`, relation/table không tồn tại | Migration Jobs chưa apply hoặc schema cache của sai project | Apply migration đúng môi trường; kiểm tra lại project URL |
| `permission denied` | Migration/grants chưa đủ hoặc migration dở dang | Chạy migration chain và integration gate; không tắt RLS |
| Taxonomy load lỗi nhưng bảng tồn tại | URL/key trỏ khác project hoặc explicit Data API grants chưa có | Đối chiếu env; xác minh grant của migration Jobs |
| `/jobs` có 0 item nhưng không có khung đỏ | Chưa có company/job active hợp lệ | Đăng ký company, crawl, review/publish |
| Admin op trả `401` | Chưa đăng nhập, token hết hạn hoặc function URL sai | Đăng nhập lại và kiểm tra Network Authorization |
| Admin op trả `403` | Profile không phải `admin`/`support_staff` | Dùng đúng tài khoản vận hành |
| Run có `source_http_404` | Sai ATS hoặc `source_identifier` | Kiểm tra endpoint public của ATS |
| Run có `job_source_not_enabled` | Source tương ứng đang disabled | Review policy rồi enable lại source |
| Job luôn vào review | Company chưa verify, source policy chưa review hoặc AI không sẵn sàng | Xem `review_reason`; không bỏ qua quality gate |
| Market page rỗng | Chưa có snapshot analytics | Chạy crawl hoặc **Refresh analytics** |
| Scheduler trả `401` | Secret thiếu/khác nhau hoặc sai header | Đồng bộ secret, dùng đúng `x-corelia-jobs-cron-secret` |

## 9. Kiểm tra nhanh sau setup

```bash
pnpm vitest run \
  supabase/functions/corelia-api/jobs/adapters.test.ts \
  supabase/functions/corelia-api/jobs/classify.test.ts \
  supabase/functions/corelia-api/jobs/normalization.test.ts
pnpm db:verify:local
pnpm lint
pnpm build
```

Sau automated checks, chạy smoke flow tối thiểu:

1. Anonymous mở `/jobs`: không có request lỗi; empty state hoặc danh sách đều hợp
   lệ.
2. Staff thêm một company, manual crawl và thấy run kết thúc.
3. Staff xử lý review nếu có; job active xuất hiện public.
4. User lưu job, đánh dấu đã ứng tuyển và thấy đúng ở `/jobs/saved` và
   `/jobs/applied`.
5. Staff refresh analytics; `/jobs/market` có snapshot.
6. Gọi cron với secret sai nhận `401`; secret đúng nhận `200` hoặc `207` có body
   giải thích từng company.

Checklist đầy đủ và mẫu evidence nằm tại [TEST_CHECKLIST.md](./TEST_CHECKLIST.md).

## 10. Tài liệu nền tảng

- [Supabase local development](https://supabase.com/docs/guides/local-development)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Scheduling Edge Functions với `pg_cron`, `pg_net` và Vault](https://supabase.com/docs/guides/functions/schedule-functions)
- [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
