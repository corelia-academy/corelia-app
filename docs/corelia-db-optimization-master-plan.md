# Corelia Database Optimization — Master Plan

> Phạm vi: audit và lập kế hoạch. Tài liệu này không tự thay đổi code, database, migration history hoặc production.
>
> Cập nhật: 2026-08-23 | Target: `corelia-app` / Main Production và `corelia-staging` / Staging

## Quy ước đọc tài liệu

- `[FACT]`: đã đối chiếu từ live catalog, migration, repository, workflow hoặc code.
- `[INFERENCE]`: suy luận kỹ thuật từ các fact; chưa phải quyết định triển khai.
- `[DECISION NEEDED]`: cần chốt nghiệp vụ, security hoặc release trước khi làm.
- `[UNKNOWN]`: chưa đủ evidence; không được tự điền bằng best practice.
- Priority dùng P0–P5: P0 incident/data loss/security compromise; P1 correctness/security/money/access; P2 integrity/architecture gây bug đáng kể; P3 maintainability/debuggability; P4 performance/cleanup cần thêm evidence; P5 naming/debt thấp.

## 1. Executive Summary

### Trạng thái hiện tại

- `[FACT]` Main và Staging có cùng 68 table, 68 primary key, 104 foreign key và 16 unique constraint. Đây là phần nền tảng đang khá đồng nhất.
- `[FACT]` Hai môi trường chưa phải cùng một released schema: Main có 637 column, Staging 633; CHECK là 87/84; index là 207/213; RLS policy là 149/152.
- `[FACT]` Drift rủi ro cao tập trung ở RLS definition, function body, credential activity trigger và 4 field/3 CHECK Main-only của `ai_vouchers`.
- `[FACT]` Repo `origin/main` có 131 migration trong khi live Main đã ghi nhận 139; repo/current Staging có 139. Migration count giống nhau không chứng minh SQL history giống nhau: đã có 12 version cùng tên nhưng statement khác.
- `[FACT]` Quota AI hiện tách hai ý nghĩa: rolling 3 giờ đếm attempt/user conversation; monthly/token usage chỉ tăng sau `upsertUsage()` ở successful usage path. Failed request tạo attempt nhưng không tăng monthly successful quota.

### Rủi ro lớn nhất

1. `[P1]` Authorization drift có thể cho phép/từ chối cùng một thao tác khác nhau giữa Main và Staging.
2. `[P1]` Migration/repository history không giải thích đầy đủ live state, làm giảm khả năng recreate và rollback database.
3. `[P1]` Business state của payment/access/refund/credential chưa được biểu diễn thành một transition model thống nhất.
4. `[P2]` `ai_vouchers` đang có hai mô hình: repo/runtime coi batch là cấu hình, còn Main live có thêm cấu hình trên voucher code.
5. `[P2]` Nhiều function/trigger có behavior khác nhau nhưng chưa có contract và test parity đủ rõ.

### Điểm tốt hiện tại

- `[FACT]` FK/PK/unique ở cấp catalog đang parity.
- `[FACT]` Repo đã có migration idempotent recovery cho `ai_voucher` tables và đã có workflow deploy riêng cho Staging/Main.
- `[FACT]` Production workflow có branch/environment gate và bước migration riêng; tuy nhiên việc `migration repair` vẫn cần audit nguyên nhân và guardrail.

### Kết luận điều hành

`[INFERENCE]` Không nên bắt đầu bằng cleanup hoặc merge toàn bộ drift. Thứ tự an toàn là: chốt canonical behavior của correctness/security → bổ sung compatibility và data preflight → reconciliation migration nhỏ → staging validation → production rollout → performance/cleanup sau cùng.

## 2. Current Baseline

### 2.1 Project và môi trường

| Target | Vai trò | Supabase ref | Quyền thao tác trong task |
|---|---|---|---|
| `corelia-app` | Main / Production | `lawhkvyyoznwygzsycan` | Read-only trong audit; mọi write cần xác nhận trực tiếp |
| `corelia-staging` | Staging | `opoozbmfbezkrpzxsusx` | Read-only trong audit; dùng để validate kế hoạch |

### 2.2 Catalog parity

| Hạng mục | Main | Staging | Nhận định |
|---|---:|---:|---|
| Tables | 68 | 68 | `[FACT]` parity |
| Columns | 637 | 633 | `[FACT]` Staging thiếu 4 column trong `ai_vouchers` |
| Primary keys | 68 | 68 | `[FACT]` parity |
| Foreign keys | 104 | 104 | `[FACT]` parity |
| Unique constraints | 16 | 16 | `[FACT]` parity |
| CHECK constraints | 87 | 84 | `[FACT]` Staging thiếu 3 CHECK của `ai_vouchers` |
| Indexes | 207 | 213 | `[FACT]` Staging có index dư; phần performance defer Task 9 |
| RLS policies | 149 | 152 | `[FACT]` 13 definition diff, 3 Main-only, 6 Staging-only |
| Functions | 118 | 118 | `[FACT]` 8 body definition diff |
| Triggers | 38 | 38 | `[FACT]` credential trigger behavior khác |

### 2.3 Migration/repository baseline

- `[FACT]` `supabase/config.toml` bật migration và seed; migration là chain chính của local/test environment.
- `[FACT]` `.github/workflows/deploy-staging.yml` chạy `supabase migration up --linked --include-all` và deploy Edge Functions khi thay đổi trên branch Staging.
- `[FACT]` `.github/workflows/deploy-prod.yml` chạy migration trên production, có bước repair cho version `20260709000009`, sau đó deploy Edge Functions.
- `[FACT]` Repo Main hiện có 131 migration; Staging có thêm 8 migration từ sau commit Main tương ứng, đến `20260818120000_clean_legacy_manual_mint_templates`.
- `[FACT]` Live Main/Staging đều có 139 version record nhưng có 12 version cùng tên khác SQL. Hai null statement version là `20260506074210` và `20260506074327`.
- `[INFERENCE]` Live Main có thể đã nhận migration từ branch/SQL path không còn phản ánh đầy đủ trên `origin/main`; chưa đủ evidence để gắn từng version vào một commit duy nhất.

### 2.4 Evidence boundary

- `[FACT]` Evidence đã có: catalog counts, object names, migration files, workflow, Edge Functions và các consumer trong repo.
- `[UNKNOWN]` Exact Main policy/function body và live row-level usage của một số legacy object chưa được đọc lại trong phiên này do session dashboard hiện không còn truy cập ổn định. Trước khi viết reconciliation migration phải chạy lại catalog query read-only và lưu snapshot timestamped.
- `[UNKNOWN]` Chưa có evidence về consumer ngoài repository. Không được kết luận object không còn dùng chỉ vì `rg` không tìm thấy trong repo.

## 3. Completed Decisions từ Task 1 và Task 2

### 3.1 Source of Truth đã chốt ở mức nghiệp vụ

