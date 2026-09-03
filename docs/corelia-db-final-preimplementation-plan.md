# Corelia DB Refactoring & Optimization — Final Pre-Implementation Plan

> **Superseded for hackathon:** các phần mô tả score, access invite, judging, review registration và metrics snapshot là kế hoạch tại thời điểm 2026-08-23. Chúng không còn là target contract; xem [docs/hackathon](./hackathon/README.md). Dữ liệu legacy này được xóa trực tiếp, không export.

> Date: 2026-08-23  
> Scope: `corelia-app` / Main Production (`lawhkvyyoznwygzsycan`) and `corelia-staging` (`opoozbmfbezkrpzxsusx`).  
> Mode: audit/plan only. No migration, data, code, deployment, push or production write was performed.

## Evidence convention

- `[FACT]` comes from a timestamped live catalog query, repository source, migration or workflow inspected in this pass.
- `[INFERENCE]` is a technical conclusion derived from those facts.
- `[DECISION_NEEDED]` is a product/operations choice that code and catalog cannot settle.
- `RESOLVED`, `DEFERRED_NON_BLOCKING` and `BLOCKED` describe planning state, not implementation state.

## 1. Executive status

**Verdict: READY_WITH_BLOCKERS.**

- `[FACT]` G0 baseline can be frozen now: Main and Staging both record 139 migrations through `20260818120000_clean_legacy_manual_mint_templates`; the current Staging repository chain also has 139 migration files.
- `[FACT]` RLS differences previously counted as 13 definition diffs are semantically equivalent for the examined policies. They are historical/textual drift, not an active permission mismatch.
- `[FACT]` Seven function diffs are only line-ending/text serialization differences. Credential activity is the one behavior difference requiring a forward-only reconciliation.
- `[FACT]` Main-only voucher fields are not currently used by database routines; 10/10 rows duplicate batch `percent_off`, while `starts_at`, `ends_at`, and `max_redemptions` are all NULL.
- `[FACT]` The project/submission source-of-truth decision exposes a real implementation gap: current triggers use `ON CONFLICT DO UPDATE`, which can overwrite a project after it has become an independent portfolio record.
- `[DECISION_NEEDED]` Refund/entitlement semantics still require product decisions. This blocks only the entitlement state switch, not Wave 0 or non-breaking preparation.

## 2. G0 — Frozen baseline

| Surface | Main | Staging | Repository | Status |
|---|---|---|---|---|
| Applied migration count | 139 | 139 | `origin/main`: 131; `origin/staging`: 139 | Freeze with documented historical gap |
| Latest applied version | `20260818120000` | `20260818120000` | Staging has same latest file | Baseline candidate |
| Null migration statements | 2 | 2 | N/A | Historical metadata; record only |
| Tables / PK / FK / unique | 68 / 68 / 104 / 16 | same | migration chain available | Stable |
| Columns / CHECK | 637 / 87 | 633 / 84 | 4 voucher fields/checks absent from chain | Reconciliation/deferred cleanup |
| RLS policy count | 149 | 152 | Staging form is newer textually | Semantic parity resolved |
| Functions / triggers | 118 / 38 | 118 / 38 | migration sources exist | Credential behavior reconciliation required |

### Baseline artifact to commit in Wave 0

Create a versioned `docs/db-baseline/` manifest, not a migration, with:

- repository commit SHA and migration file SHA-256 list;
- Main/Staging migration version/name/statement hash export;
- normalized catalog fingerprints for tables, constraints, policies, functions and triggers;
- an `expected-historical-drift` list; and
- an intentional Staging feature drift list with owner and expiry.

The baseline source for future schema work is the immutable repository migration chain at the approved release commit, not a manually edited live history.

## 3. Migration provenance matrix

| Finding | Classification | Evidence | Forward-only handling |
|---|---|---|---|
| `origin/main` has 131 migrations; Main live has 139 | HISTORICAL_DRIFT | Git tree count versus `supabase_migrations.schema_migrations` | Do not rewrite Main history; record absent Git provenance and use release baseline manifest |
| Staging repo/live both have 139 | SAFE_TO_FREEZE | Git tree and live catalog | Treat approved Staging release commit as reproducible candidate; verify clean recreate in CI |
| 12 same-version migrations have different recorded SQL | HISTORICAL_DRIFT | Prior Main/Staging history hash comparison | Fingerprint and allowlist existing versions; fail on any new mismatch |
| Main-only voucher fields/CHECK | RECONCILIATION_REQUIRED | Main catalog and no canonical migration source | Keep during compatibility; clean up only in later wave |
| RLS/function text drift | EXPECTED_HISTORICAL_DRIFT after this plan | Semantic catalog diff below | Normalize fingerprint for meaning, preserve raw hash for audit |
| Credential trigger behavior drift | ACTIVE_BLOCKER | Live trigger/function definitions differ | New forward migration in Wave 3 |
| Conditional/idempotent voucher migrations | SAFE_WITH_TEST | `20260519101719` and `20260620112000` | Test clean recreate and upgrade path in CI |

## 4. CI and migration guardrail specification

### Existing workflow evidence

- `[FACT]` `.github/workflows/deploy-staging.yml` runs `supabase migration up --linked --include-all` then deploys Edge Functions.
- `[FACT]` `.github/workflows/deploy-prod.yml` runs a historical repair for `20260709000009`, then `supabase migration up --linked --include-all` and Edge Function deployment.

### Required additions, not implemented in this pass

| Check | File/job to add | Failure condition |
|---|---|---|
| Migration immutability | `.github/workflows/db-guardrails.yml` | A migration in approved released baseline is changed, deleted or renamed |
| Version/order uniqueness | same job | Duplicate timestamp/version or non-monotonic migration path |
| Syntax/apply | disposable Supabase/local DB job | Clean recreate or upgrade chain fails |
| Catalog fingerprint | `scripts/db/verify-baseline.*` + CI job | Unexpected table/constraint/RLS/function/trigger difference |
| Live history comparison | protected post-deploy job | Applied Main/Staging version/name/hash differs outside allowlist |
| DB-change declaration | PR template/label check | Schema/RLS/function/trigger change has no new migration or approved exception |
| Emergency SQL reconciliation | issue template + deploy check | Break-glass SQL has no ticket/reconciliation deadline |

### Formal migration rule

`schema change → new migration → Staging apply → catalog/data/security validation → explicit Main approval → Main apply → post-deploy baseline update`.

Applied migrations are immutable. Emergency SQL is exceptional and must be captured with actor, reason, SQL, target, timestamp, issue, reconciliation migration deadline and verification result.

## 5. Intentional Staging drift strategy

