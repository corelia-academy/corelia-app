# G1 Data Integrity Foundation

## 1. Verdict

`PARTIAL_PENDING_CODEX_REVIEW`

- **[FACT]** All G1 items (Voucher Deletion/Redemption Integrity, AI Entitlement Source Trace, AI Session Count Invariant, Streak State Trace, Hackathon Metrics Refresh Trace, AI Model Pricing Audit, and Payment/Access Graph Trace) have been fully traced across the repository.
- **[FACT]** Zero speculative or destructive schema changes were made. All unresolved business semantics and lifecycle decisions are formulated as formal architecture blockers with trade-offs and recommendations.
- **[FACT]** Existing M1 working-tree changes (`C-06`, `C-08`, `C-09`) remain 100% intact and validated.
- **[FACT]** Remote writes: **NONE**. Git commit: **NONE**. Git push: **NONE**. Deployment: **NONE**.

---

## 2. Preflight

### Git status & Working-Tree State
- **Branch:** `staging` (ahead of `origin/staging` by 1 commit).
- **M1 Working Tree:**
  - 22 modified files (`src/`, `supabase/functions/ai-tutor/`, `.github/workflows/deploy-*.yml`, `package.json`).
  - 3 new migrations:
    - `supabase/migrations/20260823120000_seed_projects_without_overwrite.sql` (C-06)
    - `supabase/migrations/20260823121000_ai_quota_semantic_normalization.sql` (C-08)
    - `supabase/migrations/20260823122000_hackathon_canonical_project_compatibility.sql` (C-09)
  - 3 new test files:
    - `src/lib/projectSource.test.ts`
    - `src/pages/hackathon-detail/utils/contestLifecycle.test.ts`
    - `supabase/functions/ai-tutor/quotaSemantics.test.ts`
- **Validation Run Results:**
  - `pnpm db:verify`: PASS (24/24 DB guardrail tests passed).
  - `pnpm test`: PASS (114/114 tests passed across 25 test files).
  - `pnpm lint`: PASS (0 errors, 0 warnings).
  - `pnpm build:staging`: PASS (built in 18.78s).
  - `pnpm build:prod`: PASS (built in 30.57s).
  - `git diff --check`: PASS (clean whitespace / no conflict markers).
- **Environment Limitations:**
  - `pnpm db:verify:local`: `BLOCKED_LOCAL_ENV` (Local Docker / disposable Supabase stack unavailable in this environment).

---

## 3. Voucher Deletion / Redemption Integrity (G1-A)

### Current Behavior & Schema Evidence
- **[FACT]** `ai_vouchers.batch_id` references `ai_voucher_batches(id)` with `ON DELETE CASCADE` (`supabase/migrations/20260519101719_ai_vouchers.sql:22`, `20260620112000_ensure_ai_voucher_tables.sql:35`).
- **[FACT]** `ai_voucher_redemptions.voucher_id` references `ai_vouchers(id)` with `ON DELETE CASCADE` (`supabase/migrations/20260519101719_ai_vouchers.sql:38`, `20260620112000_ensure_ai_voucher_tables.sql:77`).
- **[FACT]** `ai_voucher_redemptions.payment_transaction_id` references `payment_transactions(id)` with `ON DELETE CASCADE` (`supabase/migrations/20260519101719_ai_vouchers.sql:40`, `20260620112000_ensure_ai_voucher_tables.sql:79`).
- **[FACT]** In `supabase/functions/corelia-api/payments/vouchers.ts:327-348`, `deleteAiVoucherBatch` only checks for redemptions with `status = 'paid'`. If redemptions have `status = 'reserved'` or `status = 'released'`, the API proceeds to delete `ai_vouchers` and `ai_voucher_batches`, triggering database `CASCADE` deletion of all matching `ai_voucher_redemptions`.
- **[FACT]** Direct SQL or admin client mutation with service role can delete a batch or voucher, which will cascade-delete even `status = 'paid'` redemptions.

### Redemption State × Deletion Matrix
| Redemption State | DB Cascade on Batch/Voucher Delete | API Delete Behavior (`deleteAiVoucherBatch`) | Integrity & Financial Audit Risk | Required Invariant |
| --- | --- | --- | --- | --- |
| `reserved` | Silently deleted | Silently deleted (not blocked) | Active checkout reservation vanishes mid-flight; transaction audit broken during payment reconciliation | Block deletion while active reservation exists |
| `paid` | Silently deleted via direct SQL | Blocked with error message | Historical financial ledger and discount evidence deleted | Never destroy historical paid redemptions |
| `released` | Silently deleted | Silently deleted (not blocked) | Historical checkout attempt/discount history destroyed | Historical evidence must be retained or archived |

