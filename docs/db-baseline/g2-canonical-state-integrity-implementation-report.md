# CORELIA DATABASE OPTIMIZATION
# MILESTONE G2 IMPLEMENTATION REPORT
# CANONICAL STATE & DATA INTEGRITY IMPLEMENTATION

## 1. Implementation Metadata

- **Milestone:** G2 — Canonical State & Data Integrity Implementation
- **Implementation Role:** Gemini Primary Implementation Coder
- **Verification Target:** Codex Sol Medium Independent Audit
- **Working Tree Branch:** `staging`
- **Execution Date:** 2026-08-23
- **Implementation Status:** `COMPLETE`
- **Working Tree State:** `CLEAN_DIFF_REVIEW_READY`
- **Test Suite Status:** `ALL_PASSED` (30/30 DB guardrail contract tests, 121/121 vitest unit/integration tests, 0 lint errors, staging build passed, prod build passed, clean git diff format)

---

## 2. Scope & Problem Resolution Summary

Milestone G2 establishes single canonical sources of truth and protects relational integrity across all identified problem domains without breaking backward compatibility or dropping active production tables prematurely:

| Problem Domain | Approved Architectural Decision | Primary Canonical Source | Legacy / Deprecated Element | Mechanism Applied |
| :--- | :--- | :--- | :--- | :--- |
| **G2-A: Streak State** | `user_daily_streaks` is the sole canonical streak source | `user_daily_streaks.current_streak` | `profiles.streak_days` | AI tutor reader updated in `accessGuards.ts`; DB comment added; column retained for schema stability |
| **G2-B: AI Entitlement** | `ai_subscriptions` is the canonical paid entitlement source | `ai_subscriptions` (`status = 'active'`, `expires_at > now()`) | `profiles.tier` fallback | `resolveEffectiveTier` strictly enforces active unexpired subscriptions; eliminates stale profile tier leakage |
| **G2-C: Session Message Count** | `ai_chat_sessions.message_count` is a derived aggregate of persisted history | `ai_conversations` (`status = 'completed'`) | Manual `prevCount + 2` in handler | PostgreSQL trigger `trg_sync_ai_chat_session_message_count` + backfill migration |
| **G2-D: Voucher Archival** | Historical/active redemption evidence must never be destroyed | `ai_voucher_redemptions` + `ai_voucher_batches` | Hard cascade delete | `ON DELETE RESTRICT` foreign keys; soft-delete/archival pattern (`archived_at`); preview rejection |
| **G2-E: Hackathon Metrics** | `metrics_snapshot` is a derived snapshot refreshed on-demand and at coarse lifecycle milestones | Live registrations, submissions, and scores | Expensive per-row DB triggers | Coarse-grained lifecycle refresh (`publishContestResults`, `reviewContestRegistration`) + UI on-demand refresh |
| **G2-F: Model Pricing** | Canonical runtime pricing source is TypeScript application code | `usageAccounting.ts:estimateCostUsd` | `ai_model_pricing` | Classified as `DEPRECATION_CANDIDATE_PENDING_REVIEW`; DB classification comment added |

---

## 3. Task-by-Task Implementation Details

### G2-A: Streak Canonical State Implementation
- **Canonical Source:** `public.user_daily_streaks` (updated atomically via `claim_daily_streak` RPC).
- **Changes in Edge Functions:**
  - In `supabase/functions/ai-tutor/accessGuards.ts:getProfile`, updated query to fetch `user_daily_streaks.current_streak` alongside `profiles` data in parallel.
  - Injected canonical `current_streak` into returned profile's `streak_days` field (defaulting safely to 0 if no row exists or query fails non-fatally).
  - Prompts generated in `promptRuntime.ts` now receive live, accurate streak data without changing existing downstream method signatures.
- **Migration Documentation:**
  - Added SQL comment `COMMENT ON COLUMN public.profiles.streak_days IS 'DEPRECATED: Canonical streak state is in public.user_daily_streaks';`.

### G2-B: AI Entitlement Canonicalization Implementation
- **Canonical Source:** `public.ai_subscriptions` where `status = 'active'` AND `expires_at > now()`.
- **Vulnerability Eliminated:** Stale `profiles.tier` previously allowed expired subscribers to retain paid tier limits indefinitely.
- **Changes in Edge Functions:**
  - In `supabase/functions/ai-tutor/accessGuards.ts:resolveEffectiveTier`, removed fallback `return profileTier ?? "free"`.
  - Strictly returns `data.tier` if active unexpired subscription row exists; otherwise returns `"free"`.