An allowlist entry is valid only when it contains `feature`, `object`, `migration/commit`, `owner`, `reason`, `expected Main release`, `expiry/review date`, `expected catalog delta`, and `Staging validation result`.

| Drift class | Handling |
|---|---|
| EXPECTED_DRIFT | Feature deliberately deployed only to Staging; allowlisted until release/expiry |
| EXPECTED_HISTORICAL_DRIFT | Old text/hash difference with equivalent behavior; retained in baseline manifest |
| UNEXPECTED_DRIFT | No allowlist or behavior differs; block deploy or create P1/P2 reconciliation item |

The currently known credential trigger difference is **not** intentional drift; it requires reconciliation. Staging-only performance indexes are deferred and must not be used to justify schema equality.

## 6. G1 blocker status

| Blocker | Final status | Result |
|---|---|---|
| 13 same-name RLS definition diffs | RESOLVED | Semantic behavior is equivalent; no immediate RLS migration |
| Main-only/Staging-only RLS policy shapes | RESOLVED | `profiles`, `lesson_progress`, `dashboard_configs` produce equivalent allowed operations |
| 8 function definition diffs | RESOLVED except credential event | Seven normalize to same body/config; one credential function is behavioral |
| Credential activity trigger | RESOLVED_TARGET | Canonical target is status-minted + idempotent dedupe, without OC-ID gate |
| Main-only `ai_vouchers` fields | RESOLVED_TARGET | `percent_off` is duplicate; other three are empty legacy fields; cleanup deferred |
| Migration provenance gap | SAFE_TO_FREEZE | Historical gap recorded; forward-only baseline/guardrail required |
| External legacy consumer | DEFERRED_NON_BLOCKING | Blocks destructive cleanup only; no evidence in repo/database routine dependencies |

## 7. RLS reconciliation matrix

| Policy/domain | Main | Staging/repo | Semantic difference | Canonical target | Type | Risk |
|---|---|---|---|---|---|---|
| `course_payment_access_select_own` | `auth.uid()` + `private` helper | scalar `auth.uid()` + `public` wrapper | Equivalent row scope; wrapper delegates to private helper | NO_CHANGE; baseline as semantic equivalent | NO_CHANGE | Low |
| `courses_delete_manager` | direct auth/private | scalar auth/public wrapper | Equivalent instructor/admin delete | NO_CHANGE | NO_CHANGE | Low |
| `courses_insert_manager` | direct auth/private | scalar auth/public wrapper | Equivalent insert check | NO_CHANGE | NO_CHANGE | Low |
| `courses_select_public` | direct auth/private | scalar auth/public wrapper | Equivalent published/instructor/staff scope | NO_CHANGE | NO_CHANGE | Low |
| `enrollments_insert_self` | direct `auth.uid()` | scalar subselect | Equivalent self-insert | NO_CHANGE | NO_CHANGE | Low |
| `enrollments_select_own_or_course_staff` | private helper | public wrapper | Equivalent own/staff read | NO_CHANGE | NO_CHANGE | Low |
| `enrollments_update_own_or_staff` | no explicit check text | explicit same check | PostgreSQL falls back to `USING`; resulting rule equivalent | NO_CHANGE | NO_CHANGE | Low |
| `fas_insert_own` | direct `auth.uid()` | scalar subselect | Equivalent self-insert | NO_CHANGE | NO_CHANGE | Low |
| `lesson_progress_select_own_or_staff` | private helper | public wrapper | Equivalent own/staff/instructor read | NO_CHANGE | NO_CHANGE | Low |
| `payment_transactions_select_own` | private helper | public wrapper | Equivalent own/staff read | NO_CHANGE | NO_CHANGE | Low |
| `profiles_insert_self` | direct `auth.uid()` | scalar subselect | Equivalent self-insert | NO_CHANGE | NO_CHANGE | Low |
| `profiles_select_self_or_staff` | private helper | public wrapper | Equivalent self/staff read | NO_CHANGE | NO_CHANGE | Low |
| `dashboard_configs` | one `ALL TO public` staff policy | three `authenticated` insert/update/delete policies | Anonymous fails helper in Main; allowed staff behavior same | NO_CHANGE now; simplify only with actor tests | DEFERRED | Medium |
| `lesson_progress` writes | one `ALL` own-write policy | split insert/update/delete own policies | Equivalent own CRUD; select policy adds staff read | NO_CHANGE now | DEFERRED | Medium |
| `profiles` update | self + staff policies | one self-or-staff policy | Permissive policy union is equivalent | NO_CHANGE now | DEFERRED | Medium |

`[FACT]` Live dependency inspection proves Main policies bind to `private.is_admin_or_support()`, while Staging policies bind to `public.is_admin_or_support()`. Both environments define the same public wrapper, which calls the same `SECURITY DEFINER private` helper. This is a semantic equivalence, not an active privilege regression.

## 8. Function reconciliation matrix

| Function | Main | Staging/repo | Caller/runtime contract | Canonical target | Status |
|---|---|---|---|---|---|
| `private.emit_activity_on_credential_issuance()` | OC-ID gate + dedupe | minted-status only, no dedupe | Mint code can persist `minted` with unresolved OC ID | New reconciled body | FUNCTION/TRIGGER change |
| `private.guard_enrollment_completion_mutation()` | Same logic; CRLF serialization | Same logic | Server-managed `completed_at` | No change | RESOLVED |
| `private.validate_lesson_progress_reference()` | Same logic; CRLF serialization | Same logic | Reject lesson/course mismatch | No change | RESOLVED |
| `public.claim_daily_streak()` | Same logic; CRLF serialization | Same logic | Edge gamification RPC | No change | RESOLVED |
| `public.corelia_certificate_readiness()` | Same logic; CRLF serialization | Same logic | Course completion/certificate flow | No change | RESOLVED |
| `public.get_daily_streak_status()` | Same logic; CRLF serialization | Same logic | Edge gamification RPC | No change | RESOLVED |
| `public.get_learning_reminder_candidates()` | Same logic; CRLF serialization | Same logic | Reminder cron | No change | RESOLVED |
| `public.sync_account_connection_points()` | Same logic; CRLF serialization | Same logic | Daily streak RPC | No change | RESOLVED |

All listed functions use stable `SECURITY DEFINER` configuration and explicit search paths. Raw definition hashes should preserve formatting history for audit; CI semantic fingerprints should normalize line endings before declaring runtime drift.

## 9. Credential activity trigger decision

### Final recommendation: candidate C

**Rule:** emit `user.earned_credential` when an issuance reaches `status = 'minted'`; dedupe by `(actor_id, verb, object_type, object_id)`; do **not** require a non-empty `oc_credential_id`.