| Domain | Canonical truth | Điều phải làm khi implement |
|---|---|---|
| Course content | Locale tables là truth của content theo ngôn ngữ; `*.data` chỉ metadata/fallback có contract | Map reader/writer, backfill rồi mới cleanup |
| Payment | `payment_transactions` là payment fact; `enrollments` là quan hệ học tập | Audit consumer `paid_*`, chuyển reader, deprecate an toàn |
| Project/submission | Submission là truth của bài nộp; project là portfolio độc lập sau khi tạo | Chặn sync ghi đè ngược nếu không có business rule |
| Refund/access | Tách refund và entitlement/access theo state | Thiết kế state machine, không dùng một revoke rule chung |
| Admin grant | Grant là entitlement có source riêng, không giả payment | Lưu source và audit actor |
| AI quota | Successful usage tính theo message semantics; attempt/fail tách rate-limit/anti-spam | Chuẩn hóa tên và contract; chốt failed request quota riêng |

### 3.2 Canonical schema process

- `[DECISION]` Schema change chính thức phải qua migration mới.
- `[DECISION]` Không rewrite hoặc sửa nội dung migration đã apply.
- `[DECISION]` Emergency/manual SQL phải có ticket, actor, SQL captured, deadline tạo reconciliation migration và post-check.
- `[INFERENCE]` Nhiều migration không tự là vấn đề. Nếu bootstrap mới chậm, dùng baseline cho environment mới nhưng giữ mapping với immutable production history.

## 4. Task 3 — Final Reconciliation State

### 4.1 Canonicality rule

`[DECISION NEEDED]` “Canonical” không được chọn chỉ theo Main, Staging hoặc repo. Mỗi object phải qua 3 lớp: business behavior hiện tại, consumer thực tế, và khả năng recreate bằng migration. Nếu ba lớp không khớp, giữ `UNKNOWN_NEEDS_DECISION` và không merge tự động.

### 4.2 Blocker matrix

| Blocker | Evidence hiện có | Canonical tạm thời | Chưa được chốt | Loại handle |
|---|---|---|---|---|
| 13 RLS cùng tên khác definition | Policy name/definition diff giữa Main/Staging | Chưa chốt theo tên; phải chốt theo actor/action | Exact Main body và test permission | RLS + TEST |
| 8 function khác body | Catalog hash và migration sources | Repo migration gần nhất chỉ là candidate | Exact body, privilege, caller, result contract | FUNCTION/RPC + TEST |
| Credential activity trigger | Có lịch sử add guard rồi revert guard | Chưa chốt điều kiện `oc_credential_id` | Minted/issued semantic, retry/dedupe | TRIGGER + OBSERVABILITY |
| 4 `ai_vouchers` Main-only column + 3 CHECK | Main có field; repo/runtime dùng batch config | Batch là configuration, voucher là code theo Task 1 | Live data, external consumer, compatibility | MIGRATION + CODE + DATA_BACKFILL |
| 131 repo Main vs 139 live Main | Git/workflow/history gap | Không rewrite live history | Provenance 8 version và repair event | CI/CD + DOCUMENTATION |
| External consumer legacy | Repo search chưa thấy | Không được giả định không có | Consumer inventory/evidence | DOCUMENTATION + CODE nếu có |

### 4.3 `ai_vouchers` canonical direction

- `[FACT]` Migration `20260519101719_ai_vouchers.sql` và `20260620112000_ensure_ai_voucher_tables.sql` đặt discount/window ở `ai_voucher_batches`; `ai_vouchers` là code, active, metadata.
- `[FACT]` `supabase/functions/corelia-api/payments/vouchers.ts` đọc discount/window từ batch và đếm redemption theo `voucher_id`; `src/lib/aiVouchers.ts` cũng model batch là nơi chứa cấu hình.
- `[INFERENCE]` 4 field Main-only (`percent_off`, `starts_at`, `ends_at`, `max_redemptions`) nhiều khả năng là legacy/side-path, không phải canonical runtime model hiện tại.
- `[DECISION NEEDED]` Chỉ được đưa vào cleanup sau khi query live data, tìm consumer ngoài repo và xác nhận không có endpoint/cron/RPC phụ thuộc.
- `[RECOMMENDED]` Trước mắt giữ field ở Main, không drop; tạo compatibility/read-only audit; nếu không có consumer thì stop write → observe → drop qua migration riêng.

### 4.4 Credential activity canonical direction

- `[FACT]` `20260709000009_activity_feed_credential_id_guard.sql` từng thêm guard `oc_credential_id` và dedupe; `20260709000010_revert_credential_activity_oc_guard.sql` revert về status-only; `20260710000000_activity_feed_credential_title.sql` tiếp tục status-only với title payload.
- `[INFERENCE]` History cho thấy guard đã từng gây compatibility concern hoặc business disagreement; không thể tự chọn bản có guard chỉ vì có vẻ chặt hơn.
- `[DECISION NEEDED]` Xác định “issued/minted/public” là status transition nào và activity có cần `oc_credential_id` hay không.
- `[RECOMMENDED]` Chốt event contract trước; sau đó chọn trigger idempotency key và test retry/concurrent update. Không reconcile bằng cách copy function body giữa hai môi trường khi semantic chưa được duyệt.

### 4.5 Reconciliation order

1. Chốt business contract và consumer.
2. Thêm compatibility code nếu schema mới cần reader/writer kép.
3. Backfill/preflight dữ liệu.
4. Áp dụng constraint/column đúng canonical state.
5. Reconcile RLS và function theo contract.
6. Reconcile trigger/observability.
7. Staging validation và parity checkpoint.
8. Main rollout sau xác nhận trực tiếp.
9. Cleanup legacy sau compatibility period.

### 4.6 Released baseline checkpoint

Sau reconciliation, catalog hash của Main và released portion của Staging phải khớp ở tables, columns, constraints, RLS, functions và triggers. Index thuần performance được tách khỏi checkpoint; Staging-only feature chỉ được phép nếu có manifest gồm owner, migration, reason, expected release và expiry/review date.

## 5. Table Role Matrix

`[FACT]` Danh sách dưới đây lấy từ live Main snapshot 68 table. Role, truth và rebuildability là `[INFERENCE]` cần xác nhận bằng writer/reader trace ở Task 4; không dùng matrix này để drop object.