- **Admin Grant Provenance Tracking:**
  - In accordance with C-05 and the work order, fake payment transaction IDs (e.g. `payment_transaction_id = 'admin_grant'`) are strictly avoided.
  - An architectural follow-up is documented in Section 10 below for schema extension to support first-class admin grant provenance.

### G2-C: AI Session Message Count Integrity Implementation
- **Canonical Source:** Persisted completed messages in `public.ai_conversations`.
- **Database Trigger:**
  - Implemented `public.sync_ai_chat_session_message_count()` trigger function on `public.ai_conversations`.
  - Listens `AFTER INSERT OR UPDATE OR DELETE ON public.ai_conversations`.
  - Maintains `ai_chat_sessions.message_count` atomically with $O(1)$ in-place updates:
    - Insert with `status = 'completed'` $\rightarrow$ `+1`
    - Update from `status <> 'completed'` to `status = 'completed'` $\rightarrow$ `+1`
    - Update from `status = 'completed'` to `status <> 'completed'` $\rightarrow$ `-1`
    - Delete with `status = 'completed'` $\rightarrow$ `-1`
    - Also atomically updates `ai_chat_sessions.last_message_at` to message `created_at`.
  - Trigger includes backfill query updating all existing session rows from existing completed conversation counts.
- **Handler Cleanup:**
  - In `supabase/functions/ai-tutor/index.ts`, removed manual read-modify-write `message_count: prevCount + 2` in both streaming and non-streaming branches.
  - Stream errors (marking placeholder `status = 'error'`) now automatically and atomically avoid incrementing `message_count`.

### G2-D: Voucher Archival & Redemption Integrity Implementation
- **Database Migration:**
  - Added `archived_at timestamptz DEFAULT NULL` and `archived_by uuid REFERENCES auth.users(id)` to `public.ai_voucher_batches`.
  - Dropped cascading foreign keys and created `ON DELETE RESTRICT` constraints on:
    - `public.ai_vouchers(batch_id) REFERENCES public.ai_voucher_batches(id) ON DELETE RESTRICT`
    - `public.ai_voucher_redemptions(voucher_id) REFERENCES public.ai_vouchers(id) ON DELETE RESTRICT`
- **Application & API Changes:**
  - In `supabase/functions/corelia-api/payments/vouchers.ts:deleteAiVoucherBatch`:
    - Checks if any redemptions exist in any state (`paid`, `reserved`, `released`).
    - If redemptions exist: Sets `archived_at = now()`, `active = false` on batch, and deactivates codes (`active = false`), returning `{ archived: true, deleted: false }`.
    - If 0 redemptions exist: Deletes codes and batch cleanly, returning `{ archived: false, deleted: true }`.
  - In `supabase/functions/corelia-api/payments/vouchers.ts:previewAiVoucher`:
    - Explicitly rejects vouchers from archived batches (`if (batch.archived_at != null) throw new Error(...)`).
  - In `src/lib/aiVouchers.ts`:
    - Added `archived_at` and `archived_by` to `AiVoucherBatch` interface and `rowToBatch` mapper.
  - In `src/pages/admin/AdminCoraVouchers.tsx`:
    - Added visual badge for archived batches and disabled destructive / toggle actions on archived batches.
  - In `src/locales/vi/admin.json` & `src/locales/en/admin.json`:
    - Added translation keys for `"archived"`.

### G2-E: Hackathon Metrics Refresh Lifecycle Implementation
- **Architecture:** Snapshot model (`hackathons.metrics_snapshot`) updated on-demand and on coarse-grained manager lifecycle events.
- **Changes in Application:**
  - Coarse-grained lifecycle action `publishContestResults` already refreshes `metrics_snapshot`.
  - Added non-fatal background refresh in `src/lib/hackathons.ts:reviewContestRegistration` when registrations are reviewed/approved/rejected.
  - Kept row-level triggers away from high-traffic submission/registration tables.

### G2-F: AI Model Pricing Deprecation Classification Implementation
- **Canonical Runtime Source:** TypeScript function `supabase/functions/ai-tutor/usageAccounting.ts:estimateCostUsd`.
- **Database Table Status:** `public.ai_model_pricing` classified as `DEPRECATION_CANDIDATE_PENDING_REVIEW`.
- **Documentation:**
  - Added architectural comments in `usageAccounting.ts` documenting in-memory evaluation for low-latency Edge Function execution.
  - Added SQL comment `COMMENT ON TABLE public.ai_model_pricing IS 'DEPRECATION_CANDIDATE_PENDING_REVIEW: Runtime pricing canonical source is application code';`.