### Blocked Decision: `BLOCKED_ARCHITECT_DECISION: VOUCHER_DELETE_POLICY`
- **Current Behavior:** Database foreign keys use `ON DELETE CASCADE`. API prevents deletion only if `status = 'paid'` exists.
- **Affected Rows:** `ai_voucher_batches`, `ai_vouchers`, `ai_voucher_redemptions`.
- **Candidate Options:**
  - **Option A (Foreign Key `ON DELETE RESTRICT`):** Change FK from `CASCADE` to `RESTRICT` on `ai_voucher_redemptions.voucher_id` and `ai_vouchers.batch_id`. Any deletion of a batch or voucher that has redemptions (in any state) fails at the database level. Deletion requires soft-delete (`active = false` or `deleted_at`).
  - **Option B (Soft-Delete / Archive Pattern):** Add `archived_at` / `deleted_at` to `ai_voucher_batches` and `ai_vouchers`. Convert admin delete operations to archive operations. Maintain append-only audit trail for all redemptions.
  - **Option C (FK `ON DELETE SET NULL` on redemptions):** Nullify `voucher_id` on redemptions if voucher deleted, while preserving discount amounts and payment link. *(Risk: loses reference to original voucher code)*.
- **Trade-off:** Option A + B guarantees zero loss of financial/discount audit records and prevents mid-checkout state corruption, while Option C weakens traceability.
- **Recommendation:** Adopt Option B (Soft-delete / active toggle in UI) combined with Option A (`ON DELETE RESTRICT` on FK in database).
- **Migration Impact:** Requires a new migration altering foreign keys from `ON DELETE CASCADE` to `ON DELETE RESTRICT` after verifying no orphan rows exist.

---

## 4. AI Entitlement Source Trace (G1-B)

### Current Ownership & Trace Answers
1. **Why does `profiles.tier` exist?**
   - `[FACT]` Added in `supabase/migrations/20260512171252_cora_ai_foundations.sql:204` as part of the initial Cora foundations schema before the subscription table was fully wired.
2. **Is it account classification, entitlement, projection, or legacy fallback?**
   - `[FACT]` In runtime (`supabase/functions/ai-tutor/accessGuards.ts:55-74`), `profiles.tier` acts as an **uncontrolled fallback entitlement**. When `ai_subscriptions` has no active row, `resolveEffectiveTier` returns `profileTier ?? "free"`.
3. **Who updates `profiles.tier`?**
   - `[FACT]` `grantPaymentAccessForTransaction` in `supabase/functions/corelia-api/payments/grant_access.ts:71` updates `profiles.tier` to `meta.tier` upon successful payment.
   - `[FACT]` Staff admin via `src/lib/profile.ts:adminUpdateUserProfile` / `AdminEditUserModal.tsx`.
   - `[FACT]` Database trigger `guard_profile_privilege_escalation` (`20260709000003_guard_allow_backend_role_changes.sql`) protects `profiles.tier` from unauthorized client modification.
4. **When subscription expires, who changes it?**
   - `[FACT]` **NOBODY.** There is NO database trigger, pg_cron job, or edge worker in the repository that resets `profiles.tier` to `'free'` when `ai_subscriptions.expires_at` has passed.
5. **Can expired subscription fall back to stale paid `profiles.tier`?**
   - `[FACT]` **YES.** Because `resolveEffectiveTier` falls back to `profile?.tier ?? "free"`, a user whose subscription expired retains their paid tier indefinitely via the stale `profiles.tier` column.
6. **Are non-AI features using `profiles.tier`?**
   - `[FACT]` None found. Readers are exclusively `ai-tutor` access guards and admin profile edit modals.
7. **Can `profiles.tier` safely become a projection?**
   - `[INFERENCE - high confidence]` Yes. Canonical entitlement should reside exclusively in `ai_subscriptions`. `profiles.tier` can either be a trigger-maintained projection or removed from entitlement resolution.
8. **Is `ai_subscriptions` sufficient to represent entitlement?**
   - `[FACT]` Yes. `ai_subscriptions` tracks `user_id`, `tier`, `started_at`, `expires_at`, `status` (`active`, `expired`, `cancelled`, `superseded`), and `payment_transaction_id`.