| Table | Domain | Role dự kiến | Truth? | Rebuildable? | Cleanup/retention note |
|---|---|---|---|---|---|
| `profiles` | identity | CANONICAL_ENTITY | Yes | No | Giữ; audit PII/RLS |
| `public_profiles` | identity | PROJECTION | No | Yes | Verify writer/sync trước cleanup |
| `notification_preferences` | identity | CONFIG | Yes | No | Giữ; owner/RLS |
| `follows` | social | RELATION | Yes | No | Composite uniqueness/anti-self-follow cần audit |
| `user_learning_profile` | learning | SNAPSHOT/PROJECTION | Unknown | Maybe | Xác định rebuild từ observations |
| `courses` | course | CANONICAL_ENTITY | Yes | No | Giữ; owner/status lifecycle |
| `course_locales` | course | CANONICAL_ENTITY | Yes (content) | No | Truth của localized content |
| `course_sections` | course | CANONICAL_ENTITY | Yes | No | Parent của lesson/question |
| `course_section_locales` | course | CANONICAL_ENTITY | Yes (content) | No | Truth localized section |
| `course_lessons` | course | CANONICAL_ENTITY | Yes | No | Composite parent relation |
| `course_lesson_locales` | course | CANONICAL_ENTITY | Yes (content) | No | Truth localized lesson |
| `course_section_questions` | quiz | CANONICAL_ENTITY | Yes | No | Course/section relation cần constraint |
| `section_question_attempts` | quiz | EVENT_LOG/RELATION | No | No | Append/audit; retention cần decision |
| `lesson_progress` | learning | CANONICAL_ENTITY | Yes | No | State/ownership/RLS critical |
| `lesson_readiness_checks` | learning | PROJECTION | No | Yes | Verify source và rebuild path |
| `lesson_summaries` | learning | PROJECTION | No | Yes | JSON/content duplication risk |
| `flashcard_decks` | learning | CANONICAL_ENTITY | Yes | No | Course/lesson ownership audit |
| `learning_observations` | learning | EVENT_LOG | No | No | Retention/PII cần chốt |
| `learning_paths` | learning | SNAPSHOT/PROJECTION | No | Maybe | Không dùng làm truth nếu rebuild được |
| `learning_reminder_logs` | learning | EVENT_LOG | No | No | Retention và retry audit |
| `enrollments` | access | RELATION | Yes (learning relation) | No | Không giữ payment fact duplicate |
| `course_payment_access` | access | PROJECTION/RELATION | No | Yes | Truth source của entitlement cần chốt |
| `payment_transactions` | payment | LEDGER/EVENT_LOG | Yes (payment fact) | No | Immutable/audit/retention |
| `course_discounts` | payment | CONFIG | Yes | No | Writer/expiry/index audit |
| `course_co_instructor_invites` | course | RELATION/QUEUE | Yes | No | Invite expiry/acceptance and course permission audit |
| `ai_subscriptions` | AI/payment | CANONICAL_ENTITY | Yes | No | State machine/one-active audit |
| `ai_usage_log` | AI | EVENT_LOG | Yes (usage event) | No | High growth; retention decision |
| `ai_usage_daily` | AI | AGGREGATE | No | Yes | Rebuild from usage log if contract holds |
| `ai_usage_monthly` | AI | AGGREGATE | No | Yes | Quota snapshot; consistency audit |
| `ai_conversations` | AI | CANONICAL_ENTITY/EVENT_LOG | Yes (conversation) | No | Failed attempt semantics cần document |
| `ai_chat_sessions` | AI | CANONICAL_ENTITY | Yes | No | Session lifecycle/retention |
| `ai_model_pricing` | AI | CONFIG | Yes | No | Version/immutable pricing audit |
| `ai_voucher_batches` | AI/payment | CONFIG | Yes (voucher config) | No | Canonical discount/window candidate |
| `ai_vouchers` | AI/payment | RELATION/CANONICAL code | Yes (code) | No | Main-only fields compatibility blocker |
| `ai_voucher_redemptions` | AI/payment | EVENT_LOG/LEDGER | Yes (usage history) | No | Partial unique paid rule critical |
| `activity_events` | audit | EVENT_LOG | No | No | Retention/PII/dedupe |
| `search_query_events` | analytics | EVENT_LOG | No | No | Retention and privacy |
| `email_delivery_attempts` | notification | EVENT_LOG/QUEUE | No | No | Retry/provider ID/retention |
| `user_notifications` | notification | CANONICAL_ENTITY | Yes | No | Delivery/read state machine |
| `course_blast_logs` | notification | EVENT_LOG | No | No | Retention/retry |
| `user_daily_streaks` | gamification | SNAPSHOT/AGGREGATE | No | Maybe | Truth vs claims must be explicit |
| `user_daily_streak_claims` | gamification | EVENT_LOG/LEDGER | Yes (claim) | No | Duplicate claim invariant |
| `user_streak_milestone_unlocks` | gamification | LEDGER | Yes (unlock) | No | Idempotent grant |
| `user_point_ledger` | gamification | LEDGER | Yes (points fact) | No | Append-only; counter reconciliation |
| `credential_templates` | credential | CONFIG | Yes | No | Version/immutable snapshot |
| `credential_issuances` | credential | CANONICAL_ENTITY/EVENT_LOG | Yes | No | Lifecycle/trigger critical |
| `pending_credential_issuances` | credential | QUEUE/JOB | No | No | Retry/expiry/cleanup |
| `certificate_records` | credential | PROJECTION/CANONICAL record | Unknown | Maybe | Relation to issuance/readiness |
| `final_assignment_submissions` | course | CANONICAL_ENTITY | Yes (submission) | No | Project sync ambiguity |
| `project_collaborators` | project | RELATION | Yes | No | Permission boundary |
| `project_collaboration_invites` | project | QUEUE/RELATION | Yes | No | Expiry/retry |
| `project_comments` | project | EVENT_LOG/CANONICAL | Yes | No | Soft delete/PII |
| `project_hearts` | social | RELATION | Yes | No | Unique actor/project |
| `projects` | project | CANONICAL_ENTITY | Yes (portfolio) | No | Independent after creation |
| `project_locales` | project | PROJECTION/CANONICAL content | Unknown | No | Content truth needs confirm |
| `hackathons` | hackathon | CANONICAL_ENTITY | Yes | No | Lifecycle |
| `hackathon_locales` | hackathon | CANONICAL_ENTITY | Yes (content) | No | Localized truth |
| `hackathon_registrations` | hackathon | RELATION | Yes | No | Capacity/status invariant |
| `hackathon_access_invites` | hackathon | QUEUE/RELATION | Yes | No | Token/expiry/usage |
| `hackathon_submissions` | hackathon | CANONICAL_ENTITY | Yes | No | One submission/state audit |
| `hackathon_scores` | hackathon | CANONICAL_ENTITY | Yes | No | Judge/score immutability |
| `career_tracks` | career | CANONICAL_ENTITY | Yes | No | Status/ordering |
| `career_track_locales` | career | CANONICAL_ENTITY | Yes (content) | No | Localized truth |
| `career_track_courses` | career | RELATION | Yes | No | Composite uniqueness |
| `dashboard_configs` | admin | CONFIG | Yes | No | RLS drift blocker |
| `system_settings` | admin | CONFIG | Yes | No | Privileged write boundary |
| `tier_limits` | admin/billing | CONFIG | Yes | No | Quota contract |
| `knowledge_chunks` | AI/search | PROJECTION | No | Yes | Embedding rebuild/PII audit |

### 5.1 Required Task 4 outputs

- Trace all INSERT/UPDATE/DELETE readers from Edge Functions, `src`, RPC, trigger, cron and migrations; mark each row `[FACT]` with path.
- Separate canonical entity, projection, snapshot, event log, ledger and cache. Similar columns are not sufficient reason to merge.
- For every cleanup candidate prove: no writer, no reader, no trigger/RPC/cron dependency, no known external consumer, data migrated, compatibility period elapsed, and recovery path.
- Flag tables with only writer, only reader, JSONB duplicate, no retention, or no rebuild path as Task 4 issues rather than immediately as cleanup.

