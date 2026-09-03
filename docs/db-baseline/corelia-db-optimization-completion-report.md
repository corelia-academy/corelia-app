# CORELIA Database Refactoring & Optimization — Completion Report

> **Historical hackathon evidence:** mọi mô tả metrics snapshot, registration review, judging hoặc score trong báo cáo này đã bị [contract hackathon mới](../hackathon/README.md) thay thế.

> Cập nhật: 2026-08-27
> Repository: `corelia-app`
> Candidate branch: `feat/db-canonical-payment-entitlements`
> Candidate commit: `8e9b2e964a295ab8a2d01e307bdc457f58abb8e4`
> Phạm vi remote: chỉ `corelia-app` / Main và `corelia-staging`; wave này chưa ghi dữ liệu lên Supabase.

## 1. Kết luận ngắn

### [FACT]

- Database đã được khảo sát, lập baseline và xây dựng migration/test guardrail.
- Các phần canonical state và data-integrity trước đó đã được triển khai trong migration chain hiện tại.
- Wave mới nhất đã triển khai canonical payment, product catalog, course entitlement, admin grant, refund lifecycle và server-calculated quiz integrity.
- Local test/build/DB integration/incremental upgrade đều đã PASS.
- Candidate đã được commit và push lên branch riêng; chưa merge vào `staging` hoặc `main`, chưa deploy và chưa ghi DB remote.

### [INFERENCE]

Đây là trạng thái **hoàn tất một wave triển khai có kiểm chứng và sẵn sàng review trước staging**, không phải tuyên bố toàn bộ 13 hạng mục tối ưu hóa database đã hoàn thành. Performance theo workload, retention, external consumer inventory, live parity và legacy cleanup vẫn là các phần tiếp theo.

## 2. Mục tiêu ban đầu

- Đánh giá chất lượng hiện tại của database trước khi thay đổi.
- Làm rõ source of truth và các quan hệ giữa bảng.
- Đưa các business invariant quan trọng xuống database.
- Tách payment fact, entitlement/access, refund và enrollment thành các khái niệm rõ ràng.
- Giảm khả năng dữ liệu sai lan qua nhiều endpoint hoặc nhiều writer.
- Làm cho payment, access và quiz dễ mở rộng, dễ trace và dễ debug hơn.
- Giữ backward compatibility trong thời gian chuyển đổi.
- Chỉ cleanup legacy sau khi đã chứng minh không còn dependency.

Nguyên tắc xuyên suốt:

> Không thay đổi chỉ vì schema trông xấu. Mỗi thay đổi phải có vấn đề, bằng chứng, giải pháp, trade-off và kế hoạch rollback/recovery.

## 3. Baseline đã khảo sát

### 3.1 Phạm vi và bằng chứng

| Hạng mục | Kết quả |
|---|---|
| Main | `corelia-app`, Supabase ref `lawhkvyyoznwygzsycan` |
| Staging | `corelia-staging`, Supabase ref `opoozbmfbezkrpzxsusx` |
| Snapshot ban đầu | Schema visualizer/dbdiagram và catalog snapshot ngày 2026-08-23 |
| Quyền thao tác audit | Read-only; không tự ý sửa Main/Staging |
| Source schema change | Migration chain, không sửa migration đã apply |
| Current candidate | Local worktree và disposable PostgreSQL |

### 3.2 Main ↔ Staging snapshot ban đầu

Các số liệu dưới đây là snapshot audit, không phải cam kết rằng live catalog hiện tại vẫn giữ nguyên.

| Hạng mục | Main | Staging | Nhận định ban đầu |
|---|---:|---:|---|
| Tables | 68 | 68 | Parity ở cấp bảng |
| Columns | 637 | 633 | Staging thiếu 4 column tại `ai_vouchers` |
| Primary keys | 68 | 68 | Parity |
| Foreign keys | 104 | 104 | Parity ở catalog thời điểm snapshot |
| Unique constraints | 16 | 16 | Parity |
| CHECK constraints | 87 | 84 | Staging thiếu 3 CHECK của `ai_vouchers` |
| Indexes | 207 | 213 | Có index lệch; quyết định performance được defer theo workload |
| RLS policies | 149 | 152 | Có policy khác definition, Main-only và Staging-only |
| Functions | 118 | 118 | Có 8 body definition khác nhau |
| Triggers | 38 | 38 | Credential activity behavior cần chốt semantic |

