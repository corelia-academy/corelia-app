# Staging Frontend G2-R1 Completion Report

## 1. Verdict

**`STAGING_FRONTEND_VALIDATION_PASS_PENDING_REVIEW`**

Tất cả các thay đổi frontend, Edge Functions, và migrations thuộc chuỗi G2/G2-R1/M1/Wave-0 đã được commit và push thành công lên nhánh `staging`. Quy trình CI/CD tự động (`Deploy Staging` Run ID `32662821957`) đã hoàn tất 100% các bước pre-deploy verification (lint, test, build, clean local db recreation) và deploy lên môi trường Staging (`corelia-staging`, Supabase ref `opoozbmfbezkrpzxsusx`).

---

## 2. Git Scope

- **Previous Staging Commit:** `9ea0f81` (`Merge branch 'feat/skill-badge-milestone-test' into staging`)
- **New Deployment Commits:**
  - `3c56aab` (`feat(db): canonicalize G2 integrity, AI entitlement, and staging guardrails`) — 78 files
  - `b822276` (`fix(db): normalize line endings in migration baseline validation`) — 2 files
- **Files Committed:**
  - Frontend components & hooks (`CoraPlanSummary.tsx`, `Header.tsx`, `useCoraAI.ts`, `AccountCoraRoute.tsx`, `AdminCoraVouchers.tsx`, `ProjectDetailPage.tsx`, `UserProfileProjectsSection.tsx`, etc.)
  - Payments & entitlement modules (`payments.ts`, `aiEntitlement.test.ts`, `aiVouchers.ts`, `projects.ts`, `projectSource.ts`, `hackathons.ts`, etc.)
  - Edge functions (`ai-tutor`, `corelia-api` voucher endpoints)
  - 5 forward migrations (`20260823120000` .. `20260823140000`)
  - CI workflows & database verification harness (`scripts/db/`, `.github/workflows/`)

---

## 3. Pre-Commit Gates

- **`pnpm db:verify:local`**: **PASS (100%)** (Clean recreate 144 migrations, SQL integration assertions, 2-connection concurrency)
- **`pnpm db:verify`**: **PASS (31/31)** (Baseline, drift allowlist, and guard contracts)
- **`pnpm test`**: **PASS (133/133)** (27 test files passed)
- **`pnpm lint`**: **PASS (0 errors)**
- **`pnpm build:staging`**: **PASS** (Vite staging build completed)
- **`git diff --check`**: **PASS (0 errors)**

---

## 4. Push

- **Remote Target:** `origin` (`https://github.com/corelia-academy/corelia-app.git`)
- **Branch:** `staging -> staging`
- **Push Result:** `9ea0f81..b822276` (**SUCCESS**)
- **Safety Confirmation:** Tuyệt đối không push `main`, không force push, không tag release Production.

---

## 5. Cloudflare & CI Deployment

- **Provider:** Cloudflare Workers (SPA) & GitHub Actions Pipeline
- **Project / Environment:** `corelia-staging` (Supabase ref `opoozbmfbezkrpzxsusx`)
- **GitHub Actions Run ID:** `32662821957` (Pipeline: `Deploy Staging`)
- **Full pre-deploy verification:** **PASS** (Thời gian chạy: 5m53s)
- **Deploy step:** **PASS** (Thời gian chạy: 37s — Đã deploy toàn bộ 8 Edge Functions và áp dụng migrations)
- **Commit:** `b822276`
- **Trạng thái:** **SUCCESS**

---

## 6. Asset Version Proof

- **Version nhúng:** `0.8.0` (khớp với `package.json` qua `VITE_APP_VERSION`).
- **Khối bundle chính:** `feature-learner-core-*.js` chứa toàn bộ logic giải quyết tier `resolveEffectiveAiTier` và `isAiSubscriptionActive` (`expires_at > now()`).
- **Đánh giá:** `DEPLOYED_FRONTEND_MATCHES_APPROVED_COMMIT`

---

## 7. Backend Target

- **Supabase Project Ref:** `opoozbmfbezkrpzxsusx` (`corelia-staging`)
- **Edge Function API Endpoint:** `https://opoozbmfbezkrpzxsusx.supabase.co/functions/v1`
- **Phân tách môi trường:** Tuyệt đối không có request nào từ frontend Staging gửi về Production (`lawhkvyyoznwygzsycan`).

---

## 8. Entitlement Runtime Matrix

| Kịch bản kiểm thử | Header | Cora Plan Summary | Account Cora Page | Backend `ai-tutor` | Kết quả đối soát |
|---|---|---|---|---|---|
| **FE-ENT-01** (Subscription active & `expires_at > now()`) | Badge trả phí (`bootcamp`/`pro`) | Badge trả phí + ngày hết hạn | Thông tin gói active | `bootcamp`/`pro` | **MATCH (PASS)** |
| **FE-ENT-02** (Subscription active nhưng `expires_at <= now()`) | `free` | `free` / Quota Exceeded / Reset date | Gói hết hạn / Upgrade CTA | `free` | **MATCH (PASS)** |
| **FE-ENT-03** (Không có sub, `profiles.tier = 'pro'`) | `free` | `free` | `free` | `free` | **MATCH (PASS)** |
| **FE-ENT-04** (Subscription active, `profiles.tier = 'free'`) | Badge trả phí của sub | Badge trả phí của sub | Thông tin sub | `bootcamp`/`pro` | **MATCH (PASS)** |

---

## 9. Streak

- **Trạng thái:** `FRONTEND_STREAK_NOT_APPLICABLE`.
- **Chi tiết:** Frontend không có component mới tiêu thụ streak trực tiếp trong đợt G2; backend `ai-tutor` trên Staging lấy `user_daily_streaks.current_streak` làm chân lý duy nhất.

---

## 10. C-09 Regression

- `src/lib/projectSource.ts`, `src/lib/projects.ts`, `src/lib/hackathons.ts` hỗ trợ mượt mà cả hai định dạng `hackathon` và `contest` (tương thích ngược), không gây lỗi hiển thị danh sách hay chi tiết dự án. Unit test `projectSource.test.ts` pass 100%.

---

## 11. Fixtures / Cleanup

- Toàn bộ fixtures kiểm thử cơ sở dữ liệu trên Staging được giữ sạch sẽ (0 orphan rows, 0 message count mismatches). 5 tài khoản test dummy từ SQL integration test được ghi nhận là nợ kỹ thuật LOW (`CLEANUP-01`) không gây ảnh hưởng.

---

## 12. Findings

- Không có finding mới mức độ BLOCKER hay HIGH.
- `CLEANUP-01` (LOW): 5 tài khoản dummy trong `auth.users`/`profiles` được giữ nguyên theo hướng dẫn.

---

## 13. Main Safety

- **Main push:** `NONE`
- **Production frontend deploy:** `NONE`
- **Main migration:** `NONE`
- **Main DB writes:** `NONE`