| Candidate | Positive | Negative / failure mode | Decision |
|---|---|---|---|
| A: minted status only | Compatible with current Staging/repo and unresolved legacy IDs | Retry/backfill may create duplicate activity | Reject as incomplete |
| B: minted + OC-ID + dedupe | Strong OC proof and idempotency | Suppresses activity for a successfully minted record whose ID parse/backfill fails | Reject |
| C: minted + dedupe | Preserves business fact, supports retries/backfill, no duplicate event | Activity payload may have null OC ID until repair | **Canonical target** |

`[FACT]` `credentials/mint.ts` can set `status = 'minted'` with `oc_credential_id = null` when a provider response is successful but ID extraction is unresolved. The migration history also explicitly reverted the OC-ID guard for compatibility.

**Migration implication:** replace trigger/function forward-only; trigger watches `INSERT OR UPDATE OF status, oc_credential_id`; function gates on minted status and dedupe. Updating a repaired OC ID may re-fire the trigger but dedupe prevents a second activity event.

## 10. AI voucher column decision

| Main-only column | Live data (10 rows) | Batch comparison / dependency | Classification | Action |
|---|---|---|---|---|
| `percent_off` | 10 non-null | Every non-null equals its batch value; no DB routine dependency | LEGACY_DUPLICATE | Freeze writes; remove only Wave 6 |
| `starts_at` | 0 non-null | All values null; batch comparison has no mismatch | LEGACY_EMPTY | No backfill; remove only Wave 6 |
| `ends_at` | 0 non-null | All values null; batch comparison has no mismatch | LEGACY_EMPTY | No backfill; remove only Wave 6 |
| `max_redemptions` | 0 non-null | Batch has no equivalent column; no DB routine dependency | LEGACY_EMPTY | No backfill; remove only Wave 6 |

`[FACT]` Main has no non-internal trigger, view/materialized-view, or function/RPC body dependency referencing `ai_vouchers`. Repository readers/writers use `ai_voucher_batches` for discount/window configuration and `ai_vouchers` for code/active/batch reference.

**Constraint decision:** retain current Main-only checks until the cleanup migration. Do not add them to Staging; they guard fields classified legacy/empty and would create false parity work.

## 11. Remaining DECISION_NEEDED

| ID | Decision | Missing evidence | Where to get it | Blocks |
|---|---|---|---|---|
| D-01 | Refund outcome by product: does a refund revoke course, certificate eligibility, AI term, or only future renewal? | Product policy, provider/refund flow | Lead/product decision + refund handler review | Entitlement state switch (Wave 2+) |
| D-02 | Admin grant expiry/revoke policy and reason taxonomy | Operations policy | Lead/admin workflow decision | Admin-grant UI/endpoint, not entitlement table preparation |
| D-03 | External consumer of legacy voucher fields or old project/content shapes | Consumer inventory | API keys, direct DB credentials, integration owner confirmation | Only destructive cleanup |

## 12. Remaining BLOCKED

| Blocker | Status | Exact next evidence/action | Impact |
|---|---|---|---|
| Refund/access transition policy | BLOCKED | Resolve D-01 before changing entitlement revoke behavior | Blocks only Wave 2 entitlement switch and refund migration |
| Admin grant lifecycle | BLOCKED_PARTIAL | Resolve D-02 before exposing admin grant/revoke endpoint | Does not block source table/additive preparation |
| External legacy consumer | DEFERRED_NON_BLOCKING | Inventory integrations before Wave 6 removal | Does not block Waves 0–5 |

## 13. Source-of-truth implementation matrix

| Case | Canonical target | Current evidence | Readiness | Primary change |
|---|---|---|---|---|
| 1. Course content | Locale tables = translated content; base `data` = metadata/fallback | Readers merge locale over `data`; writers still update both stores separately | IMPLEMENTATION_READY | Switch locale-aware reader/writer contract, backfill, then stop duplicate writes |
| 2. Payment/enrollment | `payment_transactions` = financial fact; `enrollments` = learning relation | Payment handler writes `paid_*` snapshot to enrollment; UI reads it for instructor display | IMPLEMENTATION_READY | Keep snapshot temporarily; change payment/history reader to transaction truth |
| 3. Project/submission | Submission truth at creation; project owns portfolio after seed | Sync trigger `ON CONFLICT DO UPDATE` overwrites project | IMPLEMENTATION_READY | Change trigger to seed-only/idempotent creation |
| 4. Refund/access | Product + entitlement state, not global revoke | Current access is boolean projection; refund contract missing | BLOCKED | Decide D-01 then add entitlement transitions |
| 5. Admin grant | Separate entitlement source; no fake payment | Current course access has no source/actor/reason model | READY_FOR_SCHEMA_PREP | Add source ledger/entitlement model; endpoint waits D-02 |
| 6. AI quota | Successful message quota; attempts are rate limit; tokens telemetry | Conversation attempt and successful `upsertUsage` are already separate | IMPLEMENTATION_READY | Name/measure boundaries and test partial/failed paths |
| 7. Hackathon vocabulary | `hackathon` canonical; `contest` compatibility only | DB uses `hackathon_*`; TypeScript/UI still expose `Contest*`/`contest_id` | IMPLEMENTATION_READY | Compatibility aliases, then staged public type/label migration |

## 14. Case 1 — Course content implementation plan

### Current state

- `[FACT]` `src/lib/courses.ts` builds course/section/lesson objects from `*.data`.
- `[FACT]` Locale readers load `course_locales`, `course_section_locales`, `course_lesson_locales` and overlay localized values as fallback-aware fields.
- `[FACT]` Locale upsert writers already exist, while `createCourse`, `updateCourse`, `updateSection`, and `updateLesson` still write content fields into base `data`.

### Canonical field split

| Base metadata/fallback (`*.data`) | Locale content truth |
|---|---|
| identity, ordering, access/pricing, i18n config, instructor/co-instructor config, non-translatable operational metadata | course `title`, `description`, `short_description`, `learning_outcomes`, final-assignment text; section `title`/`description`; lesson title/description/resources/video presentation fields |

### Plan

1. Define a typed content-field map shared by reader and editor.
2. Make locale upsert the only writer for translated fields; preserve base fields only as explicit primary-locale fallback during compatibility.
3. Backfill missing primary-locale rows from base `data`; record conflict where locale and base disagree instead of overwriting silently.
4. Change public reader to select locale first and use base only under declared fallback rules.
5. Stop content-field writes to base `data`; keep metadata writes unchanged.
6. Observe read fallback and editor save failures before any base-key cleanup.

