# Staging Frontend G2-R1 Completion

## 1. Verdict

**`STAGING_FRONTEND_DEPLOY_REQUIRES_GIT_WRITE`**

Artifact frontend cho môi trường Staging (`pnpm build:staging`) đã được biên dịch thành công 100% với cấu hình kết nối tới Supabase Staging (`opoozbmfbezkrpzxsusx`). Toàn bộ 133 unit tests, 31 guard contract tests, ESLint và local database verification đều đạt PASS. Tuy nhiên, việc triển khai frontend trực tiếp qua CLI (`wrangler deploy --env staging`) không thể thực hiện do thiếu biến môi trường `CLOUDFLARE_API_TOKEN` trong môi trường non-interactive. Do đó, quy trình triển khai frontend lên Cloudflare Staging đòi hỏi quyền commit và push các thay đổi đã được kiểm duyệt lên nhánh `staging` từ xa.

---

## 2. Hosting Target Identity

- **Nhà cung cấp (Provider):** Cloudflare Workers (Static Assets SPA)
- **Dự án Staging (Project / Environment):** `corelia-staging` (định nghĩa tại `env.staging.name` trong `wrangler.jsonc`)
- **Dự án Production (Project / Environment):** `corelia-app` (tuyệt đối không deploy)
- **Cấu hình định tuyến:** SPA Single Page Application (`not_found_handling: "single-page-application"`)

---

## 3. Source / Build Identity

- **Nhánh nguồn (Worktree/Branch):** `staging` (HEAD: commit `bcfef02` + uncommitted G2 frontend changes)
- **Lệnh build (Build Command):** `pnpm build:staging` (`tsc -b && vite build --mode staging`)
- **Artifact đầu ra (Artifact Output):** `dist/` (165 assets, entrypoint bundle `feature-learner-core-*.js`, `dist/wrangler.json`)
- **Cấu hình môi trường nhúng:** Chế độ `staging`, kết nối Supabase Ref `opoozbmfbezkrpzxsusx`

---

## 4. Deployment Evidence

- **Trạng thái thực thi trực tiếp qua Wrangler:** Lệnh `wrangler deploy --env staging --dry-run` chạy thành công (đọc 165 files từ `dist/`), nhưng lệnh deploy thật dừng lại do thiếu `CLOUDFLARE_API_TOKEN` (`In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work`).
- **Quy trình triển khai tiêu chuẩn:** Cloudflare tự động build và deploy khi có commit được push lên nhánh `staging` của remote repository.

---

## 5. Backend Target Verification

- **Supabase Project Ref:** `opoozbmfbezkrpzxsusx` (`corelia-staging`)
- **Edge Functions Target:** `https://opoozbmfbezkrpzxsusx.supabase.co/functions/v1`
- **Xác nhận an toàn:** Không có request nào từ frontend Staging trỏ nhầm về Production (`lawhkvyyoznwygzsycan`).

---

## 6. Entitlement Smoke Results

Đã kiểm chứng độc lập logic phân quyền AI trên các bề mặt UI (`Header.tsx`, `CoraPlanSummary.tsx`, `AccountCoraRoute.tsx`) thông qua hàm `resolveEffectiveAiTier` và `isAiSubscriptionActive` trong `src/lib/payments.ts`:

| Kịch bản kiểm thử | Header | Cora Plan Summary | Account Cora Route | Backend AI Tutor Tier | Kết quả đánh giá |
|---|---|---|---|---|---|
| **FE-ENT-01** (Subscription active & `expires_at > now()`) | Hiển thị badge tier trả phí (`bootcamp`/`pro`) | Hiển thị badge tier trả phí + số ngày còn lại | Hiển thị thông tin gói active | `bootcamp`/`pro` | **PASS** (Unit & Contract verified) |
| **FE-ENT-02** (Subscription active nhưng `expires_at <= now()`) | Hiển thị `free` | Hiển thị `free` | Hiển thị gói hết hạn / CTA nâng cấp | `free` | **PASS** (Unit & Contract verified) |
| **FE-ENT-03** (Không có sub, `profiles.tier = 'pro'`) | Hiển thị `free` | Hiển thị `free` | Hiển thị `free` | `free` | **PASS** (Unit & Contract verified) |
| **FE-ENT-04** (Subscription active, `profiles.tier = 'free'`) | Hiển thị badge tier của sub | Hiển thị badge tier của sub | Hiển thị thông tin sub | `bootcamp`/`pro` | **PASS** (Unit & Contract verified) |

---

## 7. Streak

- **Trạng thái:** `FRONTEND_STREAK_NOT_APPLICABLE`.
- **Chi tiết:** Trong đợt phát hành G2, không có component frontend nào thay đổi logic tiêu thụ streak; logic streak canonical `user_daily_streaks.current_streak` đã được triển khai và kiểm chứng 100% tại backend `ai-tutor` trên Staging.

---

## 8. Hackathon Compatibility

- Các module `src/lib/projectSource.ts`, `src/lib/projects.ts`, `src/lib/hackathons.ts` đã được cập nhật để hỗ trợ canonical provenance `hackathon` song song với `contest` tương thích ngược. Toàn bộ unit tests trong `src/lib/projectSource.test.ts` pass 100%.

---

## 9. Test Fixtures

- Dữ liệu fixture trên Staging database (`opoozbmfbezkrpzxsusx`) được giữ ở trạng thái sạch (0 orphan conversations, 0 orphan sessions, 0 orphan subscriptions).

---

## 10. Regression

- **`pnpm test`**: **PASS (133/133)** (27 test files passed)
- **`pnpm lint`**: **PASS (0 errors)**
- **`pnpm build:staging`**: **PASS** (Vite staging build hoàn tất)
- **`pnpm db:verify`**: **PASS (31/31)**
- **`pnpm db:verify:local`**: **PASS (100%)**
- **`git diff --check`**: **PASS (0 errors)**

---

## 11. Findings

### Finding STG-FE-AUTH-01
- **Mức độ (Severity):** `ACTION REQUIRED`
- **Bằng chứng (Evidence):** Môi trường non-interactive không có sẵn biến môi trường `CLOUDFLARE_API_TOKEN`.
- **Tác động (Impact):** Không thể deploy trực tiếp qua Wrangler CLI nếu không có API token; cần kích hoạt qua luồng Git push lên branch `staging`.
- **Hành động yêu cầu:** User cấp quyền commit & push các thay đổi đã được kiểm duyệt lên branch `staging` hoặc cung cấp `CLOUDFLARE_API_TOKEN` để deploy trực tiếp qua Wrangler.

---

## 12. Main Safety

- Production frontend deploy: **NONE**
- Main DB writes: **NONE**
- Main Edge deploy: **NONE**
