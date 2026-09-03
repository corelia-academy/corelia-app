# Corelia Jobs — Test Checklist

Checklist này dùng cho local hoặc Staging. Đánh dấu `[x]` chỉ khi kết quả thực
tế khớp expected result. Mỗi bug cần kèm môi trường, commit/build, route, account
role, company/source ID, crawler run ID, ảnh/video và Console/Network error đã
redact secret.

- Setup và troubleshooting: [README.md](./README.md)
- Phạm vi sản phẩm: [corelia-jobs-complete-implementation-plan.md](./corelia-jobs-complete-implementation-plan.md)

## 0. Evidence của phiên test

- [ ] Environment: Local / Staging / Production smoke (chọn một).
- [ ] Frontend URL và Supabase project ref đã được ghi lại, không ghi key/secret.
- [ ] Git commit SHA và `window.__CORELIA_BUILD__` (nếu có) khớp artifact cần test.
- [ ] Tester, thời gian bắt đầu/kết thúc và browser/device đã được ghi lại.
- [ ] Có cửa sổ anonymous, một user thường và một `admin` hoặc `support_staff`.
- [ ] Có ít nhất một company test đã được phê duyệt; không dùng thông tin cá nhân
  thật hoặc tạo dữ liệu thử trực tiếp trên production.
- [ ] DevTools Network và Console được mở; mọi evidence đã che token, API key và
  cron secret.

## 1. Automated gates

### Unit, lint và build

- [ ] Adapter/classifier/normalization tests pass:

  ```bash
  pnpm vitest run \
    supabase/functions/corelia-api/jobs/adapters.test.ts \
    supabase/functions/corelia-api/jobs/classify.test.ts \
    supabase/functions/corelia-api/jobs/normalization.test.ts
  ```

- [ ] Full unit/integration suite pass: `pnpm test`.
- [ ] ESLint pass: `pnpm lint`.
- [ ] Typecheck và production-neutral build pass: `pnpm build`.
- [ ] Nếu release Staging/Production, build đúng mode tương ứng cũng pass.

### Database

- [ ] Docker đang chạy và `pnpm db:verify:local` pass từ clean migration chain.
- [ ] Gate thực thi
  `scripts/db/tests/jobs-mvp.integration.sql`, không chỉ apply migration.
- [ ] `pnpm db:verify` pass trên release branch sau khi migration Jobs được đưa
  vào approved pending migration set.
- [ ] Không sửa frozen baseline/manifest tùy ý chỉ để làm guardrail xanh.
- [ ] `git diff --check` không báo whitespace/error.

### Edge Functions

- [ ] `pnpm functions:serve` bundle và serve `corelia-api` không lỗi.
- [ ] `pnpm functions:serve:cron-jobs` bundle và serve `cron-jobs` không lỗi.
- [ ] Hosted release deploy cả hai function từ cùng commit.
- [ ] `supabase/functions/.env` không được track; không có secret trong diff,
  build artifact hoặc log đính kèm.

## 2. Database schema, grants và RLS

- [ ] Đủ 19 relations Jobs: `job_sources`, `job_companies`, `job_roles`,
  `job_domains`, `job_skills`, `jobs`, `raw_jobs`, `job_source_links`,
  `job_classifications`, `job_events`, `user_jobs`, `crawler_runs`,
  `source_coverage_daily`, `market_daily_stats`, `market_role_daily_stats`,
  `market_skill_daily_stats`, `market_domain_daily_stats`,
  `market_seniority_daily_stats`,
  `job_operational_alerts`.
- [ ] RLS bật trên toàn bộ relations Jobs trong schema `public`.
- [ ] `anon` và `authenticated` đọc được taxonomy active và dữ liệu public hợp
  lệ nhờ explicit grants + RLS.
- [ ] Anonymous không đọc được `raw_jobs`, classifier evidence, crawler runs,
  coverage, operational alerts hoặc operational metadata.
- [ ] Browser role không insert/update/delete được canonical `jobs` hoặc market
  snapshots.
- [ ] User chỉ đọc/ghi được row `user_jobs` có `user_id = auth.uid()`.
- [ ] Job `active` của company chưa verify không hiển thị với anonymous.
- [ ] Job chỉ public khi source enabled + policy reviewed, company active +
  verified, status active và chưa hết hạn.
- [ ] Insert/chuyển trạng thái sang active tạo lifecycle event `job_published`.
- [ ] Search vector có title/company/description/skills và query full-text tìm
  được fixture mong đợi.
