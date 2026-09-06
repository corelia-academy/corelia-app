# Corelia Agent Guide

## Project

Corelia is a multilingual learning and credential platform. The browser app uses Supabase for auth, data, storage, realtime, and backend functions.

## Stack

- Node 22+, pnpm 9+, TypeScript (strict), Vite, React 19, React Router 7
- Tailwind CSS 4, Base UI/shadcn-style primitives, i18next
- Zustand for client auth/loading state
- Supabase Postgres/Auth/Storage/Realtime/Edge Functions
- Vitest, ESLint; Cloudflare Workers/Wrangler for the frontend artifact

## Repository Structure

- `src/` — SPA routes, feature pages, shared UI, stores, and client data helpers. Read `src/AGENTS.md` before changing it.
- `supabase/` — migrations, local config, email templates, and Edge Functions. Read `supabase/AGENTS.md` before changing it.
- `scripts/db/` — migration-baseline, drift, live-state, and release verification tools.
- `docs/` — specialized architecture, design, QA, and release references; open only the document relevant to the task.
- `.github/workflows/` — executable source of truth for repository CI and Supabase releases.

Use progressive disclosure: this file → nearest nested `AGENTS.md` → one relevant specialized doc → representative source/tests. Do not scan all migrations, pages, or historical reports by default.

## Architecture Rules

- Routes and guards are assembled in `src/App.tsx`; preserve existing paths, params, redirects, and lazy-loading unless the task changes them.
- Pages compose UI. Put reusable client data access/domain helpers in `src/lib/`, feature effects and synchronization in hooks, and shared primitives in `src/components/`.
- Auth is Supabase-backed. Consume `useAuth()`/`useAuthStore` and existing guards instead of adding session listeners or role logic in pages.
- Browser-safe operations use existing `src/lib` Supabase helpers. Privileged or secret-bearing operations belong in the existing Edge Function/API boundary.
- Search for an existing page, hook, component, helper, RPC, or Edge operation before creating another implementation.
- Share code only after there is a real cross-feature consumer; do not expose another feature's private implementation.

## Development Rules

- Implement the smallest coherent change and keep unrelated formatting/refactors out of the diff.
- Follow neighboring naming, imports, error handling, and test patterns before introducing an abstraction.
- Prefer modifying existing APIs and components; preserve public behavior unless the task requires a contract change.
- Do not add dependencies unless existing tooling cannot reasonably solve the task. Keep dependency versions and `pnpm-lock.yaml` consistent.
- Client environment variables use `import.meta.env` and the `VITE_` prefix. Never commit credentials, service-role keys, or populated `.env` files.

## Validation

Run the smallest relevant check first, then broaden in proportion to risk:

1. Targeted test: `pnpm vitest run path/to/file.test.ts`
2. Relevant/full tests: `pnpm test`
3. Lint: `pnpm lint`
4. Typecheck plus production-neutral build: `pnpm build`
5. Mode-specific artifact when relevant: `pnpm build:staging` or `pnpm build:prod`

Database changes additionally use `pnpm db:verify`; schema/migration changes require the isolated local stack check documented in `supabase/AGENTS.md`. Do not require the full suite for documentation-only or narrowly scoped changes unless CI parity or risk warrants it.

## Git and Remote Workflow

- Before editing, check the current branch and worktree. Never discard, rewrite, or include changes outside the task.
- Before commit, review `git status` and the relevant `git diff`; before push, check for secrets and accidental files.
- Do not force-push shared/protected branches, rewrite public history, bypass checks, or disable tests to make CI green.
- Repository flow is normally `work branch → staging → PR from staging to main → main`.
- `.github/workflows/deploy-staging.yml` auto-runs only for pushes to `staging` matching its Supabase path filters; it verifies and deploys Supabase migrations/functions, not the frontend.
- `.github/workflows/db-guardrails.yml` runs on matching PR changes. The live-history workflow is manual and read-only.
- Production Supabase deployment is a manual dispatch of `.github/workflows/deploy-prod.yml` from `main`; merging to `main` does not trigger it automatically.
- Frontend publication to Cloudflare is a separate pipeline not defined in this repository. Require external pipeline/deployment evidence before claiming frontend deployment success.
- For remote delivery, follow `docs/RELEASE_PROCESS.md` and watch every applicable run to a terminal result. Inspect the failed step before retrying; fix only task-related failures and report unrelated failures as blockers.

## Definition of Done

Local Done means requested behavior is implemented, relevant edge cases/checks pass, and the diff is reviewed. It is the final state for local-only tasks.

For an explicitly requested remote release, Done requires: local validation green → pushed through the repository branch flow → applicable Staging checks/deploy green → PR checks green and merge to `main` → manually triggered Production workflow green → separate frontend deployment and post-deploy checks green when the task changes the frontend. Pending, queued, skipped-but-required, cancelled, or failed gates are not Done.

