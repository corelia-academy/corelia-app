# CORELIA — Staging Candidate Readiness

## Phạm vi

- Candidate branch: `feat/db-canonical-payment-entitlements`
- Candidate HEAD: `514ec5fefeb82655fb020536e37e0f0e198495cd`
- Supabase Staging: project ref `opoozbmfbezkrpzxsusx` thuộc organization `terrancrypt`
- Phạm vi thay đổi: Issues `#325–#332`, gồm canonical payment/entitlement, refund, quiz integrity và compatibility với instructor-facing AI.
- Production/Main: không thao tác.
- Staging remote: chỉ đọc trong bước audit này; chưa apply migration, chưa deploy.

## 1. Local candidate evidence

### [FACT] Worktree

- Worktree sạch trước và sau khi chạy verification.
- `git diff --check`: PASS.
- Không có file ngoài scope bị thay đổi trong bước verification.

### [FACT] Local gates

| Gate | Kết quả |
|---|---|
| `pnpm test` | PASS — 28 test files, 172 tests |
| `pnpm lint` | PASS |
| `pnpm build:staging` | PASS — 3.817 modules |
| `pnpm db:guard:test` | PASS — 206/206 |
| `pnpm db:verify` | PASS |
| `pnpm db:verify:local` | PASS — clean recreate, SQL integration, concurrency, HTTP E2E 13/13 |
| `node scripts/db/tests/incremental-upgrade-proof.mjs` | PASS — baseline `20260826120000` → candidate `20260827120000` |

### [FACT] Đã kiểm tra đúng đường nâng cấp từ trạng thái Staging

Local disposable database được reset về:

- 155 migrations
- latest `20260826110000`

Sau đó chạy `supabase migration up --local`, kết quả:

- `20260826120000_issue_329_payment_retirement_safety.sql`: applied
- `20260827120000_canonical_payment_entitlements_and_quiz_integrity.sql`: applied
- 157 migrations
- latest `20260827120000`
- exit code `0`

## 2. Live Staging state

### [FACT] Migration ledger

Truy vấn read-only trên Staging cho kết quả:

- Migration count: `155`
- First version: `20250504120000`
- Latest version: `20260826110000`
- Version hash: `544ebcd22bada52cea7b1d93594d43b6`

Version hash này khớp với 155 migration đầu của candidate. Vì vậy Staging đang thiếu đúng:

1. `20260826120000_issue_329_payment_retirement_safety.sql`
2. `20260827120000_canonical_payment_entitlements_and_quiz_integrity.sql`

### [FACT] Staging preflight

- `course_payment_access`: `0` rows
- `payment_transactions`: `2` rows
  - `certificate_fee / paid`: `1`
  - `certificate_fee / pending`: `1`
- `payment_refunds`: `0` rows
- `enrollments`: `53` rows
- Duplicate active access: `0`
- Invalid payment purpose: `0`
- Invalid course purchase: `0`
- Duplicate provider refund ID: `0`

Đây là bằng chứng dữ liệu hiện tại của Staging, không thay thế preflight trên Production.

## 3. Consumer và projection

### [FACT] Readers trong repository

Các reader hiện tại vẫn dùng compatibility projection `course_payment_access`:

- `src/lib/payments.ts`
- `supabase/functions/corelia-api/payments/handlers.ts`
- `supabase/functions/corelia-api/certificates/handlers.ts`
- `supabase/functions/corelia-api/credentials/check_course.ts`

Không tìm thấy application code trực tiếp ghi vào projection cũ ngoài các migration/RPC.

### [FACT] Writers trong database Staging hiện tại

Catalog Staging tìm thấy các routine liên quan:

| Routine | Projection operation | Quyền hiện tại |
|---|---|---|
| `grant_course_access_admin` | Insert/update | `PUBLIC`, `authenticated`, `service_role` |
| `process_successful_payment` | Insert | `postgres`, `service_role` |
| `process_payment_refund` | Update | `postgres`, `service_role` |
| `enroll_in_course` | Không ghi projection; chỉ đọc projection | `PUBLIC`, `authenticated`, `service_role` |
| `guard_course_enrollment_access` | Không ghi projection; chỉ đọc projection | `PUBLIC`, `anon`, `authenticated` |

`course_payment_access` hiện chỉ có policy `course_payment_access_select_own` và không có trigger ngoài.

### [FACT] Candidate hardening

Sau khi apply candidate trên local, các financial/admin RPC ghi entitlement đều chỉ còn quyền `postgres` và `service_role`; `PUBLIC`, `anon` và `authenticated` bị revoke.

### [GIỚI HẠN BẰNG CHỨNG]

Staging không có `pg_stat_statements`, nên không thể truy ngược lịch sử consumer ngoài repository. `pg_stat_activity` chỉ cho thấy pool như `postgrest`, `pg_net`, `pg_cron`, exporter và SQL editor.