---

## 4. Complete Diff Inventory

### Migrations
- `supabase/migrations/20260823130000_g2_canonical_state_and_data_integrity.sql`:
  - Adds `archived_at` and `archived_by` to `ai_voucher_batches`.
  - Alters FKs on `ai_vouchers` and `ai_voucher_redemptions` to `ON DELETE RESTRICT`.
  - Creates trigger function `sync_ai_chat_session_message_count` and trigger on `ai_conversations`.
  - Executes deterministic backfill of `ai_chat_sessions.message_count`.
  - Adds architectural classification comments on `profiles.streak_days` and `ai_model_pricing`.

### Edge Functions
- `supabase/functions/ai-tutor/accessGuards.ts`:
  - `getProfile`: Resolves canonical streak from `user_daily_streaks.current_streak`.
  - `resolveEffectiveTier`: Derived strictly from `ai_subscriptions` where `status = 'active'` and `expires_at > now()`; returns `"free"` otherwise.
- `supabase/functions/ai-tutor/index.ts`:
  - Removed manual `message_count: prevCount + 2` and delegated message count / timestamp synchronization to the database trigger.
- `supabase/functions/ai-tutor/usageAccounting.ts`:
  - Documented canonical runtime pricing source in `estimateCostUsd` and exported for unit testing.
- `supabase/functions/corelia-api/payments/vouchers.ts`:
  - `AiVoucherBatchRow`: Added `archived_at` and `archived_by`.
  - `loadVoucherByCode`: Added `archived_at` in join select.
  - `previewAiVoucher`: Added rejection for archived batches.
  - `deleteAiVoucherBatch`: Updated to archive when redemptions exist and only physically delete when zero redemptions.

### Frontend Libraries & Pages
- `src/lib/aiVouchers.ts`:
  - Added `archived_at` and `archived_by` to `AiVoucherBatch` and `rowToBatch`.
- `src/lib/hackathons.ts`:
  - Added non-fatal `refreshContestMetricsSnapshot(contestId)` call upon registration review.
- `src/pages/admin/AdminCoraVouchers.tsx`:
  - Renders `"archived"` badge for archived batches; disables toggle and delete buttons for archived batches.
- `src/locales/vi/admin.json` & `src/locales/en/admin.json`:
  - Added `coraVoucherBatches.archived` translations.

### Tests
- `supabase/functions/ai-tutor/g2Integrity.test.ts`:
  - Unit tests covering G2-A streak resolution & missing streak fallback.
  - Unit tests covering G2-B active subscription grant & expired subscription tier reset to `"free"`.
  - Unit tests covering G2-F model pricing estimation.
- `scripts/db/tests/g2-canonical-integrity.contract.test.mjs`:
  - Node contract tests verifying G2 migration structure, triggers, foreign keys, and access guard contracts.

---

## 5. Migration Governance & Integrity

- **Baseline Freeze Verification:**
  `pnpm run db:baseline:verify` confirms all 68 frozen historical migrations remain untouched (0 byte diff, SHA-256 match).
- **New Migrations Registered:**
  - `20260823120000_seed_projects_without_overwrite.sql` (C-06)
  - `20260823121000_ai_quota_semantic_normalization.sql` (C-08)
  - `20260823122000_hackathon_canonical_project_compatibility.sql` (C-09)
  - `20260823130000_g2_canonical_state_and_data_integrity.sql` (G2-A, G2-C, G2-D, G2-F)
- **Forward-Only, Data-Preserving Invariant:**
  - No `DROP TABLE` or `DROP COLUMN` commands were executed.
  - All existing data in `profiles`, `ai_chat_sessions`, `ai_vouchers`, and `ai_voucher_batches` is fully preserved.

---

## 6. Canonical State Matrix (Before vs After)