### 3.3 Vấn đề được phát hiện

- RLS cùng tên nhưng khác `role`, `command`, `USING` hoặc `WITH CHECK` có thể làm hai môi trường cho phép hành động khác nhau.
- Có function `is_admin_or_support()` ở nhiều schema; lời gọi không qualify schema có thể làm security boundary khó đọc và khó kiểm chứng.
- Payment fact, enrollment, course access và refund trước đây không có một state model thống nhất.
- `ai_vouchers` có hai mô hình cấu hình: runtime/repository nghiêng về batch, còn Main snapshot có thêm field ở voucher.
- Migration history của live Main và `origin/main` chưa giải thích hoàn toàn cho nhau.
- Một số invariant quan trọng trước đây phụ thuộc vào endpoint/client thay vì được chặn ở DB.
- Các index Staging-only chưa có workload evidence để quyết định giữ, gộp hoặc bỏ.

## 4. Những phần đã thực hiện

### 4.1 Wave 0 — Migration governance và baseline guardrail

Đã xây dựng và đưa vào repository:

- Frozen migration baseline và SHA-256 manifest.
- Kiểm tra migration cũ bị sửa, xóa, đổi tên hoặc collision version.
- Expected-drift allowlist có metadata thay vì bỏ qua drift mù quáng.
- Catalog fingerprint cho table, constraint, RLS, function và trigger.
- Protected live-history verification interface cho Main/Staging dùng read-only credential.
- Local clean recreate runner không dùng `--linked`.
- Workflow pre-deploy chặn migration/deploy nếu verification fail.
- Quy ước emergency SQL phải có ticket, actor, SQL capture và reconciliation migration.

Kết quả: schema change có thể truy vết bằng migration; live manual SQL không còn được xem là source of truth chính thức.

### 4.2 G2 — Canonical state và data integrity nền tảng

Các phần đã có trong migration history/baseline hiện tại:

| Domain | Canonical direction | Cải thiện |
|---|---|---|
| Streak | `user_daily_streaks` là state chính; `profiles.streak_days` là legacy projection | Tránh đọc state streak cũ hoặc luôn bằng 0 |
| AI entitlement lịch sử | Active, chưa hết hạn trong `ai_subscriptions` | Không cho `profiles.tier` cũ giữ quyền sau khi hết hạn |
| AI session count | Completed rows trong `ai_conversations` và DB trigger | Không để stream error hoặc retry làm lệch count |
| Voucher history | Restrict delete/archival khi đã có redemption | Giữ audit trail và tránh mất lịch sử tài chính |
| Hackathon metrics | Snapshot refresh ở lifecycle rõ ràng | Tránh trigger row-level nặng ở bảng traffic cao |
| Model pricing | Runtime TypeScript là nguồn đang dùng; DB table là deprecation candidate | Không để hai nguồn pricing âm thầm lệch nhau |

Các phần này có report riêng tại `docs/db-baseline/g2-canonical-state-integrity-implementation-report.md`.

### 4.3 AI retirement và instructor-facing AI trong scope #325–#332

- Learner-facing Cora/AI surfaces đã được loại khỏi app theo hướng retirement.
- Các learner AI Edge Function đã có tombstone fail-closed, không gọi provider và không ghi state mới.
- Historical AI payment/reconciliation được giữ để không làm mất lịch sử.
- Instructor-facing description/question generator thuộc issue #327 được giữ lại.
- Test contract xác nhận việc retire learner AI không xóa hoặc disable instructor tooling.
- Các release gate và report được sửa để phân biệt local evidence với staging/production evidence.

Đây là phần liên quan đến DB optimization vì nó ảnh hưởng trực tiếp đến AI entitlement, historical payment, migration cleanup và release safety. Nó không đồng nghĩa với việc được phép xóa mọi bảng AI ngay lập tức.

### 4.4 Wave hiện tại — Canonical payment, entitlement, refund và quiz

#### Payment product catalog

- Thêm `billing_products` để payment có thể mở rộng theo product type.
- Thêm `payment_transaction_items` để một payment có item/resource/snapshot/fulfillment riêng.
- Giữ `payment_transactions` là payment fact và vẫn lưu các field snapshot legacy cho compatibility.
- Payment item lưu snapshot giá, product, resource và discount tại thời điểm mua.
- Product mới phải có fulfillment mapping; product chưa được map sẽ fail closed.

#### Course entitlement