- [ ] Raw payload, `manual_overrides`, `payload_hash`, classifier evidence và
  source/company errors không xuất hiện trong response public.

## 3. Setup nguồn và company

- [ ] Migration seed Greenhouse, Lever, Ashby và SmartRecruiters, mỗi source có
  cadence 24 giờ và policy reviewed.
- [ ] `/admin/jobs/sources` hiển thị đúng source, type, cadence, policy, lần chạy
  cuối và trạng thái.
- [ ] Staff enable/disable source thành công; user thường bị từ chối.
- [ ] `/admin/jobs/companies` tạo được company với `name`, unique slug, ATS,
  identifier, region và domains.
- [ ] Identifier chỉ là ATS board/company segment, không phải URL đầy đủ.
- [ ] Company mới chưa verify không làm job public.
- [ ] Staff verify/unverify và enable/disable company thành công.
- [ ] Duplicate `(source_type, source_identifier, source_region)` bị từ chối rõ
  ràng, không tạo row thứ hai.
- [ ] Chọn Lever EU gọi host EU; những adapter khác dùng region global.
- [ ] Chạy riêng company/source/adapter/all chọn đúng targets và không chạy
  company inactive.

## 4. ATS adapters

### Greenhouse

- [ ] Đọc đúng board token và endpoint có `content=true`.
- [ ] Map ID, title, company, HTML/plain description, location, tags,
  `first_published`, `updated_at`, source/apply URL.
- [ ] Feed trên 5.000 job fail closed, không xử lý như một feed complete.
- [ ] HTTP non-2xx, timeout hoặc JSON lỗi tạo run error; không expire job cũ như
  một complete feed thành công.

### Lever

- [ ] Global và EU chọn đúng API host.
- [ ] Pagination `skip`/`limit=100` lấy đủ hơn một page, không trùng/mất job.
- [ ] Map categories, commitment, salary range, hosted/apply URL đúng.
- [ ] Feed chạm hard cap 5.000 trả `source_feed_too_large:lever` và không coi là
  complete feed.

### Ashby

- [ ] Đọc đúng job-board identifier với compensation enabled.
- [ ] Map job/apply URL, description, location, department/team, employment và
  compensation khi source cung cấp.
- [ ] Feed trên 5.000 job fail closed, không xử lý như một feed complete.

### SmartRecruiters

- [ ] Pagination lấy danh sách posting rồi fetch detail đúng từng UUID.
- [ ] Total/page vượt hard cap fail closed; không silently ingest một phần.
- [ ] Map company, title, location, department, experience level và apply URL.

### External API và RSS/Atom

- [ ] web3.career thiếu `WEB3_CAREER_API_TOKEN` fail trước khi fetch; khi có
  token thì giữ nguyên provider apply URL và map salary nếu source cung cấp.
- [ ] CryptoJobsList thiếu `CRYPTOJOBS_LIST_API_KEY` fail trước khi fetch; khi
  có key thì gửi bằng `x-api-key`, phân trang và giữ `canonicalURL`.
- [ ] Himalayas cursor pagination, Remotive JSON và Remote OK JSON map đúng
  description, logo, location, salary/tags có thật từ source.
- [ ] We Work Remotely RSS và generic RSS/Atom đọc được cả `<item>` lẫn
  `<entry>`, Atom `link href`, category term và loại duplicate feed entry.
- [ ] External source disabled hoặc policy chưa review không làm job public;
  footer Jobs chỉ liệt kê source có target active + verified thực sự connected.

## 5. Ingestion, dedup và quality gate

- [ ] Mỗi manual run tạo `crawler_runs` với target, trigger, timestamps, counters
  và actor đúng.
- [ ] Run thành công cập nhật `last_crawled_at`, `last_success_at`, xóa
  `last_error` và ghi coverage ngày.
- [ ] Run thất bại ghi error ở run/company/source và coverage thất bại.
- [ ] Một job lỗi không làm mất counters/kết quả của các job khác trong cùng
  company; run có status `partial`, `failed_count` và response HTTP `207` rõ
  ràng để company được retry ở lần scheduler kế tiếp.
- [ ] Raw payload mới được lưu theo source identity + payload hash.
- [ ] Cùng `source_id + source_job_id + payload_hash` không tạo raw duplicate.
- [ ] Payload không đổi chỉ cập nhật `last_seen_at`, source time và điểm xếp
  hạng theo độ mới; không gọi AI lại.