| System State | Pre-G2 State (Flawed / Ambiguous) | Post-G2 State (Canonical & Enforced) |
| :--- | :--- | :--- |
| **Learner Streak** | Read from static `profiles.streak_days` (always 0) | Read from `user_daily_streaks.current_streak` (live, accurate) |
| **AI Paid Entitlement** | Fallback to `profiles.tier` allowed expired users to retain paid quota | Derived exclusively from active unexpired `ai_subscriptions` row |
| **AI Session Message Count** | `prevCount + 2` read-modify-write; drifted on stream error | Maintained atomically via database trigger on `ai_conversations` |
| **Voucher Deletion** | Cascade delete destroyed financial and redemption audit history | FK `RESTRICT` + Soft-delete/archival preserves full audit trail |
| **Hackathon Metrics** | Inconsistent updates across lifecycle actions | Coarse-grained lifecycle action refresh + on-demand snapshot |
| **AI Model Pricing** | Ambiguity between `ai_model_pricing` table and TS code | TypeScript application code is canonical; table marked deprecation candidate |

---

## 7. Edge Case & Failure Mode Analysis

1. **User with no daily streak record (`user_daily_streaks` missing):**
   - Handled gracefully in `getProfile` with `Number(streakRow?.current_streak ?? 0)`. Defaults to 0 without throwing.
2. **Expired Subscription with Stale `profiles.tier = 'pro'`:**
   - `resolveEffectiveTier` returns `"free"`, preventing unearned quota consumption.
3. **Multiple Subscriptions in `ai_subscriptions`:**
   - Query orders by `expires_at DESC` and selects latest active unexpired row deterministically.
4. **Stream Failure / Disconnect during AI Generation:**
   - Assistant placeholder is updated with `status = 'error'`. Database trigger only increments `message_count` for `status = 'completed'`. User message is counted (+1), placeholder error is not (+0), keeping session count in exact sync with readable chat history.
5. **Admin attempts physical deletion of voucher batch with redemptions:**
   - Application handler intercepts and safely archives the batch (`archived_at = now()`, `active = false`).
   - If attempted directly via raw SQL, database constraint `ai_vouchers_batch_id_fkey ON DELETE RESTRICT` rejects the statement.
6. **Background Hackathon Metrics Snapshot Refresh Failure:**
   - Registration review handles metrics refresh in non-fatal background (`void refreshContestMetricsSnapshot.catch(...)`), ensuring primary registration approval/rejection never fails if metrics calculation experiences transient issues.

---

## 8. Backward Compatibility Analysis

- **API & RPC Contracts:**
  - `ai-tutor` edge function request/response contracts remain 100% compatible.
  - `corelia-api/payments` endpoints remain 100% compatible.
- **Client Application:**
  - No breaking changes in frontend types or hooks.
  - Legacy columns (`profiles.streak_days`, `profiles.tier`) remain present in schema and types to avoid breaking unmigrated readers.

---

## 9. Security & Authorization Analysis

- **Trigger Function Security:**
  - `public.sync_ai_chat_session_message_count()` is declared `SECURITY DEFINER` with explicit `SET search_path = public, pg_temp` to prevent search path hijacking.
- **Voucher Deletion Authorization:**
  - `deleteAiVoucherBatch` strictly verifies caller role is `admin` or `support_staff` before performing archival or deletion.
- **Entitlement Security:**
  - Eliminating the `profiles.tier` fallback closes a security loophole where expired subscribers could exploit stale profile claims.

---

## 10. Architectural Follow-ups Required

### 1. `ARCHITECT_FOLLOWUP_REQUIRED: AI_ADMIN_GRANT_PROVENANCE`
- **Context:** `public.ai_subscriptions` currently defines `payment_transaction_id text NOT NULL REFERENCES public.payment_transactions(id) ON DELETE RESTRICT`.
- **Constraint:** Decision C-05 strictly forbids creating fake payment transaction IDs (e.g. `'admin_grant'`). Because `payment_transaction_id` is `NOT NULL`, admin grants cannot currently insert clean entitlement rows directly into `ai_subscriptions` without violating schema constraints or C-05.
- **Recommended Schema Extension (Smallest Safe Delta):**
  ```sql
  ALTER TABLE public.ai_subscriptions
    ALTER COLUMN payment_transaction_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS grant_source text NOT NULL DEFAULT 'payment'
      CHECK (grant_source IN ('payment', 'admin_grant', 'promotional', 'partnership')),
    ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS grant_reason text;
  ```

### 2. `PAYMENT_ACCESS_STATE_MACHINE`
- **Status:** Architecture blocker remains pending review. Milestone G2 deliberately excludes redesign of payment/refund/revocation state machines.

---

## 11. Test Execution & Verification Results