- Thêm `course_entitlement_grants` làm canonical source cho quyền học khóa.
- Unique partial index đảm bảo tối đa một active grant cho mỗi `(user_id, course_id)`.
- `source` phân biệt `payment`, `admin_grant`, `voucher`, `free_enrollment` và `legacy`.
- Payment grant phải có `source_transaction_id`.
- Admin grant phải có `granted_by`, không được giả lập payment transaction.
- Entitlement provenance dùng `ON DELETE RESTRICT`, bảo vệ payment fact khỏi bị xóa khi còn grant tham chiếu.
- `course_payment_access` và `enrollments` hiện được giữ như compatibility projection, không được xem là nguồn chính mới.

#### Admin grant

- Admin/support chỉ cấp quyền học thủ công.
- Admin grant không tạo payment, không ghi paid amount và không cấp certificate fee payment.
- Nếu user đã có active entitlement thì không tạo thêm grant.
- Advisory lock và unique index xử lý race giữa admin grant và payment settlement.

#### Refund

- Refund là full refund; không hỗ trợ partial refund trong contract hiện tại.
- Stage A: `request_payment_refund` ghi nhận yêu cầu và chuyển transaction sang `refund_requested`.
- Stage B: provider xác nhận qua `process_provider_payment_refund`, sau đó mới chuyển `refunded`.
- Provider refund callback có idempotency và kiểm tra provider refund ID không bị dùng cho transaction khác.
- Refund chỉ revoke entitlement grant gắn với payment transaction đó.
- Admin grant không có payment provenance nên không bị biến thành một khoản hoàn tiền.
- Historical AI payment được reconcile nhưng không tạo AI entitlement mới.

#### Quiz practice integrity

- Client không còn gửi `is_correct`.
- Server tự đọc đáp án canonical và tính `is_correct` trong RPC.
- Direct insert vào `section_question_attempts` từ client bị thu hồi.
- RPC kiểm tra course access, course/question ownership, section/lesson scope và selected index range.
- Batch submit chạy trong cùng transaction; một câu lỗi thì toàn bộ batch rollback.
- Quiz hiện là practice component; không tự tạo payment, certificate hoặc AI quota entitlement.

#### Test và migration support

- Bổ sung SQL integration Gate 8 cho RLS/cross-user isolation.
- Bổ sung deletion guard cho payment provenance.
- Bổ sung race test settlement vs admin grant và duplicate admin grant.
- Bổ sung HTTP E2E cho missing signature và duplicate/course refund.
- Bổ sung incremental upgrade proof từ baseline gần nhất lên candidate.

### 4.5 File trong wave commit mới nhất

Commit `8e9b2e9` gồm đúng 14 file, không dùng `git add .`:

**Migration và test mới:**

- `supabase/migrations/20260827120000_canonical_payment_entitlements_and_quiz_integrity.sql`
- `scripts/db/tests/canonical-payment-entitlements-integration.sql`
- `scripts/db/tests/canonical-payment-entitlements.contract.test.mjs`
- `scripts/db/tests/incremental-upgrade-proof.mjs`

**Test runner/test coverage được mở rộng:**

- `scripts/db/verify-local-migration-apply.mjs`
- `scripts/db/tests/issue-329-payment-retirement-integration.sql`
- `scripts/db/tests/r4-payment-concurrency.integration.mjs`
- `scripts/db/tests/r4-payment-refund-integration.sql`
- `scripts/db/tests/r5-payment-http-e2e.integration.mjs`

**Application compatibility:**

- `src/lib/payments.ts`
- `src/lib/quizAttempts.ts`
- `src/pages/learn/components/LessonQuiz.tsx`
- `src/pages/learn/components/SectionQuiz.tsx`
- `supabase/functions/corelia-api/payments/handlers.ts`

## 5. Before → After: giá trị thực tế