**Tests:** per-locale read/write, missing locale fallback, empty/malformed localized video URL, concurrent editor update, cache invalidation, old row without locale, and course/section/lesson content parity.

## 15. Case 2 — Payment / enrollment implementation plan

### Current state

- `[FACT]` `payment_transactions` is created as `pending`, then updated to paid/failed/cancelled by payment handlers.
- `[FACT]` `course_payment_access` is the current boolean access projection (`full_access_granted`, `certificate_fee_paid`).
- `[FACT]` `grantPaymentAccessForTransaction` writes `paid_provider`, `paid_amount_vnd`, `paid_order_id`, `paid_at` into `enrollments` for a course purchase.
- `[FACT]` the only application reader found for these `enrollments.paid_*` fields is instructor-facing display; payment/access paths use `course_payment_access` and payment handlers.

### Classification

| Object | Classification | Rule |
|---|---|---|
| `payment_transactions` | CANONICAL_PAYMENT_FACT | Immutable provider/order/status/audit truth |
| `enrollments` | LEARNING_RELATION | Enrollment/completion/accessed time only; never payment authority |
| `enrollments.paid_*` | COMPATIBILITY_SNAPSHOT | Display only until reader switches; not used for authorization/refund/reporting truth |
| `course_payment_access` | COMPATIBILITY_ENTITLEMENT_PROJECTION | Existing runtime access read; source insufficient for grants/refunds |

### Plan

1. Add a transaction-backed payment history query/view/service for instructor display; preserve `paid_*` snapshot during compatibility.
2. Add an explicit entitlement/source model in Case 5 before altering access semantics.
3. Keep `course_payment_access` as compatibility projection until all learner/certificate/payment-return readers use the entitlement resolver.
4. Stop `paid_*` writes only after the instructor display switches and data parity check passes.
5. Do not change payment history or refund behavior until D-01 is approved.

**Tests:** payment pending→paid, duplicate callback, failed/cancelled callback, free checkout, course purchase, certificate fee, instructor history, certificate eligibility, and legacy enrollment snapshot display.

## 16. Case 3 — Project / submission implementation plan

### Current state

- `[FACT]` `projects` has unique `(owner_id, source_type, source_submission_id)`.
- `[FACT]` `private.sync_project_from_contest_submission()` and `private.sync_project_from_final_assignment_submission()` run after insert **or update** and use `ON CONFLICT ... DO UPDATE` for title/summary/URLs/source.
- `[FACT]` later migration keeps the hackathon submission sync trigger on `AFTER INSERT OR UPDATE`.

### Canonical target

Create one project seed from a submission. Once that project exists, project fields are portfolio truth and a submission update must not overwrite them.

### Plan

1. Replace both sync functions with seed-only inserts using the existing unique source key and `ON CONFLICT DO NOTHING`.
2. Keep `AFTER INSERT OR UPDATE` initially for recovery of historical submissions whose project was deleted; conflict behavior prevents overwrite. If this recovery behavior is unwanted, narrow trigger to `AFTER INSERT` after data review.
3. Add an explicit source-link/read-only label in UI so authors understand the project originated from a submission without treating it as a mirror.
4. Preflight duplicate/missing project mappings; create missing seed project only with reviewed source data.

**Idempotency:** unique source key plus `DO NOTHING`.  
**Rollback:** restore previous function only if no portfolio edits occurred after cutover; otherwise forward repair is safer.

## 17. Case 4 — Refund / access implementation plan

### Proposed state model, pending D-01

| Entity | Candidate state/transition | Actor | Transaction boundary |
|---|---|---|---|
| Payment | `pending → paid | failed | cancelled | refund_requested → refunded` | provider/server/admin | provider event + payment fact update |
| Course entitlement | `active → revoked | expired` | payment/admin/refund resolver | entitlement change with source event |
| AI subscription | `active → superseded | expired | cancelled` | payment/server | payment success + subscription update |
| Certificate eligibility | derived from course completion + entitlement | server/RPC | do not mutate solely from refund until D-01 |

**Rule already fixed:** no global “refund always revoke” rule.  
**Blocked change:** mapping product/purpose to entitlement effect, effective time, grace period, retry and restoration policy.

## 18. Case 5 — Admin grant access implementation plan

### Gap

`course_payment_access` has two booleans and timestamp only. It cannot prove **who** granted access, **why**, whether it came from payment/admin/promotion, or which source may later be revoked without affecting another source.

### Canonical additive model

Create a source-aware `course_access_entitlements` table (name subject to implementation review):

| Field group | Purpose |
|---|---|
| `user_id`, `course_id`, `capability` | What access is granted |
| `source_type` | `payment`, `admin_grant`, `promotion_voucher`, `system` only; extensible by reviewed migration |
| `source_id` / payment FK | Trace source without fake payment |
| `status`, `starts_at`, `expires_at`, `revoked_at` | Lifecycle |
| `granted_by`, `reason`, `metadata` | Auditability for manual/system grants |
| idempotency key | Retry-safe grant creation |

Keep `course_payment_access` as a compatibility projection in early waves. The new resolver returns effective access if at least one valid entitlement permits it. D-02 controls grant expiry/revoke policy and endpoint/UI behavior.

## 19. Case 6 — AI quota implementation plan

| Table/object | Canonical role | Current evidence | Change |
|---|---|---|---|
| `ai_conversations` | CONVERSATION + attempt input | User row is created before provider call | Keep; label it request attempt, not successful quota |
| `ai_usage_log` | RAW successful usage + token telemetry | Written by `upsertUsage()` on successful path | Keep as successful usage fact |
| `ai_usage_daily` | AGGREGATE | Updated from usage accounting | Rebuildability/reconciliation test |
| `ai_usage_monthly` | AGGREGATE quota projection | Increments only after successful accounting | Use for successful message quota |
| `tier_limits` | CONFIG | Defines limits | Separate quota and rate-limit labels |

`[FACT]` failed request creates a user conversation and affects the rolling 3-hour attempt count, but does not invoke `upsertUsage()` and does not increment monthly successful usage.

### Plan

1. Rename/document internal concepts as `SUCCESSFUL_MESSAGE_QUOTA`, `REQUEST_ATTEMPT_RATE_LIMIT`, and `TOKEN_TELEMETRY`.
2. Ensure UI/error messages do not call the rolling attempt window “monthly quota”.
3. Add tests for provider failure, partial stream, retry and concurrent requests to prove successful accounting is exactly once.
4. Add a reconciliation query from `ai_usage_log` to daily/monthly aggregates; no schema change is required unless measured audit shows aggregate mismatch.

## 20. Case 7 — Hackathon vocabulary implementation plan

