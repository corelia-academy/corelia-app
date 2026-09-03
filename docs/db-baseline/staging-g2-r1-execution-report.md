# G2-R1 Staging Execution Report

> **Historical hackathon evidence:** kết quả invited judge, access invite và metrics RPC bên dưới thuộc lần triển khai cũ. Migration tinh giản xóa các object đó không cần export; xem [Hackathon hiện hành](../hackathon/README.md).

## 1. Verdict

**`STAGING_VALIDATION_PASS_PENDING_REVIEW`**

Tất cả 5 forward migrations thuộc chuỗi C-06, C-08, C-09, G2, và G2-R1 đã được áp dụng thành công lên môi trường Staging (`corelia-staging`). Hai Edge Functions bị ảnh hưởng (`ai-tutor`, `corelia-api`) đã được build và deploy hoàn tất. Toàn bộ các bài kiểm thử đối kháng trực tiếp trên database Staging và các cổng kiểm chuẩn guardrails, lint, test, build đều đạt kết quả **100% PASS**.

---

## 2. Target Identity

- **Tổ chức (Organization ID):** `ukzwmgvjbcwcjvfurvzp`
- **Tên dự án (Project Name):** `corelia-staging`
- **Mã dự án (Project ID / Ref):** `opoozbmfbezkrpzxsusx`
- **Khu vực (Region):** `Southeast Asia (Singapore)`
- **Xác nhận danh tính:** Độc lập xác minh qua CLI `supabase projects list` và `supabase link --project-ref opoozbmfbezkrpzxsusx`. Tuyệt đối không nhầm lẫn với Production (`lawhkvyyoznwygzsycan`).

---

## 3. Preflight

Trước khi thực hiện bất kỳ thao tác thay đổi nào trên Staging, các truy vấn kiểm tra dữ liệu chỉ đọc (read-only preflight) đã được thực thi và cho kết quả:

- **Bản ghi cuộc hội thoại mồ côi / lệch owner (`conversation_owner_mismatches`):** `0`
- **Bản ghi session lệch số lượng tin nhắn (`session_count_mismatches`):** `0`
- **Subscription active nhưng đã quá hạn (`stale_active_subscriptions`):** `0`
- **Voucher / redemption mồ côi (`orphan_vouchers`, `orphan_redemptions`):** `0`
- **Tổng số chat sessions hiện hữu trên Staging:** `125`
- **Tổng số conversations hiện hữu trên Staging:** `14`
- **Tổng số hackathons hiện hữu trên Staging:** `1`
- **Migration ledger ban đầu:** 139 migrations từ baseline, migration mới nhất là `20260818120000_clean_legacy_manual_mint_templates.sql`. Không có migration lạ ngoài repository.

---

## 4. Migrations Applied

Các migration được áp dụng tuần tự và đồng bộ qua lệnh `supabase migration up --linked --include-all`:

| Version | Migration File | Mục đích | Kết quả |
|---|---|---|---|
| `20260823120000` | `20260823120000_seed_projects_without_overwrite.sql` | C-06: Seed project 1 lần từ submission, không ghi đè khi update | **APPLIED (SUCCESS)** |
| `20260823121000` | `20260823121000_ai_quota_semantic_normalization.sql` | C-08: Chuẩn hóa quota thành công qua RPC `record_ai_successful_usage` | **APPLIED (SUCCESS)** |
| `20260823122000` | `20260823122000_hackathon_canonical_project_compatibility.sql` | C-09: Canonical provenance `hackathon` và tương thích ngược `contest` | **APPLIED (SUCCESS)** |
| `20260823130000` | `20260823130000_g2_canonical_state_and_data_integrity.sql` | G2: Streak, Entitlement, Message-count trigger, Voucher archival, Metrics RPC | **APPLIED (SUCCESS)** |
| `20260823140000` | `20260823140000_g2_r1_remediation.sql` | G2-R1: Composite FK `(session_id, user_id)`, RLS WITH CHECK, JSONB Patch RPC | **APPLIED (SUCCESS)** |

**Tổng số migration trên Staging sau khi áp dụng:** `144` migrations (139 historical + 5 forward).

---

## 5. Runtime Components Deployed

| Thành phần | Lý do triển khai | Môi trường mục tiêu | Kết quả |
|---|---|---|---|
| **Edge Function: `ai-tutor`** | Cập nhật logic hạch toán quota thành công qua RPC `record_ai_successful_usage`, bảo vệ quota khi provider lỗi | `corelia-staging` (`opoozbmfbezkrpzxsusx`) | **DEPLOYED (SUCCESS, script size: 127.9kB)** |
| **Edge Function: `corelia-api`** | Cập nhật xử lý lưu trữ/ngừng áp dụng voucher (`archived_at`), bảo toàn lịch sử redemption | `corelia-staging` (`opoozbmfbezkrpzxsusx`) | **DEPLOYED (SUCCESS, script size: 152kB)** |

---

## 6. C-06 Results (Project Seed-Only Invariants)