| Vấn đề | Trước | Sau | Giá trị |
|---|---|---|---|
| Nguồn quyền học | Payment/access/enrollment bị đọc lẫn | `course_entitlement_grants` là canonical, bảng cũ là projection | Dễ debug quyền vì biết grant đến từ đâu |
| Duplicate access | Phụ thuộc endpoint/client | Unique active index + advisory lock | Chặn duplicate kể cả khi có race |
| Payment mở rộng | Header payment gánh cả product/fulfillment | Product + item + resource + snapshot | Thêm product mới ít phải đổi schema lõi |
| Admin grant | Có nguy cơ bị hiểu như payment | `source=admin_grant`, actor/reason riêng | Không hoàn tiền nhầm grant miễn phí |
| Refund | Request và provider completion dễ bị trộn | Hai stage rõ ràng, full refund | Tránh đánh dấu refunded khi provider chưa xác nhận |
| Payment provenance | Có thể hard-delete làm mất lịch sử liên quan | FK `RESTRICT` + deletion test | Giữ liên kết audit/payment |
| Quiz score | Client gửi `is_correct` | Server tự tính | Client không thể tự sửa điểm |
| Quiz batch | Insert nhiều dòng trực tiếp | RPC atomic | Không còn batch nửa thành công |
| Cross-user writes | Rely nhiều vào app/RLS rời rạc | RLS, composite ownership và Gate 8 | Giảm phạm vi lan của bug authorization |
| Migration verification | Dựa vào report hoặc live state rời rạc | Frozen baseline, fingerprint, clean recreate | Dễ truy vết drift và recreate |

## 6. Lợi ích

### 6.1 Correctness và data integrity

- Các invariant quan trọng được chặn ở DB thay vì chỉ chặn ở một endpoint.
- Duplicate entitlement, orphan provenance và batch quiz partial write có lớp bảo vệ riêng.
- Retry payment/refund có contract idempotent rõ hơn.

### 6.2 Khả năng mở rộng

- `billing_products` và transaction items mở đường cho certificate, course access và product khác.
- Entitlement tách khỏi payment nên có thể thêm voucher, free enrollment hoặc partnership mà không giả payment.
- Refund tách khỏi entitlement giúp mở rộng provider/lifecycle mà không gộp tất cả vào một trạng thái.

### 6.3 Khả năng khoanh vùng bug

- Mỗi grant có source, actor, reason và transaction provenance.
- Payment item có fulfillment status/snapshot.
- State transition và conflict được ghi ở transaction/refund/item/grant riêng.
- Test có thể tái hiện theo từng flow thay vì phải suy ra từ nhiều bảng projection.

### 6.4 An toàn rollout

- Migration mới forward-only.
- Không rewrite migration cũ.
- Có preflight/backfill, clean recreate và incremental upgrade proof.
- Local verification không chạm Main/Staging.

## 7. Nhược điểm và trade-off

### 7.1 Vẫn còn projection kép

`course_entitlement_grants` là canonical mới nhưng `course_payment_access` và `enrollments` vẫn được đồng bộ để compatibility. Điều này giúp rollout an toàn nhưng tạm thời vẫn có nhiều nơi chứa cùng một phần thông tin.

**Hệ quả:** nếu consumer cũ tiếp tục ghi trực tiếp projection, drift vẫn có thể quay lại. Cần inventory consumer, chuyển reader/writer và chỉ cleanup sau observation period.

### 7.2 Migration/schema lớn hơn

Thêm product, item, entitlement, refund stage và RPC làm schema rõ hơn nhưng số object tăng. Người phát triển phải hiểu canonical path thay vì insert trực tiếp vào bảng cũ.

### 7.3 Tính linh hoạt làm giảm một phần strictness

`payment_transactions.course_id` và `purpose` được nới nullable để mở rộng payment product. Đây là trade-off có chủ đích: payment header tổng quát hơn, nhưng product/resource mapping phải được kiểm tra trong RPC và integration test.

### 7.4 Conflict payment có thể tạo refund request

Nếu hai flow cùng tranh quyền học, payment có thể được ghi nhận là payment fact nhưng fulfillment chuyển `conflict` và tạo refund request. Đây là cách bảo toàn tiền và entitlement, nhưng UI/ops phải hiển thị trạng thái này rõ ràng để không khiến user tưởng checkout hoàn tất bình thường.

### 7.5 Chưa có workload proof cho performance

Build và correctness test không chứng minh query nhanh hơn. Các index chỉ nên thêm/bỏ sau khi có query plan, latency, index size và write amplification từ workload Staging.

### 7.6 Chưa có live deployment proof

Local disposable DB chứng minh migration chain và logic có thể chạy, không chứng minh Supabase Main/Staging đã nhận migration hoặc Edge Function version mới. Phần đó phải chạy sau khi review và deploy được phê duyệt.

## 8. Đánh giá scope

### [FACT]