### Summary of Test Commands
1. `pnpm db:verify`: **PASS** (30/30 contract tests passed)
2. `pnpm test`: **PASS** (121/121 vitest tests passed across 26 test files)
3. `pnpm lint`: **PASS** (0 errors)
4. `pnpm build:staging`: **PASS** (Production bundle build completed in 33.79s)
5. `pnpm build:prod`: **PASS** (Production bundle build completed in 32.28s)
6. `git diff --check`: **PASS** (0 formatting/whitespace issues)

---

## 12. Files Modified & Created Matrix

| File Path | Action | Scope / Rationale |
| :--- | :--- | :--- |
| `supabase/migrations/20260823130000_g2_canonical_state_and_data_integrity.sql` | **CREATE** | Migration adding voucher archival, FK RESTRICT, message count trigger, backfill, and deprecation comments |
| `supabase/functions/ai-tutor/accessGuards.ts` | **MODIFY** | G2-A streak canonicalization and G2-B AI entitlement canonicalization |
| `supabase/functions/ai-tutor/index.ts` | **MODIFY** | G2-C remove manual message count arithmetic |
| `supabase/functions/ai-tutor/usageAccounting.ts` | **MODIFY** | G2-F model pricing documentation and export |
| `supabase/functions/corelia-api/payments/vouchers.ts` | **MODIFY** | G2-D voucher archival, rejection on archived, FK restrict handling |
| `src/lib/aiVouchers.ts` | **MODIFY** | G2-D voucher batch type and mapper updates with `archived_at` |
| `src/lib/hackathons.ts` | **MODIFY** | G2-E hackathon metrics refresh on registration review |
| `src/pages/admin/AdminCoraVouchers.tsx` | **MODIFY** | G2-D admin UI display of archived batch status |
| `src/locales/vi/admin.json` | **MODIFY** | i18n translation for voucher batch archived state (vi) |
| `src/locales/en/admin.json` | **MODIFY** | i18n translation for voucher batch archived state (en) |
| `supabase/functions/ai-tutor/g2Integrity.test.ts` | **CREATE** | Vitest unit tests for G2-A, G2-B, and G2-F |
| `scripts/db/tests/g2-canonical-integrity.contract.test.mjs` | **CREATE** | Node DB guardrail contract tests for G2 migration and code contracts |
| `docs/db-baseline/g2-canonical-state-integrity-implementation-report.md` | **CREATE** | Milestone G2 Verification Package and implementation report |

---

## 13. Self-Review Checklist & Invariant Verification

- [x] Canonical source for streak identified and wired (`user_daily_streaks.current_streak`).
- [x] Legacy `profiles.streak_days` retained without destructive drop.
- [x] Canonical source for AI entitlement enforced (`ai_subscriptions.status = 'active'` and `expires_at > now()`).
- [x] Stale `profiles.tier` paid fallback eliminated from `resolveEffectiveTier`.
- [x] No fake payment transactions introduced for admin grants.
- [x] `ARCHITECT_FOLLOWUP_REQUIRED: AI_ADMIN_GRANT_PROVENANCE` documented.
- [x] AI session `message_count` converted to database trigger aggregate.
- [x] Manual `prevCount + 2` removed from `ai-tutor/index.ts`.
- [x] AI session backfill included in migration.
- [x] Voucher FK constraints changed to `ON DELETE RESTRICT`.
- [x] Voucher archival pattern implemented in API and admin UI.
- [x] Archived vouchers rejected in checkout preview.
- [x] Hackathon metrics snapshot refreshed at coarse-grained lifecycle actions without row triggers.
- [x] AI model pricing table classified as `DEPRECATION_CANDIDATE_PENDING_REVIEW` with TypeScript as canonical runtime truth.
- [x] All 30 DB guardrail tests passed.
- [x] All 121 unit/integration tests passed.
- [x] Full build verification completed for staging and production.
- [x] All working tree diffs clean and formatted.

---

## 14. Codex Sol Medium Verification Guide

To verify the G2 implementation independently, run the following verification steps:

```bash
# 1. Verify Migration Baseline and DB Guardrails
pnpm db:verify

# 2. Run Full Unit and Integration Test Suite
pnpm test

# 3. Run ESLint
pnpm lint

# 4. Verify TypeScript and Bundling
pnpm build:staging
pnpm build:prod

# 5. Check Git Working Tree Diff
git diff --check
```

---

## 15. Verification Package Sign-off

Milestone G2 Canonical State & Data Integrity Implementation is **COMPLETE**, verified against all local test suites, and ready for independent audit.

`STOPPED_FOR_CODEX_REVIEW`