## QA Tracking — Issue #361 (Staging)

Source of truth: [Issue #361](https://github.com/corelia-academy/corelia-app/issues/361)

Mục tiêu: Kiểm thử backend Jobs trên Staging từ schema/RLS, nguồn ATS đến ingestion, dedup và quality gate.

Nguồn chuẩn: Corelia Jobs Test Checklist, phần 2–5.

### Cách hướng dẫn QA theo ELI5

Áp dụng cho toàn bộ Jobs issue #361, #362, #363, #364 và bug con #375.

- Trước khi hướng dẫn, đọc lại `AGENTS.md`, issue đang test, comment mới nhất và checklist tương ứng.
- Trước mỗi test, luôn nói rõ 3 ý:
  1. Đang kiểm tra chức năng gì.
  2. Vì sao chức năng đó quan trọng.
  3. Cần dùng tài khoản và dữ liệu nào.
- Mỗi lần chỉ hướng dẫn một yêu cầu trong GitHub. Không đưa nhiều yêu cầu trong cùng một lần.
- Mỗi bước chỉ có một hành động. Ví dụ: “Mở `/jobs`”, sau đó mới đến bước kiểm tra kết quả.
- Sau mỗi bước phải ghi ngay kết quả mong đợi bằng câu đơn giản.
- Khi dùng thuật ngữ tiếng Anh, phải giải thích ngay bằng tiếng Việt. Ví dụ:
  - RLS (bảo mật theo từng dòng dữ liệu).
  - Fixture (dữ liệu mẫu dùng để test).
  - Evidence (bằng chứng kiểm thử).
  - Regression (kiểm thử chức năng cũ sau khi có thay đổi mới).
- Không dùng số lượng dữ liệu làm điều kiện Pass nếu issue không yêu cầu con số cố định.
- Dùng anonymous (chưa đăng nhập) để test hành vi public. Dùng user thường để test quyền cá nhân. Dùng admin/support để test vận hành. Không dùng admin để kết luận user thường đã Pass.
- Chỉ test trên Staging. Không tạo, sửa hoặc xóa dữ liệu trên Production.
- Không yêu cầu người dùng gửi password, token, API key, cookie, PII hoặc secret.
- Chỉ kết luận PASS khi toàn bộ điều kiện của đúng yêu cầu đã được kiểm tra.
- Nếu mới kiểm tra được một phần, ghi rõ `Positive PASS / Negative BLOCKED`.
- Nếu FAIL:
  1. Không sửa code ngay.
  2. Hỏi actual result (kết quả thực tế) và expected result (kết quả mong đợi).
  3. Hướng dẫn chạy lại tối thiểu 2 lần.
  4. Ghi route, commit, account role, fixture ID và run ID.
  5. Kiểm tra Console/Network nhưng phải che dữ liệu nhạy cảm.
  6. Phân loại Critical/High/Medium/Low.
- Nếu BLOCKED:
  1. Nói rõ đang thiếu gì.
  2. Không đánh dấu PASS.
  3. Không tự ý thay đổi dữ liệu để làm test chạy được.
- Nếu phát hiện bug:
  1. Kiểm tra trước xem đã có bug issue tương tự chưa.
  2. Nếu trùng #375 thì cập nhật theo bug đó, không tạo issue mới.
  3. Nếu là bug mới, chuẩn bị nội dung sub-issue và xin xác nhận trước khi gửi lên GitHub.
- Không sửa code, thêm file, xóa file hoặc đổi cấu trúc project trong quá trình test nếu chưa có YES.
- Sau mỗi test case, báo cáo theo mẫu: `PASS/FAIL/BLOCKED`, `Actual`, `Expected`, `Evidence`, `Bug ID hoặc Blocker`, `Trạng thái checkbox`.
- Sau khi báo cáo, phải dừng lại và chờ người dùng xác nhận trước khi chuyển sang yêu cầu tiếp theo.

### Release candidate

- Backend/migrations Staging: `4b3ca8e2ebd41d63650278185196ac79396e8026`
- [x] Deploy Staging #355 pass.
- [x] Latest migration `20260903111914_jobs_sitemap_public_projection`.
- [x] Hậu kiểm: 19 Jobs relations, RLS bật đầy đủ và Security Advisor không có Jobs-specific WARN/ERROR.

### Chuẩn bị fixture

- [x] Có tài khoản admin/support và anonymous session; không dùng dữ liệu Production hoặc PII thật.
- [x] Tạo tối thiểu một company test đã verify cho Greenhouse, Lever, Ashby và SmartRecruiters khi có identifier an toàn.
- [ ] Ghi source/company/job/run IDs để đối chiếu và dọn dữ liệu sau test.

### Schema, grants và RLS

- [ ] Anonymous chỉ đọc job active, chưa hết hạn, thuộc source đã review và company active/verified.
- [ ] Anonymous/authenticated không đọc được raw payload, classification evidence, crawler run hoặc source coverage.
- [ ] Browser không ghi trực tiếp được Jobs operational tables; Saved/Applied chỉ tác động record của chính user.
- [ ] Admin/support đọc được trạng thái review/inactive cần cho vận hành; user thường không vượt policy public.

### Hướng dẫn test chi tiết — `Anonymous chỉ đọc job active, chưa hết hạn, thuộc source đã review và company active/verified.`

Test ID: `JOB-361-01`.

Mục tiêu: xác nhận anonymous chỉ thấy Job đáp ứng đủ visibility gate; không dùng số lượng 41 hoặc 67 làm expected result cố định.

Điều kiện trước khi test:

- Chỉ dùng `https://staging.corelia.academy/`.
- Commit cần test: `4b3ca8e2ebd41d63650278185196ac79396e8026`.
- Có một tab admin/support để đối chiếu trạng thái và một phiên anonymous riêng để mở catalog.
- Không dùng Production, PII, password, token, cookie hoặc API key.

Account role cần dùng:

- Anonymous: mở `/jobs` và kiểm tra dữ liệu public.
- Admin/support: chỉ dùng để đối chiếu source/company; không dùng quyền admin để kết luận anonymous đã Pass.

Fixture dương tính (positive case):

- Company: `Consensys`, ATS `Greenhouse`, identifier `consensys`.
- Company phải hiển thị `Đã xác minh`, đang active và có Job đang mở.
- Greenhouse source phải hiển thị đang bật và policy có dấu `✓`.
- Job tham chiếu: `Senior Software Engineer: Social & AI - MetaMask`.

Các bước thao tác và expected result:

1. Mở `https://staging.corelia.academy/jobs` bằng phiên anonymous.
   Expected: trang mở được, có nút `Đăng nhập`, không có quyền Admin và không có lỗi tải danh sách.

2. Ghi lại số Job đang hiển thị.
   Expected: danh sách public hiển thị các Job hiện có. Con số có thể là 41, 67 hoặc số khác theo dữ liệu Staging tại thời điểm test; không dùng con số snapshot làm điều kiện Pass/Fail.

3. Tìm và mở Job `Senior Software Engineer: Social & AI - MetaMask`.
   Expected: Job mở được, hiển thị company `Consensys`, source `Greenhouse`, posted time và trạng thái chưa hết hạn theo dữ liệu hiển thị.

4. Chuyển sang tab admin `/admin/jobs/companies`.
   Expected: `Consensys` hiển thị `Đã xác minh`, active và có Job đang mở.

5. Mở `/admin/jobs/sources`.
   Expected: `Greenhouse` hiển thị đang bật, policy đã review và có target active/verified.

6. Đối chiếu Job vừa mở với bốn điều kiện: active, chưa hết hạn, source đã review/enabled, company active/verified.
   Expected: cả bốn điều kiện đều đúng.

7. Chụp ảnh trang anonymous, Job detail và hai màn hình đối chiếu admin; kiểm tra Console không có lỗi. Không chụp hoặc ghi secret.
   Expected: evidence đủ để truy ngược Job, company, source và thời điểm test.

Kiểm tra âm tính (negative case) bắt buộc để kết luận đầy đủ:

1. Dùng một Job test active thuộc company inactive/unverified hoặc source disabled/unreviewed.
2. Mở lại `/jobs` bằng anonymous và tìm Job đó.
3. Refresh trang và thử mở URL detail của Job.
   Expected: Job không xuất hiện trong catalog public và không mở được như một Job public.
4. Khôi phục trạng thái fixture sau test.

Fixture âm tính đã thực hiện trên Staging bằng `Consensys`: tạm thời tắt company khi Job đang public, kiểm tra bằng anonymous thì Job bị ẩn/không truy cập được, sau đó bật lại company và xác nhận Job xuất hiện lại. Fixture đã được khôi phục về trạng thái active/verified. Hai fixture `Dun & Bradstreet QA - Lever` và `SmartRecruiters QA` vẫn có 0 open jobs và `Chưa từng crawl`; lỗi crawl Lever được theo dõi riêng ở #375.

Điều kiện Fail:

- Anonymous thấy Job của company inactive/unverified.
- Anonymous thấy Job thuộc source disabled/unreviewed.
- Job đã hết hạn vẫn xuất hiện.
- Company/source hợp lệ nhưng Job không hiển thị.
- Catalog hoặc Job detail trả lỗi REST/API không mong đợi.

Evidence cần ghi:

- Environment, route, commit, account role, thời điểm test.
- Job URL/identifier, company identifier, source identifier; crawler run ID không áp dụng cho test public catalog.
- Ảnh catalog, Job detail, company/source status và Console.
- Nếu FAIL: actual result, expected result, HTTP status/response sau khi che secret.

Kết luận lần test hiện tại:

- Positive case: PASS — anonymous đã mở được catalog và Job hợp lệ của Consensys.
- Negative case: PASS — khi tắt company Consensys, Job bị ẩn với anonymous; khi bật lại, Job xuất hiện lại.
- Toàn bộ checklist item: PASS — đủ positive và negative evidence; có thể tích checkbox trên GitHub Issue #361.

### ATS adapters

- [ ] Greenhouse, Lever, Ashby và SmartRecruiters map đúng title, URL, location, posted time và pagination.
- [ ] URL/source identifier sai, timeout, HTTP lỗi và payload sai shape fail closed, có error rõ và không publish dữ liệu dở.
- [ ] Feed không phân trang vượt safety cap bị từ chối; không âm thầm cắt feed rồi expire job hợp lệ.

### Ingestion, dedup và quality gate

- [ ] Payload mới tạo raw audit, normalized job, source link, classification và lifecycle event đúng thứ tự.
- [ ] Chạy lại payload không đổi không tạo raw version/job/event trùng; ranking freshness vẫn được cập nhật.
- [ ] Canonical URL/fingerprint gộp duplicate đúng; tracking params bị bỏ và chỉ chấp nhận URL HTTP(S).
- [ ] Salary/currency/range sai bị bỏ thay vì tự suy đoán; mô tả/script nguy hiểm không được render thực thi.
- [ ] Thiếu field thiết yếu vào rejected/review; classification confidence thấp vào review; đạt gate mới active.
- [ ] Lỗi từng job tăng `failed_count`, run thành `partial`, coverage không được đánh dấu thành công và target được retry.
- [ ] Job biến mất khỏi feed chỉ expire sau điều kiện coverage/crawl thành công theo checklist.

### Hoàn tất

- [ ] Ghi endpoint, fixture ID, response/status, log và ảnh bằng chứng cho từng lỗi.
- [ ] Tách mỗi lỗi thành bug issue và liên kết vào comment của issue này.
- [ ] Dọn fixture test; kết luận Pass/Fail/Blocked.

### Ghi chú trạng thái kiểm thử

- Lever crawl failure đã được tạo thành sub-issue [#375](https://github.com/corelia-academy/corelia-app/issues/375): `[Bug] [Jobs][Staging][Lever] Company crawl fails with generic error and creates no crawler run`.
- Không dùng dữ liệu Production, PII, password, token, cookie hoặc API key trong kiểm thử.
- Chỉ tích checkbox khi kết quả đúng với nguyên văn checklist; nếu thiếu fixture hoặc thiếu evidence thì để unchecked và ghi Blocked.

### Timeline

- 2026-09-04: Tái hiện lỗi Lever trên Staging ít nhất hai lần và tạo sub-issue #375. Không sửa code hoặc cấu trúc project.

## QA Tracking — Jobs Issues #362–#364 (Staging)

Cập nhật theo trạng thái GitHub ngày 2026-09-04. Phạm vi QA Jobs hiện tại gồm
#361–#364 và bug con #375. Các issue #356–#359 và #333 thuộc luồng Hackathon,
Project hoặc Course, không trộn vào kế hoạch Jobs này.

Nguồn chuẩn:

- [Issue #362](https://github.com/corelia-academy/corelia-app/issues/362)
- [Issue #363](https://github.com/corelia-academy/corelia-app/issues/363)
- [Issue #364](https://github.com/corelia-academy/corelia-app/issues/364)
- [Bug #375](https://github.com/corelia-academy/corelia-app/issues/375)

Baseline chung:

- [ ] Tất cả manual checklist item chỉ được tích sau khi có evidence thực tế.
- [ ] Mỗi lượt chỉ hướng dẫn một checklist item; kết luận bắt buộc là PASS,
  FAIL hoặc BLOCKED.
- [ ] Khi FAIL, tái hiện tối thiểu 2 lần, ghi route, commit, role, fixture/run
  ID, actual/expected result, Console/Network đã che dữ liệu nhạy cảm.
- [ ] Khi FAIL ổn định, kiểm tra bug issue/sub-issue trùng trước khi tạo bug
  con mới. Việc gửi issue/comment GitHub phải được xác nhận ngay trước thao tác.
- [ ] Không test ghi dữ liệu trên Production; không ghi password, token, API key,
  cookie, PII hoặc secret vào evidence.

### Issue #362 — Admin, review, analytics và scheduler

Trạng thái: Open. Release candidate Staging là `4b3ca8e2ebd41d63650278185196ac79396e8026`.

#### Release và precondition scheduler đã có evidence

- [x] Deploy Staging #355 pass.
- [x] `corelia-api` ACTIVE version 95; `cron-jobs` ACTIVE version 4.
- [x] `CORELIA_JOBS_CRON_SECRET` và `OPENAI_API_KEY` hiện diện ở Staging/Main;
  không ghi giá trị.
- [x] `CORELIA_JOBS_CLASSIFIER_MODEL` không đặt; runtime dùng
  `gpt-5.4-mini` mặc định.
- [x] `pg_cron` và `pg_net` đã cài trên Staging; có 3 Jobs schedule active.
- [x] Scheduler secret được workflow xác nhận, không đưa giá trị vào issue/log/
  screenshot.
- [x] Discovery, revalidation và analytics schedule active theo migration.
- [ ] Ghi cron job ID, schedule và evidence lần chạy; không tạo/chạy schedule
  trên Main trong phiên QA Staging.

#### Admin và review cần kiểm thử

- [ ] User thường/anonymous bị chặn khỏi `/admin/jobs/*` và các operation
  `jobs.admin`, `jobs.run`, `jobs.review`, `jobs.refreshAnalytics`.
- [ ] Admin/support list, tạo/sửa company, bật/tắt source và validate
  identifier/URL đúng.
- [ ] Run source/company/all tạo crawler run đúng target; chống double submit và
  hiển thị partial/failed rõ.
- [ ] Review publish/reject cập nhật status, override và lifecycle event; reload
  không mất trạng thái.
- [ ] Refresh analytics tạo aggregate daily/role/skill/domain idempotent, không
  double count khi chạy lại.

#### Scheduler và secret boundary cần kiểm thử

- [ ] `GET cron-jobs` trả 405; `POST` thiếu/sai secret trả 401; không lộ secret
  trong body/log.
- [ ] `POST` đúng secret gọi được `jobs.runScheduled`, chỉ chọn target due/active/
  reviewed và tôn trọng `max_targets`.
- [ ] Một target lỗi trả partial/HTTP 207; target còn lại tiếp tục và target lỗi
  được retry.
- [ ] Cron tạo run với `trigger_type=scheduled`, không crawl dồn mọi company.
- [ ] OpenAI thành công/thất bại/timeout đều đi qua quality gate; fallback
  deterministic không tự publish payload malformed.

#### Hoàn tất issue #362

- [ ] Ghi tester, thời gian, run IDs và Edge logs đã redact (che dữ liệu nhạy
  cảm), cùng kết quả PASS/FAIL/BLOCKED.
- [ ] Tách bug thành bug issue, liên kết về #362 và dọn fixture/schedule test.

### Issue #363 — Catalog, detail, Saved/Applied và market

Trạng thái: Open. Frontend Staging đã publish đúng commit `4b3ca8e`.

#### Catalog `/jobs`

- [ ] Anonymous mở catalog, skeleton/empty/error state đúng và chỉ thấy Job
  public hợp lệ.
- [ ] Search hỗ trợ từ khóa có dấu/không dấu; filter role/domain/skill/remote/
  seniority/location/salary kết hợp đúng.
- [ ] Salary open-ended và giá trị 0 không bị hiểu sai; currency/period không tự
  suy đoán.
- [ ] Sort ranking/newest và infinite scroll ổn định; batch 24 tự tải khi cuộn,
  không duplicate/missing và không thêm `?page` vào URL.
- [ ] Card hiển thị company, location, remote, seniority, salary, skills và
  attribution đúng; external link an toàn.

#### Detail và apply

- [ ] `/jobs/:slug` render đúng; slug sai, expired hoặc private trả Not Found.
- [ ] Description HTML đã sanitize; payload HTML/script/JSON-LD không thoát thẻ
  hoặc chạy mã.
- [ ] Canonical/meta/JobPosting JSON-LD đúng dữ liệu; nguồn cấm SEO không index
  và không phát minh salary.
- [ ] Apply mở HTTPS đúng, ghi event/state Applied theo thiết kế và không mất
  attribution.

#### Saved, Applied và Hidden

- [ ] Anonymous được yêu cầu đăng nhập và quay lại đúng route/action.
- [ ] User save/unsave, Applied/unapplied và Hidden idempotent; reload/multi-tab
  không tạo record trùng.
- [ ] `/jobs/saved` và `/jobs/applied` chỉ có dữ liệu user hiện tại; account khác
  không đọc/sửa được.
- [ ] Hidden không xuất hiện ở catalog; `/jobs/hidden` có `Show job again`; Saved/
  Applied giữ đúng timestamps.

#### Market `/jobs/market`

- [ ] Daily summary, role, skill và domain charts/cards khớp aggregate DB của
  fixture đã biết.
- [ ] Empty/loading/error, date window và locale/number formatting đúng; không có
  NaN hoặc timezone lệch ngày.
- [ ] Refresh analytics không double count; frontend đọc dữ liệu mới sau
  invalidation/reload.

#### Hoàn tất issue #363

- [ ] Ghi browser/device, account role, route/query, fixture IDs, Console/Network
  error và ảnh/video evidence.
- [ ] Tách bug issue và liên kết vào comment; kết luận PASS/FAIL/BLOCKED.

### Issue #364 — i18n, responsive, accessibility, security và release sign-off

Trạng thái: Open. Automated release evidence đã xanh; issue còn mở cho các ca
kiểm thử human-device và accessibility chưa được xác nhận.

#### Automated evidence đã có

- [x] Deploy Staging #355 pass với tests, lint, build, migration, SQL integration,
  Security Advisor và Edge deploy.
- [x] 265 application tests, 149 DB guard tests và clean SQL integration pass.
- [x] Migration `20260903111914`, 19 Jobs relations và RLS đã kiểm tra.
- [x] Secret scan sạch; secret cần thiết có ở Staging/Main nhưng không ghi giá trị.
- [x] Cloudflare Workers Builds `corelia-staging` publish đúng `4b3ca8e`.
- [x] Scheduler preconditions hoàn tất.

#### i18n, responsive và accessibility cần kiểm thử

- [ ] Jobs public/admin có VI/EN, không lộ translation key hoặc hard-coded copy
  sai locale.
- [ ] Kiểm tra 1440px, 1024px, 768px, 390px và zoom 200%; không overflow/content
  loss.
- [ ] Filter, card, infinite scroll, table/chart/admin actions không chồng lấn;
  keyboard/focus order hợp lý.
- [ ] Icon-only control có accessible name; selected/disabled/status không chỉ
  dựa vào màu; contrast light/dark rõ.

#### Security và regression cần kiểm thử

- [ ] Anonymous/user thường không truy cập operational data/admin operations;
  staff boundary đúng role.
- [ ] Account A không đọc/sửa `user_jobs` của account B, kể cả REST trực tiếp.
- [ ] URL chỉ HTTP(S), tracking normalization không đổi canonical identity sai;
  external link dùng rel an toàn.
- [ ] Description/summary/company data chứa XSS payload không chạy trong UI, meta
  hoặc JSON-LD.
- [ ] Thiếu/sai cron secret fail closed; service-role/OpenAI key không xuất hiện
  trong bundle, Network, log hoặc screenshot.
- [ ] Route/sidebar/prefetch cũ không regression; auth guard, language switch và
  navigation hiện hữu vẫn hoạt động.
- [ ] Security Advisor không có database WARN/ERROR mới do Jobs; tách riêng
  warning Auth leaked-password protection.

#### Release sign-off cần hoàn tất

- [ ] Liên kết #361, #362, #363 và mọi bug phát hiện trong comment tổng kết.
- [ ] Ghi tester, thời gian, browser/device, fixture/run IDs và PASS/FAIL/BLOCKED.
- [ ] Xác nhận fixture đã dọn, không thay đổi Main/Production và không tác động
  dữ liệu ngoài phạm vi.
- [ ] Chỉ đóng khi mọi manual item pass hoặc blocker có owner/kế hoạch xử lý.

### Bug tracking — #375 Lever crawl

Trạng thái: Open, parent issue #361, label bug, đề xuất mức P1.

- Môi trường: Staging; commit `4b3ca8e`; route `/admin/jobs/companies`.
- Fixture: `Dun & Bradstreet QA - Lever`, ATS Lever, identifier `dnb`, company
  verified/active, source ID `c7c7348e-535a-49ee-bf4c-58768003f646`.
- Actual: nút `Chạy ngay` hiện toast generic “Không thể hoàn tất thao tác.”,
  company vẫn 0 open jobs/“Chưa từng crawl”, không tạo crawler run.
- Reproduction: 2/2 lần; Console không thấy lỗi; Network response/status chưa
  được capture.
- Expected: tạo crawler run hoặc trả provider error rõ, cập nhật last-crawl,
  không che nguyên nhân bằng generic toast và không publish dữ liệu lỗi.
- Next QA action: không lặp lại mù; trước tiên capture Network response đã redact,
  xác định status/error code, rồi retest đúng checklist Lever của #361.
- User-provided screenshot xác nhận đã có cả hai fixture Lever và SmartRecruiters;
  cả hai hiển thị verified/active, 0 open jobs và `Chưa từng crawl`, kèm generic
  toast sau thao tác. #375 hiện ghi nhận chi tiết Lever 2/2; chưa tự tạo bug mới
  cho SmartRecruiters khi chưa có reproduction và Network evidence riêng.

### Timeline Jobs QA

- 2026-09-04: Chuẩn hóa cách hướng dẫn QA theo ELI5: câu ngắn, một hành động mỗi bước, giải thích mục tiêu và dừng sau từng test case.
- 2026-09-04: GitHub hiện có 13 issue Open; Jobs #361–#364 vẫn Open.
- 2026-09-04: #361 có positive visibility PASS; negative branch còn BLOCKED vì
  thiếu fixture Job để kiểm tra company/source không hợp lệ.
- 2026-09-04: JOB-361-02 anonymous branch kiểm tra trên Job detail Consensys tại
  Staging; request `jobs` public trả 200 đúng thiết kế, DOM chỉ hiển thị field
  public, không thấy raw payload/crawler/classification evidence/source coverage
  và không có Console warning/error. Authenticated branch còn chờ kiểm tra; chưa
  tích toàn bộ checklist item.
- 2026-09-04: #375 là sub-issue duy nhất hiện tại của #361, đang Open và chặn
  việc xác nhận Lever adapter/ingestion.
- 2026-09-04: Xác nhận lại với tester rằng hai fixture ATS đã được tạo nhưng
  không chạy được; không tích checklist vì thao tác thất bại và đã có bug con.
- 2026-09-04: Hoàn tất `JOB-361-01`: anonymous mở được Job hợp lệ; khi tắt
  company Consensys, Job bị ẩn; bật lại thì Job xuất hiện. Fixture đã được
  khôi phục. Checklist item visibility gate đủ điều kiện PASS và tích trên #361.
- 2026-09-04: #362–#364 đã có automated/release evidence xanh nhưng toàn bộ manual
  QA còn lại phải được kiểm tra từng item trước khi sign-off.

## Project Context Snapshot — 2026-09-04

### Quy tắc bộ nhớ nội bộ

- File này là nguồn ngữ cảnh duy nhất của dự án `corelia-app`.
- Không tạo lại `src/AGENTS.md` hoặc `supabase/AGENTS.md` nếu không có yêu cầu đặc biệt.
- Mọi bug, feature, quyết định kiến trúc, thay đổi business flow và định hướng UI phải được ghi nối tiếp vào Timeline.
- `corelia-landing` là dự án khác, không thuộc phạm vi của file này.

### Kết quả đọc dự án

- Đã lập inventory toàn bộ khoảng 947 file trong repository và đọc các nguồn kiến trúc chính, cấu hình, tài liệu nghiệp vụ, source đại diện, Edge Functions, migration và test.
- Frontend dùng React 19, TypeScript strict, Vite, React Router 7, Tailwind CSS 4, Base UI, TanStack Query, Zustand và i18next.
- Backend dùng Supabase Auth, Postgres, Storage, Realtime và Edge Functions; frontend không được chứa service-role key hoặc secret.
- `src/App.tsx` là nơi ghép route, guard và lazy loading. Page chịu trách nhiệm composition; feature chứa logic/UI theo domain; `src/components/ui/` chứa primitive dùng chung; `src/lib/` chứa data/domain helper.
- TanStack Query là nguồn duy nhất cho server state. Zustand chỉ dùng cho state dùng chung giữa nhiều route. Không gọi Supabase trực tiếp từ presentation component.
- Auth phải dùng `useAuth`, `useAuthStore`, `AuthSync`, `RequireAuth`, `RequireRole` và role config hiện có.
- UI phải giữ route, query/hash, redirect, i18n, loading/error/empty state và responsive behavior hiện tại nếu yêu cầu không nói khác.

### Luồng nghiệp vụ chính

- Auth: boot session → đọc profile/role → guard route → vào khu vực phù hợp.
- Learning: catalog → course detail → enrollment/access → lesson/progress/quiz → credential/achievement.
- Hackathon: admin tạo và publish → user đăng ký → tạo taxonomy project → nộp project → admin chọn winner → kết thúc.
- Projects/social: catalog/detail → tạo hoặc chỉnh sửa project → team/invite → moderation → follow/feed.
- Jobs: public catalog/detail → search/filter/sort → save/apply/hide → admin review/source/company/crawl → ingestion/classification/quality gate → analytics và scheduled revalidation.
- Account/credential: profile/CV/settings → achievements → claim/verify credential.
- Instructor/admin: authoring course/career track, quản lý người dùng, hackathon, Jobs, branding và manual mint.

### Trạng thái UI hiện tại

- Shared UI hiện có: Button, Avatar, Input, Card, Dialog, Sheet, Dropdown Menu, Field, Tooltip, Sidebar, Skeleton, Separator, Breadcrumb, Resizable và Sonner.
- Khoảng 208 file source có Tailwind class trực tiếp; cần chuẩn hóa dần qua primitive dùng chung nhưng không được big-bang rewrite.
- Source code hiện dùng `lucide-react` rộng rãi, trong khi `components.json` khai báo Phosphor Icons. Đây là quyết định cần thống nhất trước khi chuẩn hóa icon.
- Chưa thấy primitive dùng chung tương ứng rõ ràng trong `src/components/ui/` cho Tabs, Badge, Progress, Toggle, Checkbox, Radio và Scrollbar.

### Audit Figma Corelia App

Nguồn tham chiếu: `https://www.figma.com/design/clJA0AYOkRcUk5OEdYd1HJ/Corelia-App`.

Foundation đã có: Color, Typography, Spacing và Radius.

Các nhóm component Figma được đánh dấu hoàn thiện:

- Tabs.
- Action.
- Avatar.
- Input Field.
- Dropdown Menu.
- Scrollbar.
- Badge và Chips.
- Divider.
- Toggle.

Selection đã có nhiều variant nhưng Figma báo lỗi trong component set, vì vậy chưa xem là hoàn thiện tuyệt đối.

Các nhóm đã tồn tại nhưng chưa được đánh dấu hoàn thiện: Button, Navigation, Progress và Iconography.

Các nhóm đang trống hoặc tạm hoãn: Tooltips, Class Thumbnail, Pattern, Components index và Corelia AI.

Screen/Home đã tồn tại như một màn hình tổng hợp, nhưng Figma hoàn thiện không đồng nghĩa code implementation đã hoàn thiện. Mỗi component vẫn phải được kiểm chứng bằng code, tương tác, responsive, accessibility, i18n và test.

### Mục tiêu phát triển nâng cấp UI

Mục tiêu là xây dựng UI library nội bộ thống nhất với Figma, tái sử dụng được trên toàn bộ Corelia mà không làm thay đổi business flow.

Thứ tự thực hiện:

1. Mapping Figma với component code hiện tại.
2. Thống nhất design token, màu, typography, spacing, radius và icon library.
3. Hoàn thiện Button, Navigation, Progress, Iconography và Tooltip.
4. Chuẩn hóa Tabs, Action, Avatar, Input Field, Dropdown Menu, Badge, Chips, Selection, Toggle, Divider và Scrollbar.
5. Tạo UI Showcase route để kiểm tra variant, state, responsive và accessibility.
6. Migrate từng khu vực: App shell/Header/Sidebar → Auth/Account/Profile → Courses/Learning → Hackathon/Projects → Jobs/Admin.
7. Sau mỗi nhóm migrate phải kiểm tra regression trước khi chuyển sang nhóm tiếp theo.

Tiêu chuẩn bắt buộc:

- Hoạt động tại 1440px, 1024px, 768px và 390px; không vỡ khi zoom 200%.
- Có keyboard navigation, focus order, accessible name cho icon-only control và touch target phù hợp.
- Không dùng màu là cách duy nhất để biểu thị trạng thái.
- Có Light Mode, Dark Mode, loading, error và empty state.
- Nội dung VI/EN không làm vỡ layout hoặc lộ translation key.
- Giữ performance budget hiện tại: CLS < 0.1, LCP < 2.5s, INP < 200ms, initial public JavaScript < 350 kB gzip.
- Không thêm UI framework hoặc icon library mới nếu chưa có quyết định riêng.

### Luồng triển khai UI

Figma design → shared UI component → UI Showcase → page composition → user action → query/mutation/service hiện tại.

Component mới chỉ chịu trách nhiệm hiển thị và tương tác. Dữ liệu vẫn đi qua query hook, domain service, Supabase hoặc Edge Function hiện có; không đặt business logic của domain khác vào component giao diện.

### Technical debt và việc cần theo dõi

- Figma Selection component set đang có lỗi.
- Một số nhóm component Figma chưa có primitive dùng chung tương ứng trong code.
- Icon library giữa `components.json` và source code chưa thống nhất.
- `FEATURES_LISTS.md` cũ, không dùng làm source of truth chính.
- `AGENTS.md` hiện là file ngữ cảnh nội bộ; không đưa secret hoặc dữ liệu cá nhân vào file.

### Timeline dự án

- 2026-09-04: Hoàn tất inventory và audit kiến trúc toàn bộ `corelia-app`.
- 2026-09-04: Gom quy tắc frontend và Supabase vào file ngữ cảnh gốc duy nhất.
- 2026-09-04: Ghi nhận trạng thái component Figma và roadmap nâng cấp UI.
- 2026-09-04: Chưa sửa code ứng dụng, chưa thay đổi route, data flow hoặc business flow.
- 2026-09-06: Issue #381 Phase 1 đã chuẩn hóa token consumption trong `button.tsx`, `input.tsx` và `dialog.tsx`; dọn legacy radius comment trong `globals.css`. Không thay đổi route, data flow hoặc business flow. `git diff --check` và `pnpm lint` PASS. `pnpm build` trong agent environment bị chặn bởi `EPERM` khi ghi `node_modules/.tmp/tsconfig*.tsbuildinfo`; user đã xác nhận build trên terminal cá nhân thành công.
- 2026-09-06: Issue #381 đã mở rộng chuẩn hóa token consumption cho các shared primitive còn lại: `dropdown-menu.tsx`, `tooltip.tsx`, `sheet.tsx`, `field.tsx`, `breadcrumb.tsx`, `label.tsx`, `sidebar.tsx` và avatar group. Giữ nguyên comment cũ, route, data flow và business flow; thêm mapping Figma → CSS/Tailwind trong `globals.css`. `pnpm lint` PASS; agent build tiếp tục bị `EPERM` khi ghi `node_modules/.tmp/tsconfig*.tsbuildinfo`.
