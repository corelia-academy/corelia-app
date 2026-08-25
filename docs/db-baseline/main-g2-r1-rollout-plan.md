# G2-R1 Main Rollout Plan — R3

## 1. Verdict

**`MAIN_G2_R3_REMEDIATION_READY_FOR_INDEPENDENT_VERIFY`**

Tài liệu này xác định kế hoạch triển khai Production hai giai đoạn (Two-Stage Release Architecture) cho chuỗi thay đổi G2-R1/Wave-0/M1 đã được phê duyệt và hoàn tất khắc phục toàn bộ 6 phát hiện kỹ thuật từ Codex Final (`FC-01` $\rightarrow$ `FC-05`, `FC-08`). Kế hoạch cô lập hoàn toàn phạm vi phát hành bằng Release Manifest bất biến, loại bỏ đường dẫn workflow không an toàn trên Main, thiết lập chốt chặn hậu kiểm trực tiếp sau Edge deploy (Live Post-Edge Invariant Gate), xử lý triệt để cửa sổ tương thích Trigger/Edge, và phân định rõ ràng giữa Control-Plane Bootstrap (Stage A) và Application Release (Stage B).

Tuyệt đối **CHƯA CÓ BẤT KỲ THAO TÁC GHI DATABASE, DEPLOY, MERGE HOẶC PUSH NÀO LÊN PRODUCTION** trong giai đoạn này.

---

## 2. Release Engineering Architecture: Two-Stage Rollout

Để giảm thiểu rủi ro triển khai và thỏa mãn chính sách bảo vệ GitHub Environment `production` (chỉ chấp nhận workflow chạy từ nhánh `main`), quy trình triển khai được chia làm hai giai đoạn độc lập:

```mermaid
flowchart TD
    subgraph Stage A: Control-Plane Bootstrap
        A1[Minimal Control-Plane Commit] --> A2[Merge/Push vào main]
        A2 --> A3[Kích hoạt deploy-prod.yml an toàn trên main]
    end
    subgraph Stage B: G2 Application Release
        B1[Tạo Isolated G2 Release Artifact từ base Main SHA] --> B2[Chốt APPROVED_PRODUCTION_RELEASE_SHA & MANIFEST_SHA]
        B2 --> B3[Manual Dispatch deploy-prod.yml trên main với release_sha]
        B3 --> B4[Verify Manifest, Base SHA 66981c2 & Exact 139 Ledger]
        B4 --> B5[Apply 5 Migrations canonically]
        B5 --> B6[Pre-Edge Live DB Check]
        B6 --> B7[Deploy Edge Functions: corelia-api, ai-tutor]
        B7 --> B8[Live DB Post-Edge Invariant Gate: Verify Final State & Aggregates]
        B8 --> B9[Smoke Test Non-Destructive]
        B9 --> B10[User Risk Acceptance: Merge G2 Artifact vào main]
        B10 --> B11[Cloudflare Deploy Frontend Production]
        B11 --> B12[End-to-End Smoke & Giám sát 60m/24h]
    end
    Stage A --> Stage B
```

---

## 3. Stage A — Control-Plane Bootstrap

### Mục tiêu
Thay thế workflow cũ không an toàn trên `origin/main` (vốn chứa `migration repair` và `--include-all`) bằng workflow an toàn mới mà **KHÔNG mang theo 44 commits tính năng đang có trên Staging**.

### Danh sách file trong Bootstrap Commit (Control-Plane ONLY)
1. `.github/workflows/deploy-prod.yml`
2. `scripts/db/verify-production-migration-state.mjs`
3. `scripts/db/verify-production-post-migration.mjs`
4. `scripts/db/verify-production-release-artifact.mjs`
5. `scripts/db/verify-production-frontend-artifact.mjs`
6. `scripts/db/production-post-migration-inspect.sql`
7. `scripts/db/build-production-release-candidate.mjs`
8. `scripts/db/tests/production-migration-state.test.mjs`
9. `scripts/db/tests/production-post-migration.test.mjs`
10. `scripts/db/tests/production-release-artifact.test.mjs`
11. `scripts/db/tests/production-frontend-artifact.test.mjs`
12. `docs/db-baseline/main-g2-r1-rollout-plan.md`
13. `docs/db-baseline/production-release-artifact-manifest.json`