- `[FACT]` physical tables use `hackathons`, `hackathon_submissions`, `hackathon_registrations`, `hackathon_scores`, `hackathon_access_invites` and `hackathon_id`.
- `[FACT]` TypeScript/UI still exports `Contest*`, uses `contestId` and maps `hackathon_id` into `contest_id` compatibility fields.
- `[FACT]` project source uses `source_type = 'contest'` while UI label already renders hackathon.

### Compatibility plan

1. Introduce canonical TypeScript aliases and new public names: `Hackathon`, `hackathonId`, `HackathonSubmission`.
2. Keep `Contest*` aliases and route/i18n compatibility during a declared period.
3. Add a non-destructive source-type compatibility resolver accepting legacy `contest`; write only `hackathon` only after source-type migration is approved.
4. Migrate UI/API names in modules, tests and Edge Functions gradually; no table rename in the first implementation waves.

## 21. Business invariant candidates

| Invariant | Evidence/current enforcement | Proposed enforcement | Preflight / risk |
|---|---|---|---|
| Progress lesson belongs to course | Trigger `validate_lesson_progress_reference()` exists | Keep trigger or replace with composite FK only after full preflight | Check violations; possible lock |
| One logical progress row per user/course/lesson | Existing unique/key must be catalog-verified per baseline | Retain/add unique only if live data clean | Duplicate count, writer idempotency |
| Voucher paid scope is global per voucher | Runtime counts paid/redemptions by `voucher_id`; repo migration uses partial unique by voucher | Canonical partial unique `voucher_id WHERE status='paid'` | Verify Main index and historic paid duplicates |
| Project has one seed per source submission | Existing unique source key | Keep; seed-only trigger | Missing/multiple mapping report |
| Credential activity is idempotent | Main function has manual dedupe; Staging lacks it | Add event dedupe in canonical trigger function | Existing duplicate event count |
| Daily claim/points/milestones idempotent | Advisory lock and `ON CONFLICT` in streak function | Keep; test concurrency | Race test |
| Payment fact is not mutated by enrollment | Current handler duplicates snapshots | Separate reader authority; later entitlement source model | Snapshot parity before stop write |

No new hard constraint is approved without live violation count, repair direction, lock estimate and Staging migration rehearsal.

## 22. Write-boundary matrix

| Domain | Client write | Staff write | Server/function write | Trigger/DB write | Ambiguity to remove |
|---|---|---|---|---|---|
| Profile | own profile fields | support/admin scoped | profile setup | timestamps/projection | field-level staff boundary |
| Payment | none | reconciliation only | payment handler/webhook | none | payment fact versus access projection |
| Course access | none direct for paid | future grant endpoint | payment handler | entitlement projection later | source/revoke/audit absent |
| Voucher | admin config/code flow | admin | payment voucher handlers | partial unique | Main legacy fields must not be written |
| Progress | own progress under RLS | staff review only | completion RPC | relation validation trigger | client cannot set server completion fields |
| Credential | none direct | manual grant through server | mint/retry handlers | display/activity triggers | emitted activity condition |
| AI quota | user conversation request | none | tutor accounting | aggregate update path | attempt vs successful quota naming |
| Project/submission | owner submission/project | admin moderation | optional server tools | seed sync trigger | mirror must not overwrite portfolio |

## 23. Transaction risk matrix

| Flow | Current boundary | Partial-success risk | Required change/test |
|---|---|---|---|
| Payment → access → enrollment | Multiple Edge Function writes | Paid transaction can exist before access/enrollment update | Idempotent reconcile by transaction ID; test duplicate webhook |
| Refund → entitlement | Not specified | Incorrect revoke/retain outcome | Blocked by D-01 |
| Voucher redemption → payment | Reservation/payment/release writes | Concurrent paid redemption or stranded reservation | Test global paid uniqueness and release retry |
| Admin grant → access | No canonical source model | Untraceable or fake payment | Add source-aware entitlement; D-02 for lifecycle |
| Credential mint → activity/notification | Mint handler and DB trigger | Mint succeeds but ID parse/activity differs | Candidate C trigger + dedupe/retry test |
| AI request → quota aggregate | Conversation then provider then accounting | Failed/partial request affects attempt but not successful quota | Explicit outcome tests and aggregate reconciliation |
| Submission → project | Trigger after write | Submission update overwrites project portfolio | Seed-only trigger |

## 24. Observability gaps directly related to implementation

| Flow | Existing evidence | Gap | Required addition |
|---|---|---|---|
| Payment/access | payment ID and provider payload exist | No normalized entitlement source/transition event | source ID, actor, before/after, idempotency record |
| Refund | payment record exists | product effect not modeled | refund event + entitlement transition after D-01 |
| Voucher | redemption/payment relation exists | need explicit concurrent/retry audit | reservation/payment/release correlation |
| Admin grant | no source model found | who/why/expiry unavailable | grant actor/reason/source event |
| Credential | issuance and activity event exist | Main/Staging activity rule differs | event dedupe and ID-repair trace |
| AI quota | conversation/usage tables exist | outcome semantics hidden | request outcome + bucket labels/reconciliation |
| Project seed | source fields exist | overwrite behavior invisible | seed vs portfolio change audit/test |

## 25. Required migrations

| Logical migration | Wave | Goal | Dependency | Data preflight | Risk |
|---|---:|---|---|---|---|
| `reconcile_credential_activity_event` | 3 | Candidate C function/trigger | Event duplicate query | minted rows/event counts | Medium: duplicate/missing timeline event |
| `seed_projects_without_overwrite` | 1 | Replace submission sync upsert behavior | Existing unique source key | missing/duplicate source-project mappings | Medium: seed/recovery behavior |
| `add_course_access_entitlements` | 1 | Add source-aware entitlement ledger/table | D-02 only for endpoint policy | Existing paid access/payment mapping | Medium: new access model, additive |
| `backfill_course_access_entitlements` | 4 | Build entitlement rows from paid access/payment | D-01 for revoke semantics only | transaction/access consistency | Medium/high: incorrect effective access |
| `course_content_locale_backfill` | 4 | Populate primary locale truth from base data | content field map | locale/base conflict report | Medium: locale content overwrite |
| `switch_course_access_projection` | 2/4 | Resolve access from entitlements; retain compatibility projection | entitlement backfill/tests | effective access comparison | High: user access regression |

**Deferred migrations:** voucher field/check removal, `enrollments.paid_*` removal, `contest` source-type rename, policy consolidation, unused-index work and legacy cleanup. They are not part of initial implementation.

## 26. Required code changes