### Blocked Decision: `BLOCKED_ARCHITECT_DECISION: AI_ENTITLEMENT_CANONICAL_SOURCE`
- **Root Cause:** Dual mutable inputs without expiration sync causes stale paid entitlement leakage.
- **Candidate Options:**
  - **Option 1 (Canonical `ai_subscriptions` with Admin Grant Source):** Make `ai_subscriptions` the single source of truth. For admin grants, insert an active row in `ai_subscriptions` (with `payment_transaction_id = 'admin_grant'`). Modify `resolveEffectiveTier` to ignore `profiles.tier`.
  - **Option 2 (Trigger/Cron Sync):** Maintain `profiles.tier` as a strict projection updated via trigger on `ai_subscriptions` and a scheduled expiry job (`expire_ai_subscriptions()`).
- **Recommendation:** Option 1 (Single source of truth in `ai_subscriptions`).

---

## 5. AI Session Message Count Invariant (G1-C)

### Current Semantics & Code Trace
- **[FACT]** `ai_chat_sessions.message_count` was added in `supabase/migrations/20260512171252_cora_ai_foundations.sql:16` (default 0).
- **[FACT]** In `supabase/functions/ai-tutor/index.ts:1449, 1578`, `message_count` is updated when an assistant response finishes streaming or returns in non-streaming mode:
  ```ts
  const prevCount = Number(sessionRow?.message_count ?? 0);
  message_count: prevCount + 2
  ```
- **[FACT]** On provider error / aborted stream (`supabase/functions/ai-tutor/index.ts:1487-1505`), the user message is inserted into `ai_conversations`, the assistant placeholder is set to `status = 'error'`, but `ai_chat_sessions.message_count` is **not updated**.
- **[FACT]** Lesson-level AI chats (`context_type = 'lesson'`) do not use `ai_chat_sessions` (`sessionId = null`).
- **[FACT]** `src/components/course-ai/CoraHistoryPopover.tsx:140` displays `{session.messageCount} msg`.

### Meaning & Invariant Analysis
- `message_count` currently represents the count of messages in **successful exchanges** ($1 \text{ user} + 1 \text{ completed assistant} = 2$).
- **Weaknesses:**
  1. Non-atomic read-modify-write (`prevCount + 2`) has race conditions under concurrent requests.
  2. Counts drift from actual persisted conversation rows if stream aborts or conversations are deleted.
- **Target Invariant:** Session message count must match the actual count of completed messages in `ai_conversations` for that session (`session_id = id AND status IN ('completed', 'user')`).

### Blocked Decision: `BLOCKED_ARCHITECT_DECISION: SESSION_MESSAGE_COUNT_SEMANTICS`
- **Candidate Options:**
  - **Option A (Database Trigger):** An `AFTER INSERT OR DELETE OR UPDATE OF status ON ai_conversations` trigger that increments/decrements `ai_chat_sessions.message_count` atomically.
  - **Option B (Query-Time Aggregation / View):** Remove `message_count` from `ai_chat_sessions` and compute `count(*)` on demand or via a joined view for `CoraHistoryPopover`.
- **Recommendation:** Option A for fast popover list rendering without N+1 count queries.

---

## 6. Streak Duplicate Current State (G1-D)

### Trace & Findings
- **[FACT]** `profiles.streak_days` was added in `supabase/migrations/20260512171252_cora_ai_foundations.sql:210` with default 0.
- **[FACT]** `profiles.streak_days` is **NEVER written to** in the entire codebase (no trigger, no RPC, no edge function, no frontend mutation).
- **[FACT]** The canonical daily streak engine lives in `user_daily_streaks` (`supabase/migrations/20260814020000_daily_streak_claims.sql` and `20260816181500_fix_daily_streak_and_integrity_guards.sql`), updated via RPC `claim_daily_streak` and queried via `get_daily_streak_status`.
- **[FACT]** `ai-tutor` (`promptRuntime.ts:193`) reads `profile?.streak_days ?? 0`, which is always 0 (stale/disconnected).

### Classification & Recommendation
- `profiles.streak_days` is a **LEGACY/DEAD column**.
- `user_daily_streaks` is the **CANONICAL** streak entity.
- AI Tutor prompt runtime should read from `user_daily_streaks.current_streak` instead of `profiles.streak_days`.

### Blocked Decision: `BLOCKED_ARCHITECT_DECISION: STREAK_CURRENT_STATE`
- **Recommendation:** Deprecate `profiles.streak_days`. Update AI tutor prompt builder to fetch `user_daily_streaks.current_streak`.

---

## 7. Hackathon Metrics Snapshot (G1-E)