## 6. Business Invariant Matrix

`[INFERENCE]` The mechanisms below are candidates. Each must have a preflight query and violation count before migration.

| Domain | Invariant to verify | Current enforcement | Proposed mechanism | Priority |
|---|---|---|---|---|
| Identity | Profile belongs to `auth.uid`; public projection cannot expose private fields | RLS/app | RLS + projection contract | P1 |
| Course | Section/lesson/question parent relation is valid and same-course | FK/composite FK partly present | Composite FK where schema allows; preflight orphan | P1 |
| Progress | One user/course/lesson logical record; lesson belongs to course | App/RPC + FK | Composite unique + composite FK if valid | P1 |
| Quiz | Attempt references question and correct course/lesson | FK partly present | Composite FK/check; server truth for score | P1 |
| Payment | Payment fact is immutable enough for audit; enrollment is not payment source | App | Constraint/state transition + code contract | P1 |
| Access | Entitlement has source and valid expiry/revoke transition | App/RPC | Explicit source/state columns and transition guard | P1 |
| Voucher | One paid redemption per canonical scope; code/batch relation valid | Partial unique index | Keep/verify canonical partial unique; no blind merge | P1 |
| Subscription | At most one active subscription per user/product scope | Unknown | Partial unique only after product scope confirmed | P1 |
| Credential | Issuance/template/course relation valid; issued record not overwritten | Trigger/app | FK + immutable snapshot/transition trigger only if needed | P1 |
| Project | Submission is not overwritten by later project edits | App ambiguity | Separate write paths; unique source relation if business permits | P2 |
| Streak | One valid claim per user/day; points/unlock idempotent | RPC/unique partly | Unique claim + ledger idempotency | P1 |
| Counter | Aggregate/counter can reconcile to raw event/ledger | App | Reconciliation query and repair process | P2 |

### 6.1 Preflight required for every stronger constraint

1. Query duplicate/orphan/invalid rows and record count.
2. Decide fix direction and whether data is user-visible or financial.
3. Estimate lock and write impact in Staging.
4. Backfill/fix before `NOT NULL`, FK, CHECK or unique constraint.
5. Apply constraint only after compatibility tests pass.

## 7. Authorization Model / RLS

### 7.1 Actor model

`anonymous` → public read only; `authenticated learner` → own data; `owner` → owned resource; `instructor/course staff` → assigned course; `support` → support scope; `admin` → administrative scope; `service role/server` → server-only privileged path; `cron/system` → explicit function/service boundary.

### 7.2 Required action matrix

| Domain | Anonymous | Learner/owner | Instructor/staff | Support/admin | Server/cron |
|---|---|---|---|---|---|
| Profiles/public profile | Public projection only | Own profile | Scoped support only | Staff/admin review | Sync/projection job |
| Course content | Published read | Enrolled read | Own/assigned write | Admin override | Localization/backfill |
| Progress/quiz | None | Own read/write via valid lesson | Assigned course read/review | Support investigation | Integrity RPC |
| Payment/access | None | Own read | Course-scoped access view | Support/admin resolution | Provider/webhook/RPC |
| Credential | Public record if allowed | Own issuance | Course-scoped review | Admin issue/revoke | Mint/attestation job |
| AI usage/quota | None | Own usage | None by default | Support aggregate only | Accounting/cron |
| Admin/config/log | None | None | Explicit staff scope | Admin only | Service/cron only |

`[DECISION NEEDED]` Exact scope of instructor/support/admin actions must be checked against product permission model before policy merge.

### 7.3 RLS blocker handling

- Diff exact `command`, `roles`, `USING`, `WITH CHECK`, helper schema, function security and grants for all 13 common-name policies.
- Main-only policies: `lesson_progress_write_own`, `profiles_update_self`, `profiles_update_staff`.
- Staging-only policies: `dashboard_configs_delete_staff`, `dashboard_configs_update_staff`, `lesson_progress_delete_own`, `lesson_progress_insert_own`, `lesson_progress_update_own`, `profiles_update_self_or_staff`.
- `[FACT]` Both environments contain `public` and `private` `is_admin_or_support()`; the existence of both is not itself a bug. The call schema and security context must be normalized.
- Do not reduce policy count just to make the number smaller. Canonicalization is by permission behavior.

### 7.4 RLS test minimum

For each affected table test anonymous, authenticated self, authenticated other user, owner, instructor/course staff, support/admin, service/cron; test SELECT/INSERT/UPDATE/DELETE and both rejected and accepted paths. Capture expected denial reason and no data leakage.

## 8. State Machine & Transaction Map

`[FACT]` Exact allowed states must be extracted from enums/checks/functions/Edge Functions before writing the final matrices. The following is the audit target, not an invented canonical state list.

| Entity | States/transitions to extract | Transaction/idempotency concern |
|---|---|---|
| Payment | pending/processing/success/failure/refund states from code/schema | Duplicate webhook, provider ID, payment→access atomicity |
| Entitlement/access | grant/payment/admin, active/expired/revoked | Separate refund revoke from admin revoke |
| Refund | requested/approved/processed/failed | Provider retry and access policy |
| Voucher redemption | reserved/paid/released | Concurrency and partial unique scope |
| Enrollment completion | incomplete/completed/reopened if allowed | Progress/quiz/credential half-state |
| Credential issuance | pending/issued/failed/revoked if supported | Certificate/activity/OC ID and dedupe |
| Assignment submission | draft/submitted/reviewed/graded | Immutable submitted snapshot and retry |
| AI subscription | trial/active/past_due/canceled/expired | One-active uniqueness and billing retry |
| Notification/email | queued/sent/failed/retry | Provider ID, retry count, idempotency |
| Hackathon/submission | registration/open/closed/submitted/scored | Deadline and duplicate submission |

Required output per entity: state list, transition matrix, actor, preconditions, side effects, transaction boundary, invalid transition, retry behavior and recovery procedure.

## 9. Observability & Auditability

| Flow | Must trace | Current gap to verify | Initial priority |
|---|---|---|---:|
| Payment/webhook | request/order/provider ID, actor, before/after, retry, final state | `[UNKNOWN]` provider/event correlation completeness | P1 |
| Refund | refund ID, payment ID, access transition, provider response | `[UNKNOWN]` separate revoke reason | P1 |
| Entitlement/admin grant | grant source, actor, expiry, reason | `[UNKNOWN]` source is consistently stored | P1 |
| Voucher | batch/code/user, reservation/payment/release, dedupe | Main/Staging uniqueness scope differs | P1 |
| Credential/certificate | issuance ID, OC ID, transition, activity event | Credential trigger behavior differs | P1 |
| AI usage/quota | request ID, usage event, model, tokens, quota bucket, outcome | Failed request vs successful usage contract needs test | P2 |
| Notification/email | delivery attempt, provider ID, retry, error | Delivery retention and correlation | P2 |
| Destructive admin action | actor, target, reason, before/after | `[UNKNOWN]` immutable audit coverage | P1 |