- **C06-01 (Seed on Insert):** Chèn bản ghi `hackathon_submissions` đầu tiên $\rightarrow$ Tự động tạo chính xác 1 project với `title = 'Original Seed Title'`.
- **C06-02 (User Edit Independence):** Người dùng sửa trực tiếp project thành `title = 'USER_EDITED_PORTFOLIO_TITLE'`.
- **C06-03 (Submission Update Preservation):** Cập nhật nội dung submission $\rightarrow$ `projects.title` vẫn giữ nguyên là `USER_EDITED_PORTFOLIO_TITLE` (không bị đè).
- **C06-04 (No Duplicate Projects):** Cập nhật submission liên tiếp nhiều lần $\rightarrow$ Tổng số project của submission vẫn bằng `1` (`ON CONFLICT DO NOTHING`).
- **C06-06 (Source Provenance):** `source_type` là `hackathon`, `source_id` là ID cuộc thi, `source_submission_id` trỏ chuẩn xác đến submission ID.

---

## 7. C-08 Results (AI Quota Semantics)

- **AIQ-01 (Successful Usage Logging):** Gọi RPC `record_ai_successful_usage` $\rightarrow$ Ghi log vào `ai_usage_log`, cập nhật `ai_usage_daily` và `ai_usage_monthly` chính xác.
- **AIQ-02 (Error Telemetry Isolation):** Các yêu cầu thất bại không gọi RPC hạch toán quota thành công.
- **AIQ-03 (Expired Active Subscriptions):** Subscription có `status = 'active'` nhưng `expires_at <= now()` bị loại bỏ hoàn toàn bởi predicate `expires_at > now()`, tài khoản quay về tier `free`.
- **AIQ-04 (Valid Active Subscriptions):** Subscription unexpired trả về chính xác tier `bootcamp`.
- **AIQ-05 (Stale Profiles Tier Isolation):** User có `profiles.tier = 'pro'` nhưng không có bản ghi subscription active unexpired $\rightarrow$ Trả về `0 rows`, cô lập triệt để fallback cũ.

---

## 8. C-09 Results (Hackathon Canonical Compatibility)

- **HACK-01:** New submissions tạo project với canonical `source_type = 'hackathon'`.
- **HACK-02 & HACK-03:** Các project lịch sử mang `source_type = 'contest'` không bị nhân bản khi submission được cập nhật (`IF EXISTS ... source_type = 'contest' THEN RETURN NEW;`).
- **HACK-04 & HACK-05:** `starts_at` / `ends_at` và các cột timeline events hoạt động bình thường trên schema Staging.

---

## 9. G2-A Streak Results

- **Canonical State:** `user_daily_streaks.current_streak` (giá trị `7`) là chân lý dữ liệu duy nhất mà runtime đọc.
- **Stale Column Isolation:** `profiles.streak_days = 1` không ghi đè hay làm sai lệch streak thực tế.

---

## 10. G2-B Entitlement Results

- Đối chứng độc lập với 3 kịch bản:
  1. Expired active sub $\rightarrow$ Excluded (`0 active rows`).
  2. Active unexpired sub $\rightarrow$ Valid (`bootcamp`).
  3. Stale profile tier $\rightarrow$ Isolated (`0 active rows`).

---

## 11. G2-C Conversation & Trigger Results

- **CHAT-01 (Legitimate Owner Insert):** Thao tác của chủ sở hữu vào session của mình $\rightarrow$ Thành công, `message_count` tăng lên 1, `last_message_at` khớp thời điểm tạo.
- **CHAT-02 (Cross-Owner Insert Attack):** User A chèn vào Session B của User B $\rightarrow$ Bị từ chối bởi RLS `WITH CHECK` và Composite FK `(session_id, user_id)` (SQLSTATE `42501` / `23503`).
- **CHAT-03 (Cross-Owner Transfer Attack):** User A chuyển conversation của mình sang Session B $\rightarrow$ Bị từ chối (SQLSTATE `42501` / `23503`).
- **CHAT-04 (Dual Reassign Attack):** User A chuyển cả `session_id = B` và `user_id = B` $\rightarrow$ Bị từ chối bởi RLS `WITH CHECK (auth.uid() = user_id)` (SQLSTATE `42501`).
- **CHAT-05 (Negative Oracle & Invariant):** Ngoại lệ nhân tạo `22012` bị rethrow chuẩn xác; trạng thái `message_count` (`1`) và `last_message_at` của Session B không hề bị suy suyển sau toàn bộ các đợt tấn công.

---

## 12. G2-D Voucher Results

- **VCH-01 & VCH-04 (FK RESTRICT Protection):** Cố tình xóa vật lý `ai_voucher_batches` khi đã có code/redemption $\rightarrow$ Bị chặn lại bởi foreign key RESTRICT.
- **VCH-02 & VCH-03 (Soft Archival):** Cập nhật `archived_at = now()`, `active = false` $\rightarrow$ Toàn bộ lịch sử đổi mã trong `ai_voucher_redemptions` được bảo toàn nguyên vẹn 100%.

---

## 13. G2-E Metrics RPC Results