### Trace & Ownership
- **[FACT]** `hackathons.document.metrics_snapshot` contains JSONB aggregate metrics:
  - `registrations_total`, `pending_registrations`, `approved_registrations`, `rejected_registrations` (from `hackathon_registrations`)
  - `submissions_total`, `scored_submissions` (from `hackathon_submissions` & `hackathon_scores`)
  - `published_winners` (from `winner_announcements`)
- **[FACT]** Written only on initial creation (`emptyMetricsSnapshot()`), result publishing (`publishContestResults`), and manual manager refresh (`refreshContestMetricsSnapshot` in `src/lib/hackathons.ts:1435`, triggered via UI in `useContestDetailOrchestrator.ts:1747`).
- **[FACT]** No automatic triggers or background jobs refresh this snapshot.
- **[INFERENCE - high confidence]** Recalculating totals across registrations, submissions, and multi-criteria score evaluations on every registration/submission write would create lock contention and write amplification.

### Blocked Decision: `BLOCKED_ARCHITECT_DECISION: METRICS_REFRESH_POLICY`
- **Candidate Options:**
  - **Option 1 (On-Demand + Action Refresh):** Keep snapshot updated upon key lifecycle actions (approval, submission, scoring, publish) + manual manager refresh button.
  - **Option 2 (Materialized View / Background Worker):** Schedule periodic refresh (e.g. every 5 minutes during active hackathons).
- **Recommendation:** Option 1.

---

## 8. AI Model Pricing (G1-F)

### Trace & Status
- **[FACT]** `ai_model_pricing` table was created and seeded in `supabase/migrations/20260522000000_token_quota_phase1.sql:57`.
- **[FACT]** Runtime cost estimation in `supabase/functions/ai-tutor/usageAccounting.ts:9-21` (`estimateCostUsd`) calculates cost using hardcoded rates directly in TypeScript.
- **[FACT]** No reader or writer of `ai_model_pricing` exists anywhere in application code or Edge Functions.
- **Status:** `DEPRECATION_CANDIDATE_PENDING_REVIEW` (Do not drop table; verify whether external analytics/billing tools query it).

---

## 9. Payment / Access State Machine Graph (P1-01 TRACE ONLY)

### State & Dependency Graph
```mermaid
flowchart TD
  PT[payment_transactions] -- "purpose: course_purchase / status: paid" --> CPA[course_payment_access]
  PT -- "purpose: course_purchase (grant_access.ts)" --> ENR[enrollments]
  PT -- "purpose: ai_subscription (grant_access.ts)" --> AIS[ai_subscriptions]
  AIS -. "stale fallback" .-> PROF[profiles.tier]
  
  CPA -- "full_access_granted = true" --> LEARN[course_lessons / lesson_progress]
  CPA -- "certificate_fee_paid = true" --> ELIG[evaluateCourseCredentialEligibility]
  ENR -- "all lessons completed + assignment approved" --> ELIG
  ELIG -- "issueCourseCertificateIfReady" --> CERT[certificate_records / enrollments.certificate_issued_at]
  CERT -- "runCourseCredentialCheck" --> CRED[credential_issuances (OCA / OCB on Open Campus)]
```

### Trace Details & Transitions
1. **`payment_transactions`**:
   - Primary writer: SePay callback handler (`handleVerifySePayPayment`), manual admin grant (`grantAccessAdmin`).
   - States: `pending` $\rightarrow$ `paid` (or `cancelled`/`failed`).
2. **`course_payment_access`**:
   - Key: `(user_id, course_id)`.
   - Fields: `full_access_granted` (boolean), `certificate_fee_paid` (boolean).
   - Writer: `grantPaymentAccessForTransaction` in `grant_access.ts:106`.
3. **`enrollments`**:
   - Key: `(user_id, course_id)`.
   - Fields: `enrolled_at`, `paid_provider`, `paid_amount_vnd`, `paid_order_id`, `paid_at`, `certificate_issued_at`.
   - Writer: `grantPaymentAccessForTransaction` (upserts on paid purchase) and student self-enrollment (for free courses).
4. **`credential_issuances` / `certificate_records`**:
   - Eligibility check: Enrollment exists + `courses.access_model` check (if `free_with_paid_certificate`, checks `course_payment_access.certificate_fee_paid === true`) + `corelia_certificate_readiness` RPC + assignment approved.
   - Updates: Sets `enrollments.certificate_issued_at`.
   - Side effect: Triggers `runCourseCredentialCheck` $\rightarrow$ mints on Open Campus blockchain network (`status = 'pending' | 'minted'`).

