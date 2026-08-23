# DB Harness R1 Verification Package

## 1. Verdict

**`DB_INTEGRATION_PASS`**

Docker daemon đã được khởi động và toàn bộ gate tích hợp cơ sở dữ liệu `pnpm db:verify:local` (gồm 32 migrations recreate từ zero, toàn bộ SQL assertion integration tests, và real two-connection concurrency test) đã thực thi trực tiếp trên PostgreSQL container và đạt kết quả **100% PASS**.

---

## 2. Codex Findings Resolution

| Finding | Fix | Evidence | Test |
|---|---|---|---|
| **DBH-01** (SQL executor command) | Thay thế lệnh không tồn tại `supabase db execute` bằng lệnh chính thức `supabase db query --local --file <path>`. Bọc script SQL thành single executable DO block để tương thích chuẩn Extended Query Protocol / prepared statement. | [`scripts/db/verify-local-migration-apply.mjs:53`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/verify-local-migration-apply.mjs#L53) | `pnpm db:verify:local` (Step 3/4) |
| **DBH-02** (Ownership RLS bypass) | Thiết lập ngữ cảnh phân quyền chân thực qua `PERFORM set_config('role', 'authenticated', true)` kết hợp `request.jwt.claim.sub` và `request.jwt.claims`. Các test OWN-01 đến OWN-06 thực thi trực tiếp dưới quyền RLS của từng user cụ thể. | [`scripts/db/tests/g2-r1-db-integration.sql:88-175`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/tests/g2-r1-db-integration.sql#L88-L175) | `OWN-01` $\rightarrow$ `OWN-08` |
| **DBH-03** (Entitlement fixtures) | Chuyển toàn bộ fixture ID sang UUID chuẩn (`a0000000-...`, `b0000000-...`), gán mỗi user một dòng active riêng biệt để tuân thủ index đơn nhất một active subscription (`ai_subscriptions_one_active_per_user`). | [`scripts/db/tests/g2-r1-db-integration.sql:480-547`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/tests/g2-r1-db-integration.sql#L480-L547) | `ENT-01` $\rightarrow$ `ENT-03` |
| **DBH-04** (RPC authorization) | Bổ sung kiểm tra quyền hàm hệ thống `has_function_privilege` (`anon` bị REVOKE, `authenticated` được GRANT), kiểm tra `support_staff` (`RPC-05B`), kiểm tra fixture lời mời thực tế trong bảng `public.hackathon_access_invites` (`RPC-04`). | [`scripts/db/tests/g2-r1-db-integration.sql:308-478`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/tests/g2-r1-db-integration.sql#L308-L478) | `PRIV-01`, `PRIV-02`, `RPC-01` $\rightarrow$ `RPC-06`, `DATA-01` |
| **DBH-05** (Concurrency test) | Tách riêng runner Node.js `scripts/db/tests/g2-r1-concurrency.integration.mjs` chạy 2 kết nối/phiên DB đồng thời độc lập (`Promise.all`), mô phỏng manager update title song song với background metrics snapshot RPC. | [`scripts/db/tests/g2-r1-concurrency.integration.mjs:1-96`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/tests/g2-r1-concurrency.integration.mjs#L1-L96) | `CONCURRENCY-01` |
| **DBH-06** (Missing test coverage) | Triển khai đầy đủ 100% các mã test: `OWN-01` $\rightarrow$ `OWN-08`, `MSG-01` $\rightarrow$ `MSG-08` (kèm assertion `last_message_at` và chuyển trạng thái Completed $\rightarrow$ Error), `RPC-01` $\rightarrow$ `RPC-06`, `DATA-01`, `ENT-01` $\rightarrow$ `ENT-03`. | [`scripts/db/tests/g2-r1-db-integration.sql`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/tests/g2-r1-db-integration.sql) | Tất cả các ca kiểm thử đều có assertion thực tế |
| **MSG06-R1-01** (Error classification) | Bổ sung `GET STACKED DIAGNOSTICS` cho `MSG-06` (và `OWN-02..04`), phân loại chính xác mã lỗi `42501` (RLS `WITH CHECK`) và `23503` (Composite FK). Tái ném lỗi (fail-closed) nếu phát sinh bất kỳ SQLSTATE không mong muốn nào, kèm negative oracle test kiểm chứng. | [`scripts/db/tests/g2-r1-db-integration.sql:377-505`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/tests/g2-r1-db-integration.sql#L377-L505) | `MSG-06`, `MSG-06-ORACLE` |

---

## 3. Runner Architecture

Chuỗi thực thi tự động qua entrypoint duy nhất: `pnpm db:verify:local`
1. **Docker Preflight:** Kiểm tra `docker info` qua shell an toàn $\rightarrow$ Nếu docker tắt, dừng ngay với mã lỗi `BLOCKED_DOCKER_DAEMON`.
2. **Clean Recreate from Zero:** Chạy `supabase db reset --local --no-seed --yes` để khởi tạo database trắng, chạy tuần tự 32 migrations từ baseline đến `20260823140000_g2_r1_remediation.sql`. Bắt lỗi `MIGRATION_RESET_FAILURE`.
3. **SQL Integration Suite:** Chạy `supabase db query --local --file scripts/db/tests/g2-r1-db-integration.sql` dưới dạng một khối DO giao dịch duy nhất trên PostgreSQL. Bắt lỗi `INTEGRATION_SQL_FAILURE`.
4. **Two-Connection Real Concurrency Test:** Chạy `node scripts/db/tests/g2-r1-concurrency.integration.mjs` mở 2 phiên DB đồng thời kiểm chứng race condition và bảo toàn dữ liệu JSONB. Bắt lỗi `INTEGRATION_CONCURRENCY_FAILURE`.

---

## 4. Remote Safety

- **Pin cứng cờ `--local`:** Tất cả các lệnh gọi Supabase CLI (`reset`, `query`) đều chỉ định cờ `--local` tường minh. Tuyệt đối không dùng `--linked`.
- **Chặn biến môi trường URL từ xa:** [`verify-local-migration-apply.mjs:15-18`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/verify-local-migration-apply.mjs#L15-L18) kiểm tra biến `SUPABASE_DB_URL`; nếu trỏ tới host khác `127.0.0.1` hoặc `localhost`, tiến trình tự động từ chối chạy và thoát ngay lập tức với `REMOTE_SAFETY_VIOLATION`.
- **Không nhúng credential từ xa:** Không yêu cầu hay đọc secret của Main/Staging.

---

## 5. RLS Test Mechanism

Cơ chế giả lập phân quyền Supabase/PostgreSQL được thực thi bằng:
```sql
PERFORM set_config('role', 'authenticated', true);
PERFORM set_config('request.jwt.claim.sub', v_user_uuid::text, true);
PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","email":"..."}', v_user_uuid), true);
```
- Khi chuyển sang `role = 'authenticated'`, PostgreSQL áp dụng các chính sách RLS `TO authenticated`.
- `auth.uid()` phân giải thành `v_user_uuid`.
- `public.current_email()` và `private.current_email()` phân giải email từ `request.jwt.claims`.

---

## 6. Ownership Tests (FV-G2-02)

- **OWN-01:** User A insert conversation vào Session A của User A $\rightarrow$ **PASS** (RLS `WITH CHECK` cho phép).
- **OWN-02:** User A insert conversation vào Session B của User B $\rightarrow$ **PASS** (Bị RLS `WITH CHECK` và Composite FK `(session_id, user_id)` từ chối).
- **OWN-03:** User A update conversation đổi sang Session B $\rightarrow$ **PASS** (Bị RLS và Composite FK từ chối).
- **OWN-04:** User A update conversation đổi `user_id = User B` $\rightarrow$ **PASS** (Bị RLS `WITH CHECK (auth.uid() = user_id)` từ chối).
- **OWN-05:** User B cố tình UPDATE/DELETE conversation của User A $\rightarrow$ **PASS** (RLS `USING (auth.uid() = user_id)` trả về 0 rows affected, không sửa được).
- **OWN-06:** Insert conversation với `session_id IS NULL` và `lesson_id = 'lesson-101'` $\rightarrow$ **PASS** (Khớp nhánh nullable của Composite FK và RLS).
- **OWN-07:** Xóa Session A $\rightarrow$ **PASS** (Cascade xóa session conversation của A, nhưng giữ nguyên lesson conversation có `session_id IS NULL`).
- **OWN-08:** Writer phía service_role / backend $\rightarrow$ **PASS** (Tương thích hoàn toàn).

---

## 7. Trigger Tests (FV-G2-02 Trigger Check)

- **MSG-01:** Chèn tin nhắn `status = 'completed'` $\rightarrow$ `message_count` tăng lên 1, `last_message_at` khớp chính xác thời điểm `created_at`.
- **MSG-02:** Chèn tin nhắn `status = 'error'` hoặc `'pending'` $\rightarrow$ `message_count` giữ nguyên 1 (không tăng).
- **MSG-03:** Chèn `status = 'pending'` rồi UPDATE sang `status = 'completed'` $\rightarrow$ tăng chính xác +1 (không double-count).
- **MSG-04:** DELETE conversation completed $\rightarrow$ `message_count` giảm về 0.
- **MSG-05:** Chuyển conversation sang session khác của cùng user $\rightarrow$ Session cũ giảm 1, session mới tăng 1.
- **MSG-06:** Thao tác chèn hoặc chuyển conversation trái phép của User A vào Session B của User B (Attack 1: direct insert into foreign session; Attack 2: update own conversation session_id to foreign session; Attack 3: update session_id + user_id) đều bị RLS/FK từ chối với SQLSTATE chính xác (`42501` hoặc `23503`). Mọi ngoại lệ không nằm trong bộ mã hợp lệ đều bị tái ném lỗi (fail-closed). Cơ chế phân loại lỗi được kiểm chứng độc lập qua Negative Oracle test (`MSG-06-ORACLE`). Trạng thái tổng hợp (`message_count`, `last_message_at`) của Session B và Session A được kiểm chứng trước/sau và hoàn toàn không bị biến đổi $\rightarrow$ **PASS**.
- **MSG-07:** UPDATE lặp lại trên tin nhắn đã completed (ví dụ cập nhật tokens) $\rightarrow$ `message_count` không đổi (lũy đẳng).
- **MSG-08:** Chuyển trạng thái `completed` sang `error` $\rightarrow$ `message_count` giảm chính xác.

---

## 8. RPC Authorization Tests (FV-G2-03)

- **PRIV-01:** `has_function_privilege('anon', ...)` $\rightarrow$ **FALSE** (Đã REVOKE).
- **PRIV-02:** `has_function_privilege('authenticated', ...)` $\rightarrow$ **TRUE** (Đã GRANT).
- **RPC-01 (Unauthenticated/Anon):** `auth.uid() IS NULL` $\rightarrow$ Ném lỗi `unauthorized:authentication_required`.
- **RPC-02 (Unrelated User):** User B gọi patch hackathon của User A $\rightarrow$ Ném lỗi `unauthorized:insufficient_permissions`.
- **RPC-06 (Unauthorized Instructor):** User C (instructor không có quyền) $\rightarrow$ Ném lỗi `unauthorized:insufficient_permissions`.
- **RPC-03 (Owner / Creator):** User A gọi patch hackathon do mình tạo $\rightarrow$ **ALLOWED**.
- **RPC-04 (Invited Judge):** User có invite role `judge` hợp lệ trong `public.hackathon_access_invites` $\rightarrow$ **ALLOWED**.
- **RPC-05A (Admin):** User role `admin` $\rightarrow$ **ALLOWED**.
- **RPC-05B (Support Staff):** User role `support_staff` $\rightarrow$ **ALLOWED**.
- **DATA-01 (Metrics Atomicity):** Các trường `title`, `description`, `max_participants` giữ nguyên 100%; chỉ `metrics_snapshot` thay đổi.

---

## 9. Entitlement Tests (FV-G2-01)

- **ENT-01:** Subscription `status = 'active'` nhưng `expires_at = now() - interval '30 days'` $\rightarrow$ Không được trả về (`0 rows`).
- **ENT-02:** Subscription `status = 'active'` và `expires_at = now() + interval '30 days'` $\rightarrow$ Trả về chính xác gói `bootcamp`.
- **ENT-03:** User C có `profiles.tier = 'pro'` nhưng không có bản ghi subscription active unexpired $\rightarrow$ Trả về `0 rows`, cô lập hoàn toàn giá trị cũ của `profiles.tier`.

---

## 10. Concurrency Test (FV-G2-03 Lost Update Prevention)

Kịch bản thực thi tại [`scripts/db/tests/g2-r1-concurrency.integration.mjs`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/tests/g2-r1-concurrency.integration.mjs):
- **Khởi tạo:** Hackathon có `title = 'Original Concurrent Title'`, `metrics_snapshot = { registrations_total: 0 }`.
- **Kết nối 1 (Manager Edit):** Chạy UPDATE đổi `title = 'MANAGER_CONCURRENT_TITLE_UPDATED'`, `description = 'MANAGER_CONCURRENT_DESC_UPDATED'`.
- **Kết nối 2 (Background Metrics Patch):** Chạy đồng thời gọi RPC `patch_hackathon_metrics_snapshot` với `registrations_total: 77, submissions_total: 19`.
- **Kết quả DB sau khi kết thúc song song:**
  - `document.title` là `'MANAGER_CONCURRENT_TITLE_UPDATED'` (Sửa đổi của manager được bảo toàn 100%).
  - `document.description` là `'MANAGER_CONCURRENT_DESC_UPDATED'` (Được bảo toàn 100%).
  - `document.metrics_snapshot.registrations_total` là `77` (Cập nhật snapshot thành công).
  - `document.metrics_snapshot.submissions_total` là `19` (Cập nhật snapshot thành công).

---

## 11. Tests That Prove Old Failure

| Nhóm kiểm thử | Hành vi trên Code Cũ (Bị Codex Reject) | Hành vi trên Code Mới (G2-R1) |
| :--- | :--- | :--- |
| **FV-G2-01** (Entitlement) | Code cũ trả về subscription hết hạn nếu `status = 'active'`, và fallback sang `profiles.tier = 'pro'` $\rightarrow$ **FAIL ENT-01 & ENT-03**. | Code mới lọc `.gt("expires_at", now())` và bỏ fallback $\rightarrow$ **PASS ENT-01, ENT-02, ENT-03**. |
| **FV-G2-02** (Ownership) | Code cũ không có composite FK `(session_id, user_id)` và RLS WITH CHECK yếu $\rightarrow$ User A có thể gắn conversation vào session của User B $\rightarrow$ **FAIL OWN-02 & OWN-03**. | Code mới chặn cả ở tầng RLS lẫn Composite Foreign Key $\rightarrow$ **PASS OWN-01 đến OWN-08**. |
| **FV-G2-03** (Concurrency) | Code cũ đọc document $\rightarrow$ merge $\rightarrow$ ghi đè lại toàn bộ document $\rightarrow$ Làm mất tiêu đề mà manager sửa đổi đồng thời $\rightarrow$ **FAIL CONCURRENCY-01 & DATA-01**. | Code mới dùng RPC `jsonb_set` atomic tại tầng PostgreSQL $\rightarrow$ **PASS CONCURRENCY-01 & DATA-01**. |

---

## 12. Commands Executed

| Lệnh | Kết quả | Ghi chú |
| :--- | :--- | :--- |
| `pnpm db:verify` | **PASS** (31/31 tests pass) | Baseline migrations verified, 0 drift. |
| `pnpm test` | **PASS** (133/133 tests pass) | 27 test files passed trong 2.59s. |
| `pnpm lint` | **PASS** (0 errors, 0 warnings) | ESLint clean trên toàn repository. |
| `pnpm build:staging` | **PASS** | TypeScript compile + Vite staging build thành công. |
| `pnpm build:prod` | **PASS** | TypeScript compile + Vite production build thành công. |
| `git diff --check` | **PASS** | Không có lỗi formatting / whitespace. |
| `pnpm db:verify:local` | **PASS (100% SUCCESS)** | Recreate 32 migrations từ zero + 100% SQL & Concurrency tests pass trên Docker PostgreSQL container. |

---

## 13. Docker Execution

- **Executed:** **YES**
- **Môi trường:** Docker Desktop version 29.6.2 (build dfc4efb) trên host Windows/WSL2, container PostgreSQL 15 / Supabase local.

---

## 14. Exact Codex Re-Verification Targets

Để Codex Sol Medium tái kiểm tra nhanh chóng:
1. **Runner Entrypoint & Safety:** [`scripts/db/verify-local-migration-apply.mjs`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/verify-local-migration-apply.mjs).
2. **SQL Integration Suite:** [`scripts/db/tests/g2-r1-db-integration.sql`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/tests/g2-r1-db-integration.sql).
3. **Two-Connection Concurrency Runner:** [`scripts/db/tests/g2-r1-concurrency.integration.mjs`](file:///g:/Documents/CORELIA/corelia-app/scripts/db/tests/g2-r1-concurrency.integration.mjs).

---

## 15. Safety

- Main writes: **NONE**
- Staging writes: **NONE**
- Commit: **NONE**
- Push: **NONE**
- Deploy: **NONE**
- Released migration changes: **NONE**