- **Quyền gọi RPC `patch_hackathon_metrics_snapshot`:**
  - `anon`: Bị từ chối (`EXECUTE` đã bị REVOKE, `unauthorized:authentication_required`).
  - Unrelated authenticated user: Bị từ chối (`unauthorized:insufficient_permissions`).
  - Creator: Thành công.
  - Invited judge (`accepted` invite): Thành công.
- **Tính toàn vẹn dữ liệu JSONB:** Hàm sử dụng `jsonb_set` atomic tại PostgreSQL; toàn bộ các trường khác trong `document` (`title`, `description`, `max_participants`) được bảo toàn byte-for-byte.

---

## 14. G2-F Pricing Results

- Runtime tiếp tục sử dụng TypeScript pricing module trong `supabase/functions/ai-tutor/usageAccounting.ts`.
- Bảng CSDL `ai_model_pricing` đã được đánh dấu deprecation candidate trong migration comment.

---

## 15. Live RLS / Functions / Triggers Inspection

Truy vấn trực tiếp PostgreSQL system catalogs (`pg_constraint`, `pg_policy`, `pg_trigger`, `pg_proc`) trên Staging:

| Đối tượng | Trạng thái Live trên Staging |
|---|---|
| Composite Foreign Key `ai_conversations_session_user_fkey` | **EXISTS (ACTIVE)** |
| RLS Policy `own_conversations` trên `public.ai_conversations` | **EXISTS (ENFORCED)** |
| Trigger `trg_sync_ai_chat_session_message_count` | **EXISTS (ENABLED)** |
| Function `patch_hackathon_metrics_snapshot` | **EXISTS (EXECUTE: authenticated only, anon REVOKED)** |
| Function `record_ai_successful_usage` | **EXISTS (SECURITY DEFINER)** |
| Column `archived_at` trên `ai_voucher_batches` | **EXISTS (PRESENT)** |

---

## 16. Catalog Drift Check

- `pnpm db:baseline:verify`: **PASS** (139 frozen baseline + 5 forward migrations hợp lệ).
- `pnpm db:drift:verify`: **PASS** (0 unapproved drift, allowlist hợp lệ).
- `pnpm db:guard:test`: **PASS** (31/31 guard contract tests pass).

---

## 17. Regression Smoke

Toàn bộ các bộ kiểm tra tự động và build đã được thực thi độc lập:

| Kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| `pnpm db:verify` | **PASS (31/31)** | Baseline, drift allowlist và guard contracts |
| `pnpm test` | **PASS (133/133)** | 27 test files passed |
| `pnpm lint` | **PASS (0 errors)** | ESLint clean |
| `pnpm build:staging` | **PASS** | TypeScript compile + Vite build thành công |
| `pnpm db:verify:local` | **PASS (100%)** | Recreate 144 migrations + SQL suite + Concurrency |
| `git diff --check` | **PASS** | 0 lỗi whitespace / formatting |

---

## 18. Failures / Deviations

- Không phát hiện bất kỳ lỗi hồi quy hay sai lệch nào.
- 0 lỗi schema drift.

---

## 19. Data Created for Testing

Tất cả các bản ghi fixture được tạo trong quá trình kiểm thử Staging (sử dụng UUID cô lập `a1111111-...`, `b2222222-...`, `stg-hackathon-...`) đã được dọn dẹp sạch sẽ (`DELETE`) ở cuối transaction kiểm thử. Dữ liệu thực của người dùng trên Staging hoàn toàn không bị ảnh hưởng.

---

## 20. Validation Commands

```bash
# 1. Liên kết và kiểm tra danh tính Staging
supabase link --project-ref opoozbmfbezkrpzxsusx
supabase migration list --linked

# 2. Áp dụng 5 migrations lên Staging
supabase migration up --linked --include-all

# 3. Deploy Edge Functions
supabase functions deploy ai-tutor --project-ref opoozbmfbezkrpzxsusx
supabase functions deploy corelia-api --project-ref opoozbmfbezkrpzxsusx

# 4. Chạy kiểm thử tích hợp trên Staging
supabase db query --linked --file scripts/db/tests/g2-r1-db-integration.sql

# 5. Chạy toàn bộ local verification & regression
pnpm db:verify
pnpm test
pnpm lint
pnpm build:staging
pnpm db:verify:local
git diff --check
```

---

## 21. Production Readiness

| Gói thay đổi | Sẵn sàng cho Main/Production? |
|---|---|
| **C-06 (Project Seed-Only)** | **YES** |
| **C-08 (AI Quota Semantics)** | **YES** |
| **C-09 (Hackathon Canonical Compatibility)** | **YES** |
| **G2 / G2-R1 (State & Data Integrity)** | **YES** |

> **LƯU Ý AN TOÀN:** Không tự ý triển khai lên Production. Quá trình triển khai Production phải tuân theo phê duyệt riêng biệt.

---

## 22. Safety

- Main / Production writes: **NONE**
- Production deploy: **NONE**
- Commit: **NONE**
- Push: **NONE**