### Chứng minh tính bất biến của Application Runtime (Runtime Neutrality)
Bootstrap commit chỉ chứa file CI workflow, governance scripts, unit tests, schema manifests và markdown documentation. Có **0 thay đổi** đối với `src/`, `public/`, `supabase/migrations/` hoặc `supabase/functions/`. Nếu việc push lên `main` kích hoạt Cloudflare build frontend, artifact được build ra 100% đồng nhất về source code và hành vi với phiên bản Production hiện tại.

---

## 4. Stage B — Isolated G2 Production Release Artifact

### Base Main SHA & Candidate Identity
- **Pre-release Main Base SHA:** `66981c2044b515a6fa07a71d06f8265d171d6a74`
- **Candidate Tree SHA-256:** `a493046c227685b2544d19e322bdb185776a80e5ce1782bbe95d22f110c99463`
- **Total Changed Files:** `83` files (bao gồm fix `FC-01` cho `useCourseProgress.ts`).

### Phân loại Delta giữa Staging và Isolated G2 Scope
Nhánh `staging` hiện có 44 commits (~141 files). G2 Production Release được cô lập nghiêm ngặt, chỉ chứa các file thuộc phạm vi đã được kiểm duyệt:

| Phân loại | Thành phần file | Quyết định phát hành |
|---|---|---|
| **G2_REQUIRED** | 5 forward migrations (`20260823120000` .. `20260823140000`), Edge Functions `ai-tutor`, `corelia-api/payments/vouchers.ts`, modules `payments.ts`, `Header.tsx`, `CoraPlanSummary.tsx`, `AccountCoraRoute.tsx`, `useCoraAI.ts`, `aiVouchers.ts`, `projects.ts`, `projectSource.ts`, `hackathons.ts`, `UserProfileProjectsSection.tsx`, `ProjectDetailPage.tsx`, `useCourseProgress.ts` (FC-01 fix), admin vouchers, localization | **Bao gồm trong G2 Release Artifact** |
| **WAVE0_GUARD_REQUIRED** | Baseline scripts, drift allowlist, catalog fingerprint, baseline.json (LF normalized) | **Bao gồm trong G2 Release Artifact** |
| **STAGING_ONLY_VALIDATION** | Staging execution reports, integration test scripts (`g2-r1-db-integration.sql`, `g2-r1-concurrency.integration.mjs`) | **Bao gồm trong repo/docs** |
| **DEFERRED** | `cron-learning-reminders` | **Hoãn có chủ đích (`DEFER_SAFE`)** |
| **UNRELATED_FEATURE** | Các commit thử nghiệm UI khác ngoài phạm vi G2 | **Loại bỏ khỏi G2 Release Artifact** |

---

## 5. FC-01 Remediation: Lint Failure Resolved

- **Nguyên nhân gốc:** Tuyến code cũ trên `origin/main` trong `src/pages/course-details/hooks/useCourseProgress.ts` gọi `setHasStarted(false)` đồng bộ trong body `useEffect`, vi phạm quy tắc `react-hooks/set-state-in-effect`.
- **Khắc phục:** Đã bổ sung file `src/pages/course-details/hooks/useCourseProgress.ts` vào Release Manifest và Candidate Tree. Phiên bản này quản lý state bằng `requestKey` và `loadedResult` sạch sẽ, không gọi synchronous setState trong effect.
- **Xác thực:** `pnpm lint` pass 100% (0 errors, 0 warnings).

---

## 6. FC-02 & FC-05: Trigger / Edge Compatibility Window & Post-Edge Gate