| Code area | Required change | Wave |
|---|---|---:|
| `src/lib/courses.ts` and course editor flows | typed locale/base content map; locale-first reader/writer; fallback contract | 1–2 |
| Course content tests | old-base/missing-locale/locale conflict compatibility tests | 1–4 |
| `payments/grant_access.ts`, payment handlers and payment readers | isolate transaction fact, entitlement projection and legacy snapshot writes | 1–4 |
| Instructor enrollment display | read transaction history rather than authoritative `paid_*` fields | 2 |
| Learn/course access hooks | resolve effective entitlement after projection parity | 2–4 |
| Project sync functions/consumer UI | seed-only source behavior and source-link display | 1 |
| Credential mint/activity flow | Candidate C event/dedupe behavior; retry tests | 3 |
| `ai-tutor/accessGuards.ts`, `usageAccounting.ts`, `index.ts` | explicit quota/rate-limit terminology and outcome tests | 1–2 |
| `src/lib/hackathons.ts`, types, UI/routing | canonical Hackathon aliases with `Contest*` compatibility | 1–2 |
| Generated database types | refresh only after released schema change | 4–5 |

## 27. Required RLS changes

**No immediate RLS migration is required to reconcile the 13 identified policy diffs.** Their current Main/Staging behavior is equivalent.

RLS changes are required only when `course_access_entitlements` is introduced:

- learner can read own effective entitlement, not arbitrary grants;
- no direct client insert/update/delete of payment/admin source fields;
- privileged grant/revoke occurs through server/RPC after D-02;
- staff/admin visibility is explicit and actor-tested;
- service/cron grants are explicitly scoped.

Policy consolidation for `profiles`, `lesson_progress` and `dashboard_configs` is deferred. It has maintainability value but no correctness reason to bundle it with source-of-truth work.

## 28. Required function and trigger changes

| Object | Change | Wave | Validation |
|---|---|---:|---|
| `private.emit_activity_on_credential_issuance` | Candidate C: minted status + event dedupe, no OC-ID gate | 3 | minted/no-ID, ID repair, retry, duplicate update |
| `trg_activity_credential_issuance` | Fire on insert/status/OC-ID update; only status minted; function dedupe decides event | 3 | catalog trigger definition + event count |
| Project submission sync functions | `ON CONFLICT DO NOTHING`; no overwrite after seed | 1 | update submission then assert project unchanged |
| Project sync triggers | Keep initial update firing for recovery only; review later narrowing to INSERT | 1 | missing-project recovery and idempotency |
| Entitlement resolver/RPC | Add only with source table; no client trusted write | 2 | actor + effective-access matrix |

## 29. Required backfills

| Backfill | Preconditions | Batch/recovery rule | Validation |
|---|---|---|---|
| Primary locale content | Field map; conflict inventory | Insert missing locale row only; never overwrite non-empty locale silently | sampled UI/content diff + counts |
| Course entitlements from payment/access | D-01 decision, transaction/access mapping | idempotency key per source; dry-run report first | effective access equals old projection |
| Missing project seeds | Confirm existing source key data | insert only missing project; no project field overwrite | source-project one-to-one report |
| Credential event repair | Candidate C deployed | only rows minted without event, dedupe key protects repeat | event count and user timeline sample |
| Voucher legacy fields | **No backfill** | fields are duplicate/empty | re-run null/equality distribution before cleanup |

## 30. Compatibility strategy

1. **Expand:** add entitlement table and compatibility readers without changing current access booleans.
2. **Dual-read/compare:** calculate effective access from both old projection and new entitlement; emit diagnostic mismatch only.
3. **Switch:** use entitlement resolver only after zero accepted mismatch and actor/business tests pass.
4. **Stop legacy writes:** cease `paid_*` snapshot write and base content duplicate write only after all readers move.
5. **Observe:** retain legacy objects for at least one release/monitoring period.
6. **Contract:** cleanup only in Wave 6, with external-consumer confirmation.

## 31. Required tests

| Test group | Required cases |
|---|---|
| Migration/recreate | clean DB from repository chain; upgrade fixture; expected catalog fingerprint |
| RLS | anonymous, owner, other user, instructor, staff/support, admin, service/cron for affected tables |
| Credential | minted with ID, minted without ID, ID repair, duplicate update, retry, existing activity |
| Voucher | code/batch config, single global paid redemption, reservation release, legacy field unaffected |
| Course content | VI/EN read, missing-locale fallback, editor writes, conflict/backfill, cache invalidation |
| Payment/access | pending/paid/failed/cancelled, duplicate webhook, free checkout, certificate fee, existing enrollment snapshot |
| Entitlement | payment/admin/promotion source, overlapping grants, expiry, D-01 refund scenarios after decision |
| Project | insert seeds once, later submission edit does not change project, missing project recovery |
| AI quota | success, provider failure, partial stream, retry, concurrent request, raw-to-aggregate reconcile |
| Hackathon | legacy `Contest*` consumer and new `Hackathon*` alias produce same DB request |

## 32. Dependency graph

```text
W0 baseline + CI rule
        |
        +--> W1 project seed fix --------------------> W4 validation
        +--> W1 locale write/read map ---------------> W4 content backfill
        +--> W1 entitlement schema ------------------> W2 dual-read resolver
        |                                            +-> W4 entitlement backfill
        |
        +--> W1 AI quota naming/tests ---------------> W4 aggregate verification
        +--> W1 Hackathon compatibility -------------> W6 vocabulary cleanup
        |
        +--> W3 credential function/trigger --------> W4 event repair/verify

D-01 refund decision ----------> W2/W4 access switch (blocked)
D-02 admin lifecycle ----------> grant/revoke endpoint (partially blocked)
External-consumer inventory ---> W6 destructive cleanup only
```

## 33. Implementation waves

### Wave 0 — Guardrail and baseline

Create baseline manifest and CI specification; capture catalog/history fingerprints; classify expected historical drift. No runtime schema/data behavior change.

### Wave 1 — Non-breaking preparation

Implement project seed-only sync, typed course-content map, entitlement table design/migration, AI quota naming/tests and Hackathon aliases. These are additive or behavior-preserving except the project overwrite fix, which is isolated and reversible by forward repair.

### Wave 2 — Reader/writer switch preparation

Introduce entitlement resolver in compare mode, move course content writers/readers under compatibility rules, switch instructor payment-history reader, and stop relying on payment snapshots as truth. D-01 blocks refund access transition only.

### Wave 3 — Server-side reconciliation

Deploy credential Candidate C function/trigger, any entitlement RLS/RPC, and only invariant changes that passed preflight.

### Wave 4 — Backfill, verify, stop legacy writes

Backfill locale/entitlement/project/event data in bounded batches; compare old/new results; stop duplicate writes after validation.