Keep application log, business event, audit log, provider log and database record distinct. Do not copy the same payload into multiple durable tables without a consumer/rebuild reason. Avoid secrets and unnecessary PII in events.

## 10. Performance & Index Plan

### 10.1 Evidence boundary

- `[FACT]` Main has 207 indexes and Staging 213. Staging-only names previously identified: `contest_reg_user_id_idx`, `contest_sub_user_id_idx`, `course_discounts_created_by_idx`, `course_discounts_updated_by_idx`, `course_lessons_course_section_idx`, `course_payment_access_course_id_idx`, `fas_user_id_idx`, `lesson_progress_course_id_idx`.
- `[FACT]` Main has an index named `ai_voucher_redemptions_one_paid_per_user_voucher` on `(voucher_id,user_id)` with `status = 'paid'`; repo/runtime migration defines `ai_voucher_redemptions_one_paid_per_voucher` on `(voucher_id)` with `status = 'paid'`.
- `[FACT]` Main also has `public_profiles_handle_idx` on a lower(username)/OCID expression; repo has a related `public_profiles_handle_lookup_idx`. The exact overlap and runtime usage need plan verification.
- `[INFERENCE]` Staging-only indexes should not block Task 3. They may be useful, redundant or unneeded; decide from workload, not count.

### 10.2 Required evidence before KEEP/ADD/DROP

Collect read-only: `pg_stat_statements`, slow query logs, table/index size, index usage window, sequential scans, row counts, growth rate, query patterns in `src`/Edge Functions, and safe `EXPLAIN (ANALYZE, BUFFERS)` in Staging. Avoid production load from diagnostic queries.

| Index decision | Required proof |
|---|---|
| KEEP | Serves a known query or integrity constraint |
| ADD | Query shape/workload and measured plan benefit |
| DROP_LATER | No known consumer, low usage over representative window, rollback path |
| MODIFY | Existing index overlaps but does not satisfy predicate/order |
| UNKNOWN | Runtime window or consumer evidence insufficient |

Do not drop an index only because `idx_scan = 0` in a short window. Evaluate write amplification, storage, partial predicate, composite order, FK lookup and concurrent migration cost.

## 11. Cleanup Candidates

No object is approved for immediate drop by this plan.

| Candidate | Why it may be redundant | Proof required | Safe sequence |
|---|---|---|---|
| `ai_vouchers` Main-only fields/checks | Duplicate batch configuration model | Live rows, all writers/readers, external consumer, product decision | Freeze writes → compatibility observe → remove |
| Main/Staging divergent RLS | Old policy variants | Exact semantic diff and actor tests | New canonical policy → test → remove obsolete |
| Old function body/version | Migration drift or revert path | Caller/result/security diff | Replace with contract → deploy caller → observe |
| Credential trigger guard variant | Behavior changed by revert migration | Mint/issued definition and retry tests | Contract → trigger migration → event verification |
| Main-only profile lookup index | Possible legacy/public projection overlap | Query plans and actual table usage | Keep until workload audit |
| Staging-only indexes | Possible unneeded performance additions | Representative workload and size | Defer Task 9; drop only later |
| Legacy JSONB/duplicate fields | Possible content/source duplication | Writer/reader and backfill evidence | Stop writes → switch readers → remove |

Cleanup pattern: `deprecate → stop writes → switch reads → observe → remove dependency → migration cleanup`. A migration that drops data or security boundary is destructive and must be last in its wave.

## 12. Validation & Production Rollout Standard

### 12.1 Preflight gate

- Verify target project, ref, branch and environment.
- Verify migration version and expected catalog delta.
- Check backup/recovery capability, lock estimate and affected rows.
- Run invariant queries; record zero/accepted violation count.
- Verify application compatibility with expand/contract ordering.
- Confirm intentional Staging drift manifest.
- For Main: obtain direct confirmation before any write/deploy/push.

### 12.2 Staging validation

1. Catalog: tables, columns, PK/FK/unique/CHECK, indexes, RLS, function and trigger fingerprints.
2. Integrity: orphan, duplicate, invalid relation, invalid state, ledger/counter reconciliation.
3. Security: anonymous, learner, owner, instructor, staff/support, admin and service role paths.
4. Business flows: signup/profile, course read, enrollment, progress, quiz, checkout/payment, access, refund, voucher, admin grant, credential, AI quota, project, hackathon, notification and streak.
5. Performance: key query regression, write latency, query plan and index effect.
6. Failure paths: duplicate webhook, retry, concurrent update, partial response, timeout, rollback/recovery.

### 12.3 Main rollout

Use backward-compatible expand/contract when readers and writers cannot change atomically. Deploy compatibility code first, then schema/data, then switch readers/writers, then remove legacy after observation. Record post-deploy migration, catalog, row count, invariant, error rate, RLS denial anomaly, business flow and performance checks.

Rollback is not automatically “down migration”. For data changes define forward repair, restore/recovery boundary, and consumer rollback separately.

## 13. Data Lifecycle / Retention

`[DECISION NEEDED]` Retention cannot be chosen from table names alone; business, legal, privacy and audit requirements are missing.

| Data group | Growth/value question | Retention decision | Safe next step |
|---|---|---|---|
| `ai_usage_log` | Billing/quota audit vs privacy | UNKNOWN | Define monthly audit and PII policy |
| `activity_events` | User timeline vs security audit | UNKNOWN | Separate product event from audit event |
| `email_delivery_attempts` | Provider troubleshooting/retry | UNKNOWN | Keep provider ID/error/retry; set expiry after decision |
| `learning_reminder_logs` | Retry/debug evidence | UNKNOWN | Define operational window and archive |
| `payment_transactions` | Financial/audit fact | Keep according to finance/legal decision | Never purge as ordinary cleanup |
| `credential_issuances`/`certificate_records` | Credential verification history | Likely long-lived; confirm | Preserve immutable evidence |
| `user_notifications` | Product inbox | UNKNOWN | Archive/read-delete policy |
| queue/pending objects | Retryable temporary data | UNKNOWN | Expiry, dead-letter and replay policy |

Do not purge or archive until rebuildability, audit dependency, PII and recovery are documented.

## 14. Naming & Data Contract Consistency

### Canonical vocabulary to audit

| Concept | Risk to inspect | Proposed direction |
|---|---|---|
| `contest` vs `hackathon` | Same product concept may use two vocabulary sets | Choose one public/domain vocabulary; keep DB alias only during migration |
| user/staff/admin/support | App role and DB role may not be identical | Define actor capability model separately from role label |
| `course_id` sentinel/product values | A foreign key may contain magic meaning | Replace with explicit nullable relation/type after data audit |
| `status` | Free-form strings across domains | Domain-specific allowed values/state machine |
| timestamps | `created_at`, `updated_at`, timezone and mutation semantics | `timestamptz`, explicit immutable/updated contract |
| booleans | `is_*`, positive/negative meanings | One naming convention and NOT NULL default where valid |
| IDs | UUID/text and external IDs mixed | Document internal ID vs provider ID; do not cast blindly |
| JSONB | Same fact in JSONB and relational columns | Pick canonical field; JSONB only versioned extension/fallback |
| frontend/Edge/DB types | Stale generated TypeScript types | Regenerate after released schema and gate drift in CI |