### Phân tích cửa sổ tương thích
1. Khi migration `20260823130000` được áp dụng lên DB, trigger `trg_sync_ai_chat_session_message_count` được kích hoạt trên `ai_conversations`.
2. Trong khoảng thời gian trước khi `ai-tutor` mới được deploy, `ai-tutor` cũ vẫn đang chạy trên Production.
3. Bản `ai-tutor` mới đã loại bỏ hoàn toàn lệnh `UPDATE ai_chat_sessions SET message_count = prevCount + 2`, để cho trigger quản lý tự động cả `message_count` và `last_message_at`.
4. Để triệt tiêu rủi ro bất đồng bộ số liệu trong cửa sổ chuyển giao, workflow triển khai quy trình 4 bước:
   - **Bước 1:** Áp dụng DB migrations canonically.
   - **Bước 2:** Chạy Pre-Edge gate kiểm tra DB schema.
   - **Bước 3:** Deploy ngay lập tức 2 Edge Functions (`corelia-api`, `ai-tutor`).
   - **Bước 4 (Post-Edge Gate):** Chạy **Live DB Post-Edge Invariant Gate** trực tiếp trên database để đối soát `session_count_mismatches = 0` trên toàn bộ sessions sau khi Edge Function mới đã active.
5. Nếu bất kỳ sai lệch nào xảy ra trong quá trình deploy Edge, Post-Edge Gate sẽ **FAIL CLOSED** ngay lập tức, chặn hoàn toàn bước merge Main / deploy Frontend.

---

## 7. FC-04: Cloudflare Main-Push Deployment Behavior

- **Hiện trạng:** Frontend Production được cấu hình triển khai qua Cloudflare Workers / Pages thông qua Git integration liên kết với nhánh `main`.
- **Đánh giá thẩm định:** Do môi trường chạy cục bộ là READ-ONLY và không có quyền truy cập trực tiếp vào Cloudflare API token, hành vi triển khai tự động của Cloudflare khi push Stage A/B được phân loại là **`EXTERNAL_EVIDENCE_REQUIRED`**.
- **Chốt chặn bắt buộc (Hard Gate):**
  > **QUY TẮC AN TOÀN:** TUYỆT ĐỐI KHÔNG THỰC HIỆN BẤT KỲ THAO TÁC NÀO TRÊN MAIN CHO ĐẾN KHI HÀNH VI TRIỂN KHAI CỦA CLOUDFLARE ĐƯỢC NGƯỜI ĐIỀU HÀNH XÁC NHẬN BẰNG BẰNG CHỨNG THỰC TẾ HOẶC ĐƯỢC USER CHẤP THUẬN RỦI RO RÕ RÀNG.

---

## 8. CF-03 / FC-08: Recovery Limitations Acknowledgement

Bảng phân loại giới hạn phục hồi phải được operator đọc lại trước khi manual dispatch:

| Thành phần phục hồi | Phân loại | Bằng chứng kỹ thuật | Chiến lược xử lý sự cố |
|---|---|---|---|
| **Scheduled Physical Backup** | **`RECHECK_REQUIRED`** | Operator phải kiểm tra lại physical backup hiện có ngay trước release | Backup là lớp phục hồi thảm họa; chưa thay thế restore rehearsal |
| **PITR (Point-in-Time)** | **`UNAVAILABLE`** | Chưa được kích hoạt trên gói dự án hiện tại | Không cam kết phục hồi theo từng giây |
| **DB Restore** | **`UNREHEARSED`** | Chưa có restore rehearsal | **Forward-fix là chiến lược phục hồi migration chính**; restore chỉ là phương án sự cố |
| **Edge Functions Rollback** | **`SOURCE_AVAILABLE_UNREHEARSED`** | Có source pre-release nhưng quy trình rollback có thể chưa được diễn tập | Redeploy source đã pin khi incident procedure cho phép |
| **Cloudflare Frontend Rollback** | **`UNPROVEN_OR_UNREHEARSED`** | Chưa có bằng chứng authenticated trong scope này | Không giả định dashboard rollback đã sẵn sàng |
| **RPO / RTO Evidence** | **`UNMEASURED`** | Chưa có số đo restore/recovery | Không cam kết RPO/RTO |

