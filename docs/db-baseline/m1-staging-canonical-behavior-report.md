# M1 Staging Canonical Behavior

> Date: 2026-08-23  
> Branch: `staging`  
> Scope: C-06 Project seed-only, C-08 AI quota semantics, C-09 Hackathon vocabulary compatibility.  
> Database writes: none. Main was not written or deployed.

## 1. Verdict

**M1_IMPLEMENTED_NOT_VALIDATED**

The implementation and static/application checks pass. Staging deployment and real integration validation were intentionally not run because the required isolated clean migration recreate is still unavailable: the local Docker daemon is not running, and no passing CI clean-recreate evidence exists for this branch.

## 2. Wave 0 final status

**PARTIAL**

| Gate | Result | Evidence |
| --- | --- | --- |
| Baseline / released migration guard | PASS | `pnpm db:verify` accepted exactly 3 new migrations after the frozen 139-migration baseline. |
| Local clean migration recreate | BLOCKED | `pnpm db:verify:local` failed closed because Docker/local Supabase is unavailable. It did not use `--linked`. |
| CI clean migration recreate | NOT AVAILABLE | No CI result was available in this working tree. |
| Staging target identity | CONFIRMED READ-ONLY | Existing dashboard target is `corelia-staging` / ref `opoozbmfbezkrpzxsusx`; no SQL was applied. |

## 3. C-06 final status

**IMPLEMENTED, NOT APPLIED TO STAGING**

`20260823120000_seed_projects_without_overwrite.sql` keeps both submission triggers on `AFTER INSERT OR UPDATE`, but changes their conflict behavior to seed only when the source-keyed project does not exist. Existing project edits therefore remain independent after a submission changes.

Required real-DB cases remain pending: new seed, project edit then source update, repeated source update, retry/idempotency, provenance and final-assignment path.

## 4. AI quota before/after semantic matrix

| Concept | Before | After | Canonical source |
| --- | --- | --- | --- |
| Successful message quota | Monthly aggregate incremented after provider output, but concepts were mixed in code/config. | A successful provider response records exactly one `successful_message`; `ai_usage_monthly.message_count` is the monthly business counter. | `ai_usage_log` successful row; `ai_usage_daily` and `ai_usage_monthly` are rebuildable aggregates. |
| Request attempt / rolling 3h | Counted persisted user messages in `ai_conversations`; could include provider failure. | Preserved as a separately named rolling attempt soft-cap / anti-abuse control. It is not presented as quota used. | User messages in `ai_conversations` in the rolling window. |
| Token data | Historical configuration could imply token quota behavior. | Input/output tokens and cost remain telemetry/accounting only. | `ai_usage_log` and aggregate token columns. |
| Tier configuration | `tier_limits` plus silent code fallback, with old token/quota-unit branches. | `tier_limits.monthly_messages` and rolling soft-cap fields take precedence. Fallback is bootstrap-only and emits a structured warning with tier/user id. | `tier_limits`; fallback only when no tier row exists. |
| Concurrent/retry usage accounting | Insert plus aggregate read/write path could race. | One `SECURITY DEFINER` RPC records the raw row and atomically upserts daily/monthly aggregates. A partial unique index prevents duplicate usage for the same feature/conversation. | `public.record_ai_successful_usage(...)`. |

## 5. AI quota failure matrix

| Scenario | Successful quota | Attempt / rate limit | Telemetry |
| --- | --- | --- | --- |
| Rejected before provider | +0 | Existing pre-provider protections apply; no successful-usage row. | No usage row. |
| User message persisted, provider fails | +0 | Can count in the rolling attempt soft-cap because the user message exists. | No successful-usage row. |
| Provider succeeds and accounting succeeds | +1 | Existing attempt count remains separate. | One raw usage row plus daily/monthly aggregate increments. |
| Provider succeeds, post-processing fails | +1 if atomic accounting committed before the post-processing failure. This is the chosen point of no return. | Separate. | Provider usage remains traceable. |
| Retry of the same completed conversation | No second increment when the same feature/conversation usage row already exists. | Separate. | Unique successful-usage key prevents a duplicate accounting row. |
| Accounting RPC itself errors | Unknown until real integration testing. Current handler fails the request rather than silently treating provider work as free. | Separate. | Requires Staging fault-injection verification. |

## 6. Hackathon compatibility matrix

| Legacy input/data | Canonical internal / new write | Compatibility behavior | Cleanup condition |
| --- | --- | --- | --- |
| `projects.source_type = 'contest'` | New submission trigger writes `source_type = 'hackathon'`. | Readers and collaboration RPCs accept both values. Existing legacy project blocks duplicate canonical creation for the same submission. | No active legacy reader/writer and data migration decision approved. |
| `Contest` API/type names | New aliases expose `Hackathon` names. | Existing contest names remain unchanged; no breaking rename. | Consumer migration completed. |
| Detailed registration/submission/judging dates | `starts_at` / `ends_at` define the new top-level lifecycle helper. | Existing detailed UI lifecycle remains compatible; its child phases are not deleted or reinterpreted in M1. | Product confirms replacement of legacy detailed UI semantics. |

## 7. Files changed

| Area | Change | Runtime impact |
| --- | --- | --- |
| `supabase/migrations/20260823121000_ai_quota_semantic_normalization.sql` | C-08 additive accounting semantic and atomic RPC. | Requires migration before deploying the updated `ai-tutor` function. |
| `supabase/functions/ai-tutor/*` | Separates successful quota, attempts and token telemetry; calls atomic RPC. | AI quota responses/UI use successful-message terminology. |
| `supabase/migrations/20260823122000_hackathon_canonical_project_compatibility.sql` | C-09 source-type compatibility and canonical new trigger/RPC behavior. | New hackathon submission projects use `hackathon`; legacy projects remain readable. |
| Project/hackathon frontend/lib files | Accept both provenance values and expose canonical aliases/helpers. | Existing contest-linked project links and invites remain functional during compatibility period. |
| Contract/unit tests | Adds C-08/C-09 regression coverage. | CI/local validation only. |