Required output: canonical vocabulary, compatibility aliases, contract migration, generated DB type refresh process and stale consumer list.

## 15. CI/CD Database Guardrails

### 15.1 Required CI checks

- Migration immutability: fail if a released migration is modified, deleted or renamed.
- Schema-change declaration: PR changing schema/RLS/function/trigger must include a new migration and `DB_CHANGE=YES` or equivalent checklist/label. Pure Edge Function changes do not require a migration.
- Migration test: build disposable/local DB, apply canonical chain, apply new migration, lint, DB tests and expected catalog fingerprint.
- Drift detection: compare expected released baseline, Main live and Staging live. Unknown drift fails or alerts by severity.
- Definition fingerprints: normalize/hash RLS, function and trigger definitions; include security attributes/search_path.
- Deployment gate: Staging migration + validation pass → approval → Main migration → post-deploy verification.

### 15.2 Intentional Staging drift manifest

Each allowed drift entry must contain: feature, object, migration/commit, owner, reason, expected release target, expiry/review date, allowed catalog delta and validation status. An expired entry becomes an actionable issue.

### 15.3 Emergency SQL / migration count

Break-glass SQL requires actor, reason, timestamp, captured SQL, ticket, affected object, reconciliation migration due date and verification result. Do not rewrite applied history. A baseline may optimize new-environment bootstrap, but must retain mapping to production’s immutable history and must not hide drift.

## 16. Issue Register

| ID | Priority | Domain | Problem | FACT | INFERENCE | Impact / User impact | Confidence | Action | Type | Status |
|---|---:|---|---|---|---|---|---|---|---|---|
| DB-001 | P1 | RLS | 13 same-name policies differ | Main/Staging definitions differ | Permission behavior may diverge | Security; users may read/write different data by environment | High | Exact diff + actor tests + canonical policy | RLS, TEST | Open |
| DB-002 | P1 | RLS | Policy names split between environments | 3 Main-only, 6 Staging-only | At least some CRUD boundary differs | Unauthorized denial or access regression | High | Resolve semantic policy matrix | RLS | Open |
| DB-003 | P1 | Function security | Helper schema/security context needs parity review | Both public/private `is_admin_or_support()` exist | Unqualified call may resolve differently or expose wrong boundary | Staff/admin action may be over/under-permitted | Medium | Qualify schema; test SECURITY DEFINER/search_path | FUNCTION/RPC, RLS, TEST | Open |
| DB-004 | P1 | Function | 8 function definitions differ | Catalog fingerprints differ | Runtime result/security/side effects may diverge | Completion, streak, reminder or connection behavior differs | High | Exact body/caller/security diff | FUNCTION/RPC, TEST | Open |
| DB-005 | P1 | Credential | Credential activity trigger behavior differs | Guard migration was added then reverted | Event may emit at wrong lifecycle/retry point | Missing/duplicate credential activity | High | Chốt minted/issued contract and dedupe | TRIGGER, OBSERVABILITY | Open |
| DB-006 | P2 | Voucher | Main has 4 extra fields and 3 checks | `ai_vouchers` differs; runtime uses batch config | Fields likely legacy but live consumers unknown | Discount/window/limit behavior may be inconsistent | High | Audit data/consumer, compatibility, then cleanup | CODE, MIGRATION, DATA_BACKFILL | Open |
| DB-007 | P1 | Migration | Live Main 139 vs `origin/main` 131 | Repo/live count gap and repair workflow | Production cannot be recreated from origin/main alone | Unsafe rollback/rebuild and hidden drift | High | Provenance audit + baseline/checkpoint | CI/CD, DOCUMENTATION | Open |
| DB-008 | P2 | Migration | Same version has different SQL | 12 version statement diffs | Same version may create different state | Environment-specific bugs and failed replay | High | Immutable fingerprint and reconciliation map | CI/CD, MIGRATION | Open |
| DB-009 | P1 | Payment/access | Truth split among payment, enrollment, access/refund | Task 1 decision separates concepts | Current readers may still use legacy paid fields | Wrong entitlement or refund behavior for users | Medium | Trace consumers and state machine | CODE, MIGRATION, TEST | Open |
| DB-010 | P1 | Integrity | Critical invariants not uniformly DB-enforced | Known progress/quiz/voucher/streak areas | App-only checks permit race/alternate writer failures | Orphan, duplicate or invalid records | Medium | Preflight then declarative constraints | MIGRATION, DATA_BACKFILL | Open |
| DB-011 | P2 | State | Lifecycle transitions lack one readable contract | States are distributed across code/schema | Retry/concurrency can create half-state | Payment/access/credential failures hard to repair | Medium | Transition and transaction maps | CODE, FUNCTION/RPC, TEST | Open |
| DB-012 | P2 | Observability | Critical flow trace completeness unknown | Tables/functions exist but event contract not unified | Debugging requires correlating unrelated logs | Longer incident resolution, unclear user-facing status | Medium | Correlation/event/audit matrix | OBSERVABILITY | Open |
| DB-013 | P4 | Performance | Staging-only indexes not workload-validated | 8 named Staging-only indexes | Some may be redundant or useful | Query latency/storage/write cost uncertain | Medium | pg_stat/query plan audit | DOCUMENTATION, CLEANUP | Deferred Task 9 |
| DB-014 | P2 | Quota | Attempt and successful usage semantics differ | Failed request creates conversation but no monthly `upsertUsage()` | Product may interpret “quota” differently | Failed requests may consume anti-spam window but not monthly quota | High | Document and get product decision/test | CODE, DOCUMENTATION, TEST | Open |
| DB-015 | P3 | Lifecycle | Retention/archival policy absent for logs/usage | Several event/log tables grow over time | Storage/PII and debug value trade-off unknown | Cost and privacy risk | Medium | Business/legal decision then retention plan | DOCUMENTATION, CLEANUP | Open |
| DB-016 | P3 | Contract | Naming/JSONB/generated types may drift | Multiple domains and payload layers | Same concept may be interpreted differently | Developer errors and harder debugging | Medium | Vocabulary/type contract audit | CODE, DOCUMENTATION, CI/CD | Open |

Cross-reference: DB-001/002/003 form the authorization cluster; DB-004/005 form server-side behavior parity; DB-006/007/008 form reconciliation/history; DB-009/010/011 form correctness/state; DB-013 is intentionally deferred and must not block Task 3.

## 17. Implementation Dependency Graph