- [ ] Canonical/apply URL được normalize, loại tracking params đã định nghĩa.
- [ ] Job trùng canonical URL từ nguồn khác được link qua `job_source_links`,
  không tạo canonical job thứ hai.
- [ ] Job thiếu title/company/source/apply URL vào review hoặc bị từ chối theo
  quality gate, không public.
- [ ] Job ngoài phạm vi rõ ràng bị deterministic filter chặn mà không gọi AI.
- [ ] Job tech và non-tech map đúng `job_type`; Social/Content/Marketing không bị
      gán tech chỉ vì mô tả nhắc đến sản phẩm hoặc đội engineering.
- [ ] Job map đúng role/domain/skills/seniority/remote/employment/region khi
  có evidence.
- [ ] Không suy diễn salary, location, eligibility hoặc skill khi source không
  có bằng chứng.
- [ ] Salary thiếu/không hợp lệ về currency hoặc range không được tự gán USD,
  tự gán chu kỳ hoặc làm hỏng cả lượt crawl/UI.
- [ ] Có OpenAI: chỉ job mới/thay đổi gọi model; output sai schema/provider lỗi
  fallback an toàn vào review.
- [ ] Không OpenAI: crawl không crash; job mới vào review với
  `ai_not_configured_or_unavailable`.
- [ ] Company chưa verify hoặc source policy chưa review không auto-publish.
- [ ] Feed complete, thành công và không rỗng expire job mất khỏi feed.
- [ ] Feed request lỗi/incomplete/rỗng không expire hàng loạt job đang active.
- [ ] Manual override/status do staff đặt còn nguyên sau recrawl payload thay
  đổi.
- [ ] `207` được coi là partial failure; UI/log nêu đúng company thất bại.

## 6. Admin review và analytics

- [ ] Anonymous/student/instructor không mở được `/admin/jobs/*` hoặc gọi Jobs
  admin ops trực tiếp.
- [ ] `admin` và `support_staff` đều mở được các trang Jobs admin.
- [ ] `/admin/jobs` hiển thị đúng số active, review, companies, sources và failed
  runs.
- [ ] `/admin/jobs/review` hiển thị title, company, confidence, tags và
  `review_reason`.
- [ ] Publish chuyển job sang active, xóa review reason mặc định và làm job xuất
  hiện public khi mọi visibility gate khác hợp lệ.
- [ ] Reject chuyển job sang rejected và job không xuất hiện public.
- [ ] Review job không tồn tại trả 404; status/job ID sai trả 400.
- [ ] `/admin/jobs/crawlers` hiển thị recent runs, counters, timestamps và error.
- [ ] **Refresh analytics** tạo run analytics và snapshots ngày hiện tại.
- [ ] Analytics chỉ đếm source policy/company/job đang đủ điều kiện public.
- [ ] Comparable/stable cohort chỉ dùng source-company pairs có successful
  coverage ở cả hai ngày so sánh.
- [ ] Top roles, skills, domains và remote/entry/salary counts khớp fixture SQL.

## 7. Catalog `/jobs`

- [ ] Anonymous mở `/jobs` không có request REST lỗi.
- [ ] Database hợp lệ nhưng chưa có job hiển thị empty state, không hiển thị
  “Không thể tải danh sách việc làm”.
- [ ] Query lỗi hiển thị alert và nút retry; retry thành công sau khi backend
  được sửa.
- [ ] Catalog chỉ hiển thị canonical job đủ visibility gate, sắp theo ranking
  rồi `posted_at` mới nhất.
- [ ] Anonymous, user thường và staff/admin nhận cùng tập job public trước khi
  áp dụng trạng thái hide cá nhân; quyền staff không làm job `review` hoặc
  `rejected` xuất hiện trên catalog/detail người dùng.
- [ ] Search tìm theo title/company/description/skills và giữ query trong URL.
- [ ] Filter role, domain, skill, seniority, work mode, region, employment type
  và posted date trả đúng kết quả.
- [ ] Minimum salary disabled khi chưa chọn currency.
- [ ] Salary filter chỉ so trong currency đã chọn và không trộn đơn vị tiền.
- [ ] Đổi filter và **Xóa lọc** trả URL/filter về đúng trạng thái; catalog không
  thêm hoặc phụ thuộc query parameter `page`.
- [ ] Infinite scroll tải theo batch 24 item khi gần cuối danh sách, không lặp
  hoặc bỏ sót job giữa các batch và dừng khi đã tải đủ tổng số kết quả.