- Commit mới nhất chỉ chạm payment/entitlement/refund/quiz, test harness, migration và application compatibility.
- Có đúng 14 file candidate; không có file ngoài danh sách đã review.
- Không có thay đổi trực tiếp trên Supabase Main hoặc Staging.
- Instructor-facing AI thuộc issue #327 được giữ lại.
- Learner AI retirement và historical AI payment behavior vẫn được giữ theo baseline hiện tại.

### [INFERENCE]

Wave này **không vượt scope đã chốt cho candidate #325–#332 và DB canonical payment**, vì các thay đổi đều phục vụ access/payment/refund/AI-retirement compatibility/quiz integrity. Tuy nhiên, nó cũng **không phải toàn bộ master plan tối ưu hóa DB**.

Các phần sau không bị tự ý kéo vào wave này:

- Không cleanup toàn bộ legacy table/column/function/trigger.
- Không tự xử lý toàn bộ 8 function body drift.
- Không tự chọn canonical cho mọi RLS policy còn khác semantic.
- Không quyết định index chỉ dựa trên số lượng.
- Không triển khai retention/archival toàn hệ thống.
- Không đổi payment/admin-grant thành refund lẫn nhau.
- Không xóa instructor-facing AI.
- Không merge hoặc deploy remote.

## 9. Verification evidence

| Gate | Kết quả |
|---|---|
| `pnpm test` | PASS — 28 test files, 172 tests |
| `pnpm lint` | PASS — 0 error |
| `pnpm build:staging` | PASS — 3.817 modules; còn warning chunk lớn hơn 500 kB |
| `pnpm db:guard:test` | PASS — 206/206 |
| `pnpm db:verify` | PASS — 139 frozen migrations, drift allowlist và 206 tests |
| `pnpm db:verify:local` | PASS — clean recreate, SQL Gate 1–8, concurrency và HTTP E2E |
| HTTP callback E2E | PASS — 13/13 case thật |
| Incremental upgrade | PASS — `20260826120000` → `20260827120000` |
| `git diff --check` | PASS |
| Custom whitespace check | PASS |

Giải thích số migration:

- `157` là tổng số migration file trên candidate branch.
- `139 frozen migrations` là phần baseline được đóng băng mà verifier dùng để bảo vệ history.
- Hai con số này không phải cùng một loại count.

## 10. Vấn đề còn lại và mức độ

### P2 — Chưa có staging runtime evidence

- **Impact:** Chưa chứng minh migration/function/frontend candidate chạy trên environment Staging thật.
- **User impact:** Chưa có tác động vì chưa deploy.
- **Scope:** Release/deployment, không phải local implementation failure.
- **Evidence:** Candidate mới chỉ ở `origin/feat/db-canonical-payment-entitlements`; chưa merge `staging`.
- **Likelihood:** Chắc chắn cho đến khi deploy.
- **Confidence:** Cao.
- **Recommended action:** Review PR, merge vào staging chỉ khi được duyệt, sau đó chạy migration/deploy và manual/runtime QA.
- **Status:** Open — chờ staging execution.

### P3 — Migration provenance/history gap chưa giải quyết toàn bộ

- **Impact:** `origin/main` cũ không tự giải thích toàn bộ live history; rollback/recreate production vẫn cần provenance evidence.
- **User impact:** Không ảnh hưởng trực tiếp trong candidate hiện tại, nhưng tăng rủi ro release/recovery.
- **Scope:** Migration governance/live history.
- **Evidence:** Baseline audit ghi nhận live Main từng có 139 record trong khi `origin/main` có 131; candidate hiện có 157 migration files.
- **Likelihood:** Có thể gây lỗi khi tái tạo từ sai baseline.
- **Confidence:** Cao ở mức historical snapshot; mapping từng version vẫn cần evidence live mới.
- **Recommended action:** Chạy protected read-only history verification và cập nhật release manifest; không rewrite migration cũ.
- **Status:** Open / follow-up.

### P3 — Compatibility projection chưa cleanup

- **Impact:** Dữ liệu access tạm thời tồn tại ở canonical grant và projection cũ; writer sai có thể tái tạo drift.
- **User impact:** Có thể biểu hiện quyền học hoặc trạng thái enrollment không đồng nhất nếu consumer cũ bypass canonical path.
- **Scope:** Payment/access consumers.
- **Evidence:** Migration vẫn sync `course_payment_access` và `enrollments` để backward compatibility.
- **Likelihood:** Phụ thuộc consumer ngoài repo hoặc direct DB writer.
- **Confidence:** Trung bình đến cao.
- **Recommended action:** Inventory consumer, chuyển reader/writer, observe, rồi mới cleanup.
- **Status:** Planned / deferred.