### Wave 5 — Main rollout

Main deployment after explicit confirmation, full Staging pass, backup/recovery readiness and post-deploy catalog/business checks.

### Wave 6 — Cleanup and performance

Remove legacy fields/policies/functions/indexes only after observation and external-consumer review. Index/performance work remains separate.

## 34. Rollback strategy

| Change type | Rollback direction |
|---|---|
| CI/doc baseline | Revert documentation/workflow PR; no data impact |
| Additive table/column | Disable new reader/writer; retain data; do not drop during incident |
| Project seed-only trigger | Forward restore prior behavior only if required; never overwrite edited projects as rollback shortcut |
| Credential trigger | Forward replace function/trigger; event dedupe makes repair idempotent |
| Content/entitlement reader switch | Feature/config switch to old projection; preserve new rows for analysis |
| Backfill | Idempotent key, audit list, forward repair; avoid destructive down migration |
| Main rollout | Stop rollout, restore compatible code path, use backup/recovery only for data corruption |

## 35. Staging validation checklist

- [ ] Target verified as `corelia-staging` / `opoozbmfbezkrpzxsusx`.
- [ ] Migration chain and catalog fingerprint match approved expected baseline/drift manifest.
- [ ] Credential Candidate C tests pass, including minted-without-ID and retry.
- [ ] Project update after seed leaves portfolio fields unchanged.
- [ ] Locale read/write/fallback and backfill conflict report pass.
- [ ] Payment/access old/new resolver comparison has zero unaccepted mismatch.
- [ ] RLS actor matrix passes for access entitlement and all changed functions.
- [ ] AI success/fail/partial usage semantics are verified.
- [ ] No invariant preflight violation is unresolved.
- [ ] Rollback/forward-repair runbook is rehearsed for each migration.

## 36. Production rollout checklist

- [ ] Direct confirmation to change Main has been received.
- [ ] Project/ref/branch target is `corelia-app` Main / `lawhkvyyoznwygzsycan`.
- [ ] Approved migration versions and artifact hashes are recorded.
- [ ] Backup/recovery and lock estimates reviewed.
- [ ] Staging validation evidence attached to release.
- [ ] Apply in Wave order; no combined cleanup in the same release.
- [ ] Post-deploy catalog, migration history, RLS, trigger/function and row-count checks pass.
- [ ] Payment/access/credential/project/AI business smoke tests pass.
- [ ] Error/denial/event anomaly monitoring is reviewed before legacy write stop.

## 37. Deferred performance/index work

Deferred by instruction. Known Staging-only indexes and Main-only profile/voucher index shape differences require workload evidence, table/index size, query plans and a representative usage window. They do not block this plan or Task 3 semantics.

## 38. Deferred cleanup work

- Main-only `ai_vouchers` fields/checks;
- `enrollments.paid_*` compatibility snapshots;
- duplicated locale content in base `data`;
- `contest` vocabulary/source aliases;
- RLS policy shape consolidation;
- obsolete migration helpers/function variants; and
- unused indexes/log retention changes.

Each needs no-reader/no-writer/no-trigger/no-RPC/no-known-external-consumer evidence, compatibility expiry and recovery direction before removal.

## 39. Final readiness verdict

1. **Baseline đủ tin cậy để bắt đầu implementation chưa?** Có, cho Wave 0 và Wave 1: current live/repo divergence đã được phân loại và có forward-only freeze strategy.
2. **Task 3 đã CLOSED chưa?** Đã **CLOSED ở mức analysis/decision**: RLS semantic parity resolved, seven function diffs are non-behavioral, credential and voucher canonical targets are explicit. Reconciliation migration itself chưa apply.
3. **7 Source-of-Truth case có bao nhiêu IMPLEMENTATION_READY?** **5/7**: Course content, Payment/Enrollment compatibility, Project/Submission, AI quota and Hackathon. Refund/Access is blocked by D-01; Admin Grant is ready for schema preparation but endpoint/revoke lifecycle waits D-02.
4. **Còn blocker nào ngăn bắt đầu Wave 1 không?** Không. D-01 blocks the entitlement state switch later; D-02 blocks grant/revoke product behavior; external consumer inventory blocks only cleanup.
5. **Bước tiếp theo Codex nên thực hiện là gì?** Tạo Wave 0 implementation task: baseline manifest + CI guardrail specification, then a separate Wave 1 task for the project seed-only trigger. Không gộp entitlement/refund change vào task đó.

**Verdict: READY_WITH_BLOCKERS.**

## Appendix A — Change cards

### C-01 — Freeze migration baseline

- **ID / Domain:** C-01 / migration governance.
- **Current state / problem:** live ledger is 139/139 while `origin/main` is 131; historical statement drift exists.
- **Canonical target:** approved release commit plus immutable baseline manifest and expected-drift allowlist.
- **Evidence:** live `schema_migrations`, Git migration trees, deploy workflows.
- **Change type:** CI, DOC, TEST.
- **Dependencies:** none.
- **Positive impact:** future drift is traceable; old history is not rewritten.
- **Negative impact / risks:** adds release discipline and initial baseline maintenance.
- **Migration/data/security risk:** none at runtime.
- **Compatibility / rollback:** documentation and CI change can be reverted without DB impact.
- **Validation:** clean recreate and fingerprint job.
- **Priority / wave:** P1 / Wave 0.

### C-02 — Credential activity reconciliation

- **ID / Domain:** C-02 / credential activity.
- **Current state / problem:** Main requires OC ID and dedupes; Staging/repo emits on minted status but can duplicate.
- **Canonical target:** minted status plus dedupe; OC ID optional payload enrichment.
- **Evidence:** live trigger/function definitions; mint handler can persist minted with unresolved ID; guard was reverted historically.
- **Change type:** MIGRATION, FUNCTION, TRIGGER, TEST, OBSERVABILITY.
- **Dependencies:** C-01 baseline.
- **Positive impact:** one activity event per minted issuance without losing legacy successful mint.
- **Negative impact / risks:** event payload may omit OC ID; repair/backfill needs dedupe query.
- **Migration/data/security risk:** medium event integrity; no access boundary change.
- **Compatibility / rollback:** forward replace trigger/function; event dedupe supports repair.
- **Validation:** minted/no-ID, ID repair, retry and existing-event tests.
- **Priority / wave:** P1 / Wave 3.

### C-03 — Voucher legacy freeze