- [ ] Batch tiếp theo đang tải có status accessible; lỗi giữ nguyên các job đã
  tải và cho phép retry mà không chuyển trang.
- [ ] Card hiển thị company, title, location/work mode, salary/date/tags đúng và
  không vỡ khi thiếu logo/salary/description.
- [ ] User đã hide một job không còn thấy job đó trong catalog của chính mình;
  user khác vẫn thấy nếu job public.

## 8. Job detail, SEO và apply

- [ ] `/jobs/:slug` hiển thị đúng title, company, description, location,
  employment, salary, role, seniority và skills.
- [ ] Slug không tồn tại, job không public hoặc đã expired hiển thị Not Found.
- [ ] CTA Apply mở `apply_url` ngoài tab mới với `noopener noreferrer`.
- [ ] Required skill link về `/jobs?skill=...` và filter đúng.
- [ ] Source name và attribution text hiển thị khi source yêu cầu attribution.
- [ ] Source có `allow_seo_indexing=true` render một JSON-LD `JobPosting` hợp lệ.
- [ ] Source không cho SEO không render JSON-LD.
- [ ] JSON-LD không chứa operational/private fields; date, organization,
  employment, remote và `validThrough` chỉ xuất hiện khi có dữ liệu.
- [ ] Nội dung source được hiển thị dạng text an toàn; HTML không được inject
  trực tiếp vào DOM.

## 9. Saved, Applied và Hidden

- [ ] Anonymous bấm Save/Applied nhận thông báo cần đăng nhập và không có row
  `user_jobs` được tạo.
- [ ] User đăng nhập save/unsave cập nhật card và `/jobs/saved` đúng sau refresh.
- [ ] Mark/unmark applied cập nhật card và `/jobs/applied` đúng sau refresh.
- [ ] Một job có thể đồng thời saved và applied.
- [ ] Bỏ cả saved/applied/hidden xóa row trạng thái rỗng thay vì giữ rác.
- [ ] Hide loại job khỏi catalog, Saved và Applied của chính user theo hành vi
  hiện tại.
- [ ] User A không đọc/sửa trạng thái job của user B bằng request trực tiếp.
- [ ] `/jobs/saved` và `/jobs/applied` yêu cầu đăng nhập và có return flow hợp
  lệ.
- [ ] `/jobs/hidden` yêu cầu đăng nhập, liệt kê job đã ẩn và nút hiện lại đưa
  job về catalog; route riêng tư này không nằm trong sitemap.
- [ ] Job không còn public không bị rò qua danh sách Saved/Applied.

## 10. Market `/jobs/market`

- [ ] Chưa có snapshot hiển thị empty state, không crash.
- [ ] Sau refresh, card active/new/remote share/entry-level khớp snapshot mới
  nhất.
- [ ] Activity 30 ngày, top roles/skills/domains, seniority mix và remote share
  khớp các bảng snapshot tương ứng.
- [ ] Role/skill growth chỉ xuất hiện khi đủ hai cửa sổ 7 ngày và chỉ dùng
  `comparable_new_jobs` của stable source cohort.
- [ ] Nhấn role/skill/domain hoặc card remote/entry-level mở đúng drilldown với
  filter cố định.
- [ ] Trang nêu rõ dữ liệu phụ thuộc coverage và không trình bày metric như toàn
  thị trường nếu chỉ là tập nguồn curated.
- [ ] Snapshot trong range 7–365 ngày; latest chọn đúng ngày gần nhất.

## 11. Scheduler và secrets

- [ ] `cron-jobs` chỉ nhận `POST`; method khác trả `405`.
- [ ] Thiếu `CORELIA_JOBS_CRON_SECRET`, thiếu header hoặc secret sai trả `401`.
- [ ] Secret đúng gọi `jobs.runScheduled` với body nguyên vẹn.
- [ ] `jobs.runScheduled` cũng tự kiểm tra secret; không thể bypass bằng cách gọi
  trực tiếp `corelia-api?op=jobs.runScheduled`.
- [ ] Default `max_targets=1`; input bị clamp trong khoảng 1–10.
- [ ] Scheduler chỉ chọn company active có source enabled và đã đến hạn.
- [ ] `mode=discovery`, `mode=revalidation` và `mode=analytics` tạo đúng loại
  crawler run; revalidation không gọi AI hoặc ghi raw payload mới.