```text
Task 1 business truth decisions
        |
        +--> DB-009/010/011 correctness + state contract
        |          |
        |          +--> compatibility code and data preflight
        |
Task 2 migration audit --> DB-007/008 --> CI/CD minimum guardrails (DB-008)
        |
Task 3 final reconciliation
        |        |
        |        +--> DB-001/002/003 RLS model
        |        +--> DB-004 function contract
        |        +--> DB-005 trigger/event contract
        |        +--> DB-006 voucher compatibility
        |
        +--> released baseline checkpoint
                         |
                         +--> Task 4 table roles
                         +--> Task 8 observability
                         +--> Task 11 validation/rollout (cross-cutting)
                         +--> Task 9 workload performance
                         +--> Task 12 retention
                         +--> Task 13 naming/contracts
                         +--> Task 10 cleanup (last)
```

Task 14 minimum migration immutability and drift checks can start before Task 3 implementation. Destructive cleanup cannot start before Task 4 dependency trace, Task 5 invariant validation and Task 11 recovery plan.

## 18. Implementation Waves

### Wave 0 — Evidence freeze and guardrail minimum

- **Goal:** preserve current truth and make future drift visible.
- **Issues:** DB-007, DB-008.
- **Work:** timestamped Main/Staging catalog snapshot, migration fingerprint, released baseline manifest, CI migration immutability check, target verification.
- **No data/schema write.**
- **Exit:** every current drift is listed; CI rejects edited released migration; baseline gap is documented.

### Wave 1 — Finalize correctness/security contracts

- **Goal:** decide RLS, functions, credential event, voucher fields and state/invariant rules.
- **Issues:** DB-001 through DB-011.
- **Work:** exact diff, caller/consumer trace, product/security decisions, preflight SQL, compatibility design.
- **Exit:** no UNKNOWN blocker remains for the object being changed; each issue has canonical behavior and rollback direction.

### Wave 2 — Compatibility and non-destructive schema reconciliation

- **Goal:** make readers/writers compatible before changing constraints or removing legacy fields.
- **Work:** code dual-read/dual-write only where required, add missing canonical objects through new migration, backfill in bounded batches, add constraints after clean preflight.
- **Exit:** Staging business flows pass with old and new path; invariant violations are zero or explicitly accepted.

### Wave 3 — Authorization, functions, triggers and observability

- **Goal:** release the chosen security and server-side behavior.
- **Work:** RLS/function/trigger migrations, actor test matrix, event correlation and dedupe tests.
- **Risk:** access denial or duplicate/missing events.
- **Exit:** catalog fingerprint and actor/business tests match canonical contract.

### Wave 4 — Staging parity and production rollout

- **Goal:** release a known canonical baseline.
- **Work:** staging validation, approval, Main migration after direct confirmation, post-deploy verification.
- **Exit:** no unknown correctness/security drift; intentional drift manifest current.

### Wave 5 — Workload performance and lifecycle

- **Goal:** optimize measured query cost and define retention.
- **Issues:** DB-013, DB-015, DB-016.
- **Work:** query plans, index decisions, retention/archival contract, type/vocabulary cleanup.
- **Exit:** each index has evidence and trade-off; no short-window usage assumption.

### Wave 6 — Legacy cleanup

- **Goal:** remove deprecated fields/objects only after observation.
- **Work:** stop writers, switch readers, monitor, remove dependencies, destructive migration with recovery plan.
- **Exit:** cleanup candidate has no known consumer and rollback/recovery is tested.

## 19. Migration Plan

No SQL is approved by this document. Migration names below are logical work items; actual names must be generated only after the target state is reviewed.

| Proposed migration/work item | Goal | Dependency | Data preflight/backfill | Risk | Staging validation |
|---|---|---|---|---|---|
| `reconcile_voucher_contract` | Decide/add/remove voucher config model | DB-006, consumer decision | Null/duplicate/field consistency query | Discount behavior change | Create/redeem/expiry/limit tests |
| `reconcile_rls_policy_contract` | Canonical policy behavior | DB-001/002/003 | No data backfill; permission test | Access regression | Actor matrix + denial audit |
| `reconcile_function_contracts` | Canonical body/security | DB-004 | Function-specific invariants | Runtime result/security change | RPC/Edge integration tests |
| `reconcile_credential_activity` | Canonical trigger/event | DB-005 | Existing issuance/event duplicate query | Missing/duplicate activity | Retry/concurrent/status tests |
| `enforce_course_progress_integrity` | Parent/ownership/unique invariants | DB-010, compatibility code | Orphan/duplicate preflight | Lock/write failure | Backfill then constraint check |
| `enforce_payment_access_states` | Separate payment/access/refund states | DB-009/011 | Invalid transition/legacy row query | User access regression | Webhook/refund/admin grant tests |
| `reconcile_released_baseline` | Catalog checkpoint and manifest | DB-007/008 | Fingerprint before/after | Deployment mismatch | Main/Staging parity query |
| `cleanup_deprecated_objects` | Remove approved legacy | Wave 6 only | No writer/reader/consumer proof | Destructive/data loss | Restore/recovery and negative tests |

Migration rules: additive/backward-compatible first; bounded backfill; constraints after preflight; RLS/function/trigger changes with tests; cleanup last; never rewrite an applied migration.

## 20. Code Change Plan

| Module/flow | Current problem | Required change | Migration dependency | Test |
|---|---|---|---|---|
| `payments/vouchers.ts` + `src/lib/aiVouchers.ts` | Runtime uses batch config while Main has voucher config fields | Keep one canonical contract; add compatibility only if live consumer requires | Voucher decision | Issue/redeem/expiry/limit |
| Payment/access consumers | `enrollments` may be read as payment truth | Read payment fact and explicit entitlement source | Access state migration | Paid/refund/admin grant |
| Course content readers/writers | Locale vs `*.data` truth can diverge | Read/write locale truth; metadata/fallback contract | Content backfill | Locales/fallback/update |
| Project/submission flow | Submission/project sync ambiguity | Make submission truth and project portfolio boundary explicit | Project decision | Edit/resubmit/portfolio |
| AI tutor quota | Attempt and successful usage are different counters | Name buckets and document failed-request behavior; add product-approved change only if needed | None or quota contract | success/fail/partial/retry/concurrent |
| Credential issuance/activities | Trigger behavior is inconsistent | Align event contract and idempotency | Credential trigger migration | status/OC ID/retry |
| RLS callers | Policy behavior differs by environment | Ensure client/server call path matches actor model | RLS migration | actor matrix |
| Generated DB types | Potential stale shape after schema parity work | Refresh and gate generated types | Released migration | compile/type-check |

## 21. Test Plan

### Database tests

- Catalog fingerprint for tables/columns/constraints/RLS/function/trigger.
- FK orphan, composite relation, duplicate, state and counter reconciliation queries.
- Migration apply on clean DB and upgrade from representative baseline.
- Idempotency and concurrent write tests for payment, voucher, streak, credential and notifications.

### RLS/security tests

- Actor × action × table matrix for anonymous, learner, owner, instructor, course staff, support, admin, service and cron.
- Verify `USING` controls read/target rows and `WITH CHECK` controls inserted/updated rows.
- Verify SECURITY DEFINER search_path, grants and helper schema.
- Verify no policy change leaks private profile, payment, credential or usage data.