### P4 — Performance và retention chưa hoàn tất

- **Impact:** Chưa có cơ sở khẳng định query/index/storage đã tối ưu theo workload thật.
- **User impact:** Có thể ảnh hưởng latency/cost khi data tăng, nhưng chưa có measurement để định lượng.
- **Scope:** Index, query plan, lifecycle/retention.
- **Evidence:** Audit đã defer Staging-only index; chưa có workload benchmark trong wave này.
- **Likelihood:** Tăng theo quy mô dữ liệu.
- **Confidence:** Cao.
- **Recommended action:** Tách performance/lifecycle task, đo query plan và retention trước khi sửa index hoặc drop data.
- **Status:** Deferred.

### Quyết định phạm vi trước Staging

- `[DECISION]` Bỏ hạng mục 4 cột và 3 CHECK constraint Main-only của `ai_vouchers` khỏi backlog và khỏi điều kiện chặn Staging.
- Quyết định này chỉ cập nhật phạm vi xử lý hiện tại; không ghi nhận rằng các cột đã bị drop trên database remote.

## 11. Những việc chưa được tuyên bố là đã xong

- Chưa xác minh live Main/Staging parity sau candidate migration.
- Chưa có successful staging deployment hoặc observation window.
- Chưa có production provenance mới cho backup/artifact.
- Chưa chốt/xử lý mọi policy/function/trigger drift của snapshot ban đầu.
- Chưa xác minh external consumer ngoài repository.
- Chưa drop legacy projection hoặc bảng AI historical.
- Chưa đo performance theo workload thật.
- Chưa làm retention/archival policy toàn hệ thống.

## 12. Trạng thái release và bước tiếp theo

### Trạng thái hiện tại

- Local implementation: `PASS`.
- Local database verification: `PASS`.
- Candidate branch: đã push.
- `staging`: chưa thay đổi.
- `main`: chưa thay đổi.
- Supabase remote writes: `NONE`.
- Merge/deploy: `NONE`.

### Việc cần hoàn tất trước khi đưa lên Staging

1. `[ ]` Lead review diff và business contract của payment, refund, admin grant và quiz.
2. `[ ]` Kiểm tra consumer ngoài repo và xác nhận không có writer cũ làm lệch entitlement projection.
3. `[ ]` Đối chiếu migration state của Staging với candidate, xác nhận thứ tự migration và kế hoạch rollback.
4. `[ ]` Chạy lại các local gate trên đúng commit sạch dùng để đưa lên Staging.
5. `[ ]` Kiểm tra đúng project `corelia-staging`, đúng branch và đúng environment.
6. `[ ]` Có xác nhận trực tiếp cho merge đúng source `feat/db-canonical-payment-entitlements` → target `staging`.

### Sau khi được phép đưa lên Staging

1. Chụp snapshot/backup Staging trước khi apply.
2. Apply migration và deploy application theo release plan.
3. Verify catalog, RLS, payment, refund, admin grant, quiz và instructor-facing AI trên runtime thật.
4. Ghi evidence, xử lý regression và chỉ khi đạt mới mở observation window.

Performance/index, retention và legacy cleanup là các task sau; không gộp vào release này.

## 13. Tài liệu liên quan

- `docs/corelia-db-optimization-master-plan.md`
- `docs/corelia-db-final-preimplementation-plan.md`
- `docs/db-baseline/README.md`
- `docs/db-baseline/wave-0-implementation-report.md`
- `docs/db-baseline/g2-canonical-state-integrity-implementation-report.md`
- `docs/db-baseline/g2-r1-db-harness-remediation-report.md`
- `docs/db-baseline/main-g2-r1-rollout-plan.md`

## 14. Quy ước phân loại

- `P0`: incident, mất dữ liệu hoặc security compromise đang xảy ra.
- `P1`: correctness/security/money/access nghiêm trọng.
- `P2`: integrity/architecture có thể gây bug đáng kể hoặc chặn release.
- `P3`: maintainability, debug hoặc migration risk đáng kể.
- `P4`: performance/cleanup cần thêm evidence.
- `P5`: naming/documentation debt thấp.

Mọi kết luận về live environment phải tiếp tục tách `[FACT]` khỏi `[INFERENCE]`; local PASS không được ghi thành staging/production PASS.