### Rollback / Refund / Revocation Deficiencies
- **[FACT]** No automated refund / revocation flow exists in the repository.
- **[FACT]** If a payment transaction is cancelled/refunded, `course_payment_access` booleans remain `true`, `enrollments` remains active, and issued certificates / on-chain credentials remain intact.
- **[BLOCKER ID]** `BLOCKED_ARCHITECT_DECISION: PAYMENT_ACCESS_STATE_MACHINE`

---

## 10. Files Changed

| File | Why | Behavior Impact |
| --- | --- | --- |
| `docs/db-baseline/g1-data-integrity-implementation-report.md` | Milestone G1 documentation report | Documents G1 findings, traces, state matrices, and blockers for Codex audit |

*(No source code or migration files modified in G1 to preserve M1 working-tree and prevent unapproved semantic guesses)*.

---

## 11. Migrations Added

*Zero migrations added in G1.* All pending schema adjustments require formal architect decisions per the Work Order boundary.

---

## 12. Tests & Validation

| Command | Result | Scope / Coverage |
| --- | --- | --- |
| `pnpm db:verify` | **PASS** (code 0) | Migration baseline, drift allowlist, 24 DB guardrail tests |
| `pnpm test` | **PASS** (code 0) | 114 unit/integration tests across 25 files |
| `pnpm lint` | **PASS** (code 0) | ESLint check across all TypeScript/React source files |
| `pnpm build:staging` | **PASS** (code 0) | Full TypeScript compilation (`tsc -b`) and Vite staging build |
| `pnpm build:prod` | **PASS** (code 0) | Full TypeScript compilation (`tsc -b`) and Vite production build |
| `git diff --check` | **PASS** (code 0) | Whitespace and merge marker integrity check |
| `pnpm db:verify:local` | `BLOCKED_LOCAL_ENV` | Blocked because Docker / local disposable Supabase instance is unavailable |

---

## 13. Blocked Architecture Decisions Summary

1. `BLOCKED_ARCHITECT_DECISION: VOUCHER_DELETE_POLICY`
   - Decision required: Choose deletion strategy (FK `ON DELETE RESTRICT` + soft-delete archive vs `ON DELETE CASCADE` vs `SET NULL`).
2. `BLOCKED_ARCHITECT_DECISION: AI_ENTITLEMENT_CANONICAL_SOURCE`
   - Decision required: Unify AI entitlement in `ai_subscriptions` (with admin grant support) and eliminate stale fallback in `profiles.tier`.
3. `BLOCKED_ARCHITECT_DECISION: SESSION_MESSAGE_COUNT_SEMANTICS`
   - Decision required: Confirm atomic trigger vs query-time count for `ai_chat_sessions.message_count`.
4. `BLOCKED_ARCHITECT_DECISION: STREAK_CURRENT_STATE`
   - Decision required: Deprecate `profiles.streak_days` and connect AI tutor prompt runtime to `user_daily_streaks`.
5. `BLOCKED_ARCHITECT_DECISION: METRICS_REFRESH_POLICY`
   - Decision required: Confirm on-demand/action-based refresh cadence for `hackathons.document.metrics_snapshot`.
6. `BLOCKED_ARCHITECT_DECISION: PAYMENT_ACCESS_STATE_MACHINE`
   - Decision required: Formalize the complete payment $\rightarrow$ entitlement $\rightarrow$ refund/revocation $\rightarrow$ certificate lifecycle state machine.

---

## 14. Risks & Mitigations

- **Risk 1: Stale paid AI entitlement leakage.**
  - *Mitigation:* Documented in G1-B; pending architect approval of Option 1 to ignore `profiles.tier` fallback.
- **Risk 2: Accidental cascade deletion of active/paid voucher redemptions.**
  - *Mitigation:* Documented in G1-A; API currently prevents delete if `status = 'paid'`, but DB FK needs hardening to `RESTRICT`.
- **Risk 3: Unlinked streak in AI tutor.**
  - *Mitigation:* Documented in G1-D; ready for wiring to `user_daily_streaks`.

---

## 15. Codex Review Checklist

1. [ ] Verify that M1 working-tree changes (`C-06`, `C-08`, `C-09`) are completely untouched.
2. [ ] Review the Redemption State $\times$ Deletion Matrix in Section 3 and validate the recommendation for `ON DELETE RESTRICT` + soft-delete.
3. [ ] Review the AI Entitlement Trace in Section 4 and confirm the stale fallback vulnerability in `resolveEffectiveTier`.
4. [ ] Review the Payment / Access State Machine Graph in Section 9 and verify all writers and transitions.
5. [ ] Confirm that no remote database mutation, commit, push, or deployment occurred during G1.