### Integration/business tests

- Course localization, enrollment/progress, quiz, payment/access/refund, voucher, credential, project/submission, hackathon, notification, streak/points and AI quota.
- Failed provider request, duplicate webhook, retry, timeout, partial output and concurrent request.

### Performance tests

- Representative query plans before/after in Staging.
- Read latency, write latency, index size and write amplification.
- No production `EXPLAIN ANALYZE` or load test without explicit safe scope.

## 22. Trade-off Register

| Recommendation | Benefit | Cost/risk | Complexity | Worth doing? | When |
|---|---|---|---|---|---|
| Declarative FK/UNIQUE/CHECK before trigger | Prevents invalid data at every writer | Requires clean existing data and possible locks | Medium | Yes for proven invariants | Wave 2 |
| Explicit state machine/RPC transition | Correctness and debuggability | More transition code and test cases | Medium/high | Yes for payment/access/credential | Wave 1–3 |
| RLS helper function | Less repeated permission logic | SECURITY DEFINER/search_path dependency | Medium | Only after security review | Wave 3 |
| Add composite/partial index | Faster known reads | Storage/write overhead | Low/medium | Only with workload proof | Wave 5 |
| Aggregate/counter tables | Faster quota/dashboard reads | Reconciliation complexity | Medium | Keep if rebuild path exists | Wave 5 |
| Projection/public profile | Limits data exposure and read shape | Sync/rebuild path required | Medium | Yes if consumer boundary is clear | Wave 2/5 |
| Baseline for fresh environments | Faster bootstrap | Two history layers to govern | Medium/high | Maybe, not for live history | After CI guardrail |
| Immediate cleanup/drop | Less schema surface | Data loss/hidden consumer risk | High | No | Never before Wave 6 |

## 23. Remaining Decisions / UNKNOWN

Chỉ các câu hỏi sau cần người quyết định hoặc evidence bổ sung:

1. 13 RLS policy diff: behavior nào là product/security contract cho từng actor/action?
2. 8 function diff: Main hay Staging/repo body nào là canonical; exact privilege/search_path/result contract là gì?
3. Credential activity: activity emit khi status nào; `oc_credential_id` bắt buộc hay không; dedupe key nào?
4. `ai_vouchers` 4 Main-only field: có live row/consumer/external consumer nào không; có cần compatibility period không?
5. Vì sao live Main có 139 migration nhưng `origin/main` có 131; 8 version đến từ commit/branch/manual path nào?
6. Có consumer ngoài repo dùng legacy object hoặc direct DB access không?
7. Failed AI request có tính vào product quota hay chỉ rate-limit/anti-spam? Hiện code đang tách hai counter; product cần xác nhận wording.
8. Payment/access/refund/admin grant state transition và retention/PII requirements là gì?
9. `course_id` sentinel, `contest`/`hackathon`, JSONB duplicate và generated type contract nào được giữ compatibility?
10. Business/legal retention cho payment, credential, activity, usage, notification và email logs?

Evidence cần lấy tiếp: exact Main/Staging catalog SQL snapshot có timestamp; function/policy/trigger definitions; live data preflight counts; repository/history provenance; app/external consumer inventory; workload metrics; actor/business acceptance tests.

## 24. Definition of Done

- Source of Truth được implement trong reader/writer, không chỉ ghi trong tài liệu.
- Critical business invariant được DB enforce khi declarative constraint phù hợp.
- Main/Staging released baseline không còn unknown correctness/security drift.
- Intentional Staging drift có manifest, owner, release target và expiry/review date.
- Released migration history immutable; CI phát hiện sửa/xóa/đổi tên migration cũ.
- CI có migration apply test, catalog/RLS/function/trigger drift check và deploy gate.
- RLS model khớp actor/action contract; security test pass.
- Critical lifecycle có state machine, transaction boundary, idempotency và recovery path.
- Payment/access/credential/voucher/AI quota/notification flow trace được bằng correlation và business event/audit evidence phù hợp.
- Index add/drop/modify có workload/query-plan evidence; không quyết định theo số lượng index.
- Legacy cleanup đã qua no-writer/no-reader/no-trigger/no-RPC/no-known-external-consumer và compatibility period.
- Staging validation pass toàn bộ catalog, integrity, security, business flow và regression gates.
- Production rollout có explicit confirmation, post-deploy validation và rollback/recovery direction.
- Matrix, issue register, migration map, code plan và test plan được cập nhật theo live state cuối cùng.

## Kết luận trả lời các câu hỏi điều hành

- **Nghiêm trọng nhất:** RLS/authorization drift và migration provenance gap; tiếp theo là function/trigger behavior drift ở các flow correctness/security.
- **Technical debt chưa cần block ngay:** Staging-only indexes, naming/cleanup và retention nếu chưa có workload/business/legal evidence.
- **Phải xử lý trước khi mở rộng app:** canonical RLS/function/trigger behavior, payment/access/refund state, voucher contract, migration guardrail và critical invariants.
- **Cần CODE:** reader/writer chuyển Source of Truth, compatibility, state transition, quota contract nếu product đổi, generated types.
- **Cần MIGRATION:** canonical constraints, RLS/function/trigger, voucher reconciliation, released baseline và cleanup sau cùng.
- **Cần DATA_BACKFILL:** mọi constraint/source-of-truth change có duplicate/orphan/legacy data; chưa được tự giả định số lượng.
- **Cần RLS/FUNCTION/TRIGGER:** policy parity, helper security, lifecycle transitions, credential activity và idempotency.
- **Chỉ cần DOCUMENTATION/PROCESS:** migration provenance, manifest intentional drift, naming/retention decision khi chưa có runtime change.
- **Thứ tự an toàn:** Wave 0 → 1 → 2 → 3 → 4 → 5 → 6.
- **Có thể làm độc lập:** CI immutability/fingerprint, consumer inventory, table-role trace, workload collection và retention questionnaire.
- **Bắt buộc compatibility period:** voucher legacy fields, content/payment/project truth migration, public projection và mọi cleanup có reader cũ.
- **Có nguy cơ lock/downtime:** backfill lớn, `NOT NULL`, FK/unique/check trên bảng lớn, index build và trigger/RLS change; phải estimate trên Staging.
- **Destructive:** drop column/table/function/index/policy, irreversible data rewrite; để Wave 6.
- **Schema sẽ đơn giản hơn:** chỉ sau khi loại duplicate truth, legacy policy/function/field có evidence, và tách rõ canonical/projection/event/ledger; không tối ưu bằng cách giảm số table cơ học.
- **Việc có thể defer/bỏ:** index cleanup, naming rename và retention purge nếu chưa có evidence; defer giúp giảm migration risk nhưng giữ technical debt và cần issue owner.

> Tài liệu này là kế hoạch để review và chia thành task/wave riêng. Không coi việc tạo tài liệu hoặc migration chạy thành công là hoàn tất optimization.