## 8. Migrations added

| Migration | Purpose | Change type | Compatibility / forward fix |
| --- | --- | --- | --- |
| `20260823120000_seed_projects_without_overwrite.sql` | C-06 seed project once, never overwrite user-owned portfolio fields. | Non-destructive function replacement. | Forward fix by a new function migration only; no released history rewrite. |
| `20260823121000_ai_quota_semantic_normalization.sql` | C-08 raw successful-usage marker, uniqueness and atomic aggregate RPC. | Additive column/index/function; normalizes existing tier config to message unit. | Forward migration can change RPC/constraint behavior; no data deletion. |
| `20260823122000_hackathon_canonical_project_compatibility.sql` | C-09 canonical new provenance and dual-read compatibility. | Additive accepted source value plus function/RPC replacement. | Legacy `contest` is retained; a future cleanup requires explicit data/consumer evidence. |

## 9. Tests

| Test / command | Result | Environment | Class |
| --- | --- | --- | --- |
| `pnpm db:verify` | PASS | Repository | STATIC: baseline, drift allowlist and 24 contract/guardrail tests. |
| Focused quota/project/lifecycle Vitest tests | PASS | Repository | STATIC: 7 tests. |
| `pnpm test` | PASS | Repository | STATIC: 25 files / 114 tests. |
| `pnpm lint` | PASS | Repository | STATIC. |
| `pnpm build:staging` | PASS | Repository | Typecheck + staging build. Existing chunk-size warnings remain. |
| `pnpm build:prod` | PASS | Repository | Typecheck + production build. Existing chunk-size warnings remain. |
| `git diff --check` | PASS | Repository | No whitespace errors. |
| `pnpm db:verify:local` | BLOCKED | Local DB | Docker/local Supabase unavailable. |
| Staging C-06/C-08/C-09 integration | NOT RUN | Staging | Deployment gate not satisfied. |

## 10. Staging changes

**None.** No migration, Edge Function, application deployment, manual SQL, test data or RLS change was applied to `corelia-staging`.

## 11. Staging validation evidence

**Not available.** Required validation is pending after a clean recreate gate passes and the canonical deployment workflow applies the three migrations plus the `ai-tutor` function.

## 12. Data impact

- No live data changed.
- C-08 will add a defaulted `usage_kind = 'successful_message'` to existing usage rows and use a new raw-usage uniqueness rule for future successful responses.
- C-09 does not backfill or delete legacy `contest` provenance. A legacy project remains the authoritative existing project for its submission; new canonical project creation is skipped for that legacy link.

## 13. Security / RLS impact

- No RLS policy is changed.
- `record_ai_successful_usage` is `SECURITY DEFINER`, revoked from `PUBLIC`, `anon` and `authenticated`, and granted only to `service_role` for the Edge Function.
- Replaced collaboration RPC definitions explicitly remain non-public and executable by `authenticated` only.

## 14. Observability impact

- Successful AI usage has a named raw semantic (`usage_kind = 'successful_message'`) and a conversation-level idempotency key.
- Fallback tier configuration emits a structured warning containing only tier/user id; prompts and model output are not added to logs.
- Rolling attempts remain traceable through persisted user conversation messages, but are no longer labelled as successful quota in the runtime/UI contract.

## 15. Known limitations

1. No clean full-chain migration recreate has run in local Docker or CI.
2. No Staging integration has confirmed RPC permissions, trigger definitions, RLS behavior or aggregate values.
3. The top-level lifecycle helper is introduced without replacing the existing detailed registration/submission/judging UI lifecycle. That UI replacement needs product confirmation and Staging regression coverage.
4. AI accounting-RPC failure behavior needs a controlled Staging test to verify the user-visible error/retry path after a provider success.

## 16. Deferred findings

- **P3 — Lifecycle UI migration:** Existing detailed phase UI uses child deadlines. M1 adds canonical top-level lifecycle for new code, but does not replace active detailed UI without product confirmation.
- **P3 — AI accounting fault path:** The atomic RPC preserves the no-free-success rule, but the desired presentation/retry behavior after an accounting transport failure must be demonstrated on Staging.
- **P4 — Bundle size warnings:** Existing large chunks remain after both builds; this is outside M1 scope.

## 17. Production readiness

| Contract | READY_FOR_MAIN? | Reason |
| --- | --- | --- |
| C-06 | NO | Requires clean recreate and real Staging seed/no-overwrite/idempotency validation. |
| C-08 | NO | Requires clean recreate, Staging RPC/function deploy and real quota/failure/retry integration evidence. |
| C-09 | NO | Requires Staging trigger/RPC compatibility, legacy-row and lifecycle validation. |

## 18. Next milestone

Do not start a new schema optimization wave yet. First unblock the M1 deployment gate:

1. Start Docker/local Supabase or run the isolated CI clean-recreate job.
2. Once it passes, apply through the canonical Staging workflow only.
3. Execute the C-06, C-08 and C-09 Staging integration matrices above.
4. Update this report with ledger, function/trigger, counter and smoke-test evidence.

Only after M1 can be closed should the next implementation milestone be selected: **M2 — Data Model Canonicalization** or **M2 — Entitlement Lifecycle**, based on the business decision for D-01/D-02.