Không được kết luận rằng không có external consumer. Kết luận hiện tại là chưa có bằng chứng trực tiếp xác nhận external writer.

## 4. Kế hoạch apply Staging

Chỉ thực hiện sau khi có phê duyệt cho đúng source/target và đã chụp snapshot:

1. Xác nhận project ref `opoozbmfbezkrpzxsusx` và environment Staging.
2. Ghi lại ledger trước apply: `155 / 20260826110000` và version hash ở trên.
3. Chụp backup/snapshot Staging; lưu timestamp, artifact ID và checksum.
4. Apply migration theo đúng thứ tự, không dùng `--include-all` và không dùng `migration repair`:
   - `20260826120000_issue_329_payment_retirement_safety.sql`
   - `20260827120000_canonical_payment_entitlements_and_quiz_integrity.sql`
5. Verify ledger sau apply: `157 / 20260827120000`.
6. Verify catalog, RPC ACL, RLS, payment, refund, admin grant, quiz và compatibility projection.
7. Deploy application/Edge tương ứng với cùng release candidate.
8. Chạy smoke test và ghi runtime evidence trước khi mở observation window.

## 5. Recovery / rollback boundary

### [FACT]

- Candidate là forward-only.
- Không có down migration để đảo ngược toàn bộ schema.
- Candidate tạo canonical tables, backfill dữ liệu và thay đổi function/policy/permission.

### [ĐỀ XUẤT]

- Nếu application hoặc Edge lỗi sau apply: rollback application/Edge về bản tương thích trước.
- Giữ database ở schema mới; sửa lỗi database bằng migration forward-only mới.
- Chỉ restore snapshot/PITR khi có dấu hiệu data corruption hoặc migration gây hỏng dữ liệu.
- Không tự viết một migration undo chung để xóa canonical data hoặc đảo ngược backfill.

### [CHƯA XÁC MINH]

- Snapshot/restore rehearsal của Staging chưa được thực hiện trong audit này.
- PITR và RPO/RTO chưa được xác minh.
- Chưa có operational rehearsal cho Edge/frontend rollback.

## 6. Post-apply invariants

- [ ] Ledger là `157`, latest là `20260827120000`.
- [ ] `course_entitlement_grants`, `payment_transaction_items`, `billing_products` tồn tại.
- [ ] Financial/admin RPC không còn EXECUTE cho `PUBLIC`, `anon`, `authenticated`.
- [ ] Admin grant không tạo payment transaction giả và không bị full refund thu hồi.
- [ ] Full refund chỉ thu hồi entitlement có provenance từ payment transaction đó.
- [ ] Duplicate active entitlement bị chặn.
- [ ] Quiz tự tính `is_correct` trên server và batch submit atomic.
- [ ] Compatibility readers hiện tại vẫn hoạt động qua `course_payment_access`.
- [ ] Canonical grant và compatibility projection khớp theo semantic mapping; không so count đơn giản vì projection còn certificate-only/legacy records.
- [ ] Instructor-facing AI vẫn tồn tại; learner AI không được kích hoạt lại.

## 7. Findings

### P2 — Release evidence phải refresh theo candidate 157

- **Impact:** Dùng manifest/rollout plan cũ có thể nhầm candidate 156 với candidate 157.
- **User impact:** Chưa có tác động vì chưa deploy.
- **Scope:** Release documentation và staging rollout.
- **Evidence:** Một số tài liệu cũ vẫn ghi latest `20260826120000`; live candidate latest là `20260827120000`.
- **Likelihood:** Cao nếu dùng lại manifest cũ.
- **Confidence:** Cao.
- **Recommended action:** Tạo/verify manifest riêng cho candidate `514ec5f` trước khi apply.
- **Status:** Open.

### P2 — External consumer chưa được chứng minh đầy đủ

- **Impact:** Writer ngoài repo có thể làm projection lệch sau khi canonical flow hoạt động.
- **User impact:** Có thể làm quyền học hoặc trạng thái payment hiển thị sai.
- **Scope:** Payment/access integration và service-role consumers.
- **Evidence:** Không có `pg_stat_statements`; PostgREST gom nhiều client vào cùng pool.
- **Likelihood:** Chưa định lượng được.
- **Confidence:** Cao về giới hạn quan sát.
- **Recommended action:** Inventory webhook, cron, Edge Function, service-role secret và integration ngoài repo; chưa cleanup projection.
- **Status:** Open — không chặn apply candidate nếu vẫn giữ compatibility projection.

## 8. Boundary của task

- Giữ instructor-facing AI theo Issue `#327`.
- Không đưa lại learner AI.
- Không mở lại quyết định bỏ 4 cột/3 check Main-only của `ai_vouchers`.
- Không xử lý performance index, retention hoặc cleanup legacy trong candidate này.
- Không apply Staging/Main, merge hoặc push trong bước audit này.