Workflow dùng input boolean `recovery_limitations_accepted`, không dùng `recovery_verified`. Khi chọn `true`, operator xác nhận rằng physical backup đã được kiểm tra lại và **chấp nhận rõ ràng** toàn bộ giới hạn: PITR không có, restore chưa rehearsal, RPO/RTO chưa đo, forward-fix là chiến lược DB migration recovery chính, Edge/frontend rollback có thể chưa rehearsal.

> **Nguyên tắc:** Đây là acknowledgement/risk acceptance, không phải tuyên bố recovery đã được kiểm chứng operationally. Không cam kết zero downtime, zero data loss hoặc instant rollback.

---

## 9. Production Pre-Migration & Post-Migration Gates

### Pre-Migration Guard
- Script `scripts/db/verify-production-migration-state.mjs` kiểm tra:
  - Project ref = `lawhkvyyoznwygzsycan`.
  - Đúng 139 migrations lịch sử (latest `20260818120000`).
  - Exact 10 forward migrations chờ chạy (`20260823120000` .. `20260825140000`).
  - Lệnh chạy: `supabase migration up --linked --dns-resolver https` (không `migration repair`, không `--include-all`).

### Post-Migration & Post-Edge Semantic Gates
- Script `scripts/db/verify-production-post-migration.mjs` và query `scripts/db/production-post-migration-inspect.sql` kiểm tra trực tiếp trên CSDL:
  - Ledger đúng 149 migrations, latest `20260825140000`.
  - Composite FK `(session_id, user_id)` ON DELETE CASCADE.
  - Unique `(id, user_id)` trên `ai_chat_sessions`.
  - RLS `WITH CHECK` expression trên `ai_conversations`.
  - Trigger `trg_sync_ai_chat_session_message_count` enabled (`ORIGIN`).
  - RPCs `record_ai_successful_usage` và `patch_hackathon_metrics_snapshot` là `SECURITY DEFINER`, search_path an toàn.
  - Vouchers: Cột `archived_at`, FK `RESTRICT`.
  - Invariants: `session_count_mismatches = 0`, `conversation_orphans = 0`, `conversation_owner_mismatches = 0`, `orphan_ai_vouchers = 0`, `orphan_ai_voucher_redemptions = 0`.
  - AI Backup & Restore Gate: Backup 18 bảng AI (`2,920` dòng) đạt chuẩn Level 4 PostgreSQL restore test trên môi trường cô lập trước khi xem xét bất kỳ thao tác dọn dẹp nào.
  - Observation Gate: Cửa sổ quan sát Staging bắt đầu từ `2026-08-25T11:29:07Z`; Production observation chưa bắt đầu; Issue #330 tiếp tục duy trì trạng thái BLOCKED.

---

## 10. Production Smoke Safety Policy

- **CẤM TUYỆT ĐỐI:** Tấn công đối kháng chèn conversation lệch owner, tạo giao dịch thanh toán, xóa/đổi mã voucher, ép AI provider outage, dùng tài khoản khách hàng thật.
- **CHO PHÉP:** Kiểm tra catalog chỉ đọc, healthcheck Edge Functions, 1 tài khoản test chuyên dụng được cấp phép, 1 AI request tối thiểu kiểm tra quota +1, verify bundle frontend trỏ đúng Production Supabase ref.

---

## 11. Safety Statement

- **Production writes trong quá trình remediation:** **NONE**
- **Production deploys:** **NONE**
- **Main push / merge:** **NONE**
- **Staging database writes:** **NONE**

---