- **ID / Domain:** C-03 / AI voucher.
- **Current state / problem:** Main-only fields differ from canonical batch/code design.
- **Canonical target:** batch config, voucher code, redemption history; legacy fields retained temporarily.
- **Evidence:** 10 Main rows; percent matches batch; other fields null; no DB routine dependency; repo runtime reads batch.
- **Change type:** DOC, CLEANUP (deferred), TEST.
- **Dependencies:** external consumer inventory before removal.
- **Positive impact:** avoids false schema parity work and unsafe cleanup.
- **Negative impact / risks:** legacy columns remain until stabilization.
- **Migration/data/security risk:** none now; destructive later.
- **Compatibility / rollback:** freeze writes; no immediate schema change.
- **Validation:** repeat distribution/dependency scan before cleanup.
- **Priority / wave:** P2 / Wave 6.

### C-04 — Course locale truth switch

- **ID / Domain:** C-04 / course content.
- **Current state / problem:** base JSON and locale tables both carry user-facing content.
- **Canonical target:** locale table content, base metadata/fallback only.
- **Evidence:** `courses.ts` locale overlay/upsert and base-data writers.
- **Change type:** CODE, MIGRATION, BACKFILL, TEST, CLEANUP.
- **Dependencies:** typed field map, conflict report.
- **Positive impact:** one content writer path and predictable localization.
- **Negative impact / risks:** fallback/content regression or overwrite conflict.
- **Migration/data/security risk:** medium data migration; no primary security risk.
- **Compatibility / rollback:** dual-read and preserve base fallback until observation.
- **Validation:** locale matrix and sampled content diff.
- **Priority / wave:** P2 / Waves 1–4.

### C-05 — Payment snapshot demotion

- **ID / Domain:** C-05 / payment/enrollment.
- **Current state / problem:** payment grant writes `paid_*` on enrollment; instructor UI reads it.
- **Canonical target:** payment transaction for money fact; enrollment is learning relation; `paid_*` compatibility display only.
- **Evidence:** payment grant handler, `src/types/courses.ts`, instructor editor reader.
- **Change type:** CODE, BACKFILL, TEST, CLEANUP.
- **Dependencies:** C-07 entitlement model for full switch.
- **Positive impact:** removes payment truth ambiguity.
- **Negative impact / risks:** old instructor payment display may lack data until reader migration.
- **Migration/data/security risk:** low now; access behavior must not change in this card.
- **Compatibility / rollback:** preserve snapshots and old display until comparison passes.
- **Validation:** transaction/snapshot parity and instructor history UI.
- **Priority / wave:** P1 / Waves 1–4.

### C-06 — Project seed-only sync

- **ID / Domain:** C-06 / project/submission.
- **Current state / problem:** submission updates overwrite independent project fields.
- **Canonical target:** one seed on source creation; project owns later portfolio edits.
- **Evidence:** project unique source key and `ON CONFLICT DO UPDATE` trigger functions.
- **Change type:** MIGRATION, FUNCTION, TRIGGER, TEST.
- **Dependencies:** C-01 only.
- **Positive impact:** eliminates portfolio overwrite bug and preserves user edits.
- **Negative impact / risks:** source corrections no longer propagate automatically.
- **Migration/data/security risk:** medium functional behavior; no destructive data change.
- **Compatibility / rollback:** forward restore only if required; do not overwrite projects to roll back.
- **Validation:** submission insert/update/missing-project/retry scenarios.
- **Priority / wave:** P1 / Wave 1.

### C-07 — Source-aware entitlement preparation

- **ID / Domain:** C-07 / course access/admin grant.
- **Current state / problem:** booleans cannot represent payment/admin/promotion sources or audit/revoke independently.
- **Canonical target:** additive entitlement/source ledger with effective-access resolver.
- **Evidence:** `course_payment_access` schema and payment handlers; no admin source model found.
- **Change type:** MIGRATION, CODE, RLS, BACKFILL, TEST, DOC.
- **Dependencies:** D-01 for refund switch; D-02 for grant lifecycle endpoint.
- **Positive impact:** correct source attribution and safer future refund/admin operations.
- **Negative impact / risks:** dual-read complexity and migration scope.
- **Migration/data/security risk:** high access regression if switched early.
- **Compatibility / rollback:** additive table, compare mode, retain old projection.
- **Validation:** effective-access matrix, duplicate source and actor tests.
- **Priority / wave:** P1 / Waves 1–4.

### C-08 — AI quota semantic split

- **ID / Domain:** C-08 / AI quota.
- **Current state / problem:** attempt window and successful monthly quota are named/understood ambiguously.
- **Canonical target:** successful message quota, request-attempt rate limit and token telemetry are separate.
- **Evidence:** `accessGuards.ts`, `usageAccounting.ts`, tutor success/failure paths.
- **Change type:** CODE, TEST, DOC, OBSERVABILITY.
- **Dependencies:** none.
- **Positive impact:** predictable user messaging and debuggable quota behavior.
- **Negative impact / risks:** product/UI wording changes; no billing rule change.
- **Migration/data/security risk:** none initially.
- **Compatibility / rollback:** preserve counters; switch labels/decision path behind tests.
- **Validation:** success/failure/partial/retry/concurrency cases.
- **Priority / wave:** P2 / Waves 1–2.

### C-09 — Hackathon vocabulary compatibility

- **ID / Domain:** C-09 / Hackathon naming.
- **Current state / problem:** physical schema says hackathon; app contracts still say contest.
- **Canonical target:** hackathon public/domain vocabulary; contest aliases retained temporarily.
- **Evidence:** `hackathon_*` tables and `Contest*` TypeScript/UI mapping.
- **Change type:** CODE, DOC, TEST, CLEANUP.
- **Dependencies:** none.
- **Positive impact:** reduces cross-layer vocabulary ambiguity.
- **Negative impact / risks:** broad type/API surface and compatibility burden.
- **Migration/data/security risk:** none in first pass; source-type rename later.
- **Compatibility / rollback:** aliases preserve current call sites.
- **Validation:** old/new model mapping tests.
- **Priority / wave:** P3 / Waves 1–2.

### C-10 — RLS semantic baseline

- **ID / Domain:** C-10 / authorization.
- **Current state / problem:** raw policy text differs despite equivalent behavior.
- **Canonical target:** semantic fingerprint and existing behavior; defer cosmetic consolidation.
- **Evidence:** live policy/`pg_depend` queries and identical public/private helper delegation.
- **Change type:** CI, DOC, TEST, NO_CHANGE.
- **Dependencies:** C-01.
- **Positive impact:** avoids unsafe policy churn while detecting real future drift.
- **Negative impact / risks:** policy shape remains less uniform temporarily.
- **Migration/data/security risk:** none now.
- **Compatibility / rollback:** baseline-only change.
- **Validation:** actor permission matrix.
- **Priority / wave:** P1 / Wave 0.