- [ ] Company chưa từng success được xem là due.
- [ ] Cadence company override được ưu tiên; nếu null dùng cadence source.
- [ ] Một invocation không chạy lại company vừa success trước khi đến hạn.
- [ ] Supabase Cron lưu URL/secret trong Vault, không hardcode secret trong SQL
  migration, repo hoặc screenshot.
- [ ] Cron result, Edge logs và `/admin/jobs/crawlers` cùng thể hiện một run; HTTP
  `207` được alert như partial failure.
- [ ] Ba schedule discovery/revalidation/analytics tồn tại và lệch phút; không
  có schedule cũ trùng lặp.
- [ ] Ba lần fail liên tiếp, feed đang có job bỗng trả 0, schema/rate-limit và
  classifier spike tạo alert; `ai_failed_count` vẫn được ghi dù crawl fallback
  thành công; staff có thể resolve alert trong admin.
- [ ] `CORELIA_JOBS_ALERT_WEBHOOK_URL` thiếu không làm crawl lỗi; nếu có thì chỉ
  dùng HTTPS và không lộ URL trong log.

## 12. SEO và sitemap

- [ ] Các landing route role/skill/domain/remote/Vietnam/APAC có canonical URL
  riêng và filter cố định không bị query string ghi đè.
- [ ] Job detail chỉ emit `JobPosting` và `index,follow` khi source cho phép SEO;
  nguồn không cho phép phải `noindex,nofollow` và không emit JSON-LD.
- [ ] Build sitemap giữ static landing URLs, đổi đúng origin theo environment và
  chỉ thêm job active mà RLS + `allow_seo_indexing` cho phép.
- [ ] Saved/Applied/Hidden và admin routes không xuất hiện trong sitemap.

## 13. i18n, responsive và accessibility

Kiểm tra tối thiểu ở 390px, 768px, 1024px và 1440px, cả light/dark theme.

- [ ] Tất cả Jobs public/admin có copy VI và EN; đổi locale không lộ translation
  key hoặc text từ locale cũ.
- [ ] Filter controls có accessible name; tab order hợp lý và focus ring nhìn
  thấy bằng keyboard.
- [ ] Loading skeleton không gây layout shift lớn; alert lỗi có `role=alert`.
- [ ] Navigation Jobs và Admin Jobs thể hiện route active đúng.
- [ ] Bảng admin cuộn ngang ở màn hình hẹp, không làm viewport tràn vô hạn.
- [ ] Card grid, detail sidebar, filter grid và market cards không chồng/lệch ở
  bốn breakpoint.
- [ ] Logo thật dùng `object-contain`, không méo; job thiếu logo không hiện
  generic company icon giống nhau trên mọi card/detail.
- [ ] Icon trang trí không tạo accessible name thừa.
- [ ] Zoom 200% vẫn thao tác được search, filters, actions và infinite scroll.

## 14. Regression và release smoke

- [ ] Auth/login/logout và route guards hiện có không regression.
- [ ] Sidebar app/admin không đổi quyền hoặc phá route ngoài Jobs.
- [ ] Existing `corelia-api` operations (projects, hackathons, mail/payment nếu
  thuộc smoke suite release) không regression do router Jobs mới.
- [ ] Không có migration destructive ngoài phạm vi Jobs; migration chain từ zero
  vẫn pass.
- [ ] Staging Supabase workflow xanh và đã deploy migration + hai functions.
- [ ] Frontend Staging được publish bằng pipeline riêng; bundle SHA/version khớp
  backend release.
- [ ] Production chỉ smoke read-only trước khi operator chủ động tạo/crawl nguồn
  đã được phê duyệt.
- [ ] Post-deploy anonymous `/jobs`, staff admin, một manual run, review/public
  visibility và market snapshot đều pass.
- [ ] Không có secret/PII trong logs, analytics metadata hoặc evidence QA.

## 15. Exit criteria

- [ ] Không còn blocker/critical issue mở.
- [ ] Mọi automated gate bắt buộc của môi trường đều xanh.
- [ ] Security/RLS, ingestion safety, public catalog, staff review và scheduler
  đều có evidence pass.
- [ ] Known limitation được ghi rõ, có owner và ticket; không đổi expected result
  để hợp thức hóa bug.
- [ ] Fixture test được xóa hoặc disable; mọi source/company thật được giữ đúng
  trạng thái vận hành đã phê duyệt.
- [ ] Reviewer xác nhận release chỉ được coi là Done khi cả backend Supabase và
  frontend publication có terminal evidence tương ứng.
