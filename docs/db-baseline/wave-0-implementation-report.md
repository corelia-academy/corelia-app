# Wave 0 implementation report

> Date: 2026-08-23
> Scope: migration governance, baseline and CI guardrails only. No schema, business behavior or remote database was changed.

## Verdict

**PARTIAL — implementation and static/application validation passed; the isolated local migration recreate could not run on this workstation because Docker is unavailable.** Both deployment workflows now require that recreate job in GitHub Actions before any Staging or Production migration command executes.

## Files and runtime effect

| Area | Purpose | Runtime impact |
| --- | --- | --- |
| `docs/db-baseline/` | Frozen migration hashes, audited state context, drift allowlist and rule documentation | None at application runtime |
| `scripts/db/` | Migration, drift, catalog and read-only history verifiers with tests | Local/CI verification only |
| `.github/workflows/db-guardrails.yml` | Pull-request static guardrail and isolated local recreate | CI only |
| `.github/workflows/db-live-history-verify.yml` | Protected manually dispatched Main/Staging read-only ledger verification | CI only; requires least-privilege secret setup |
| `.github/workflows/deploy-staging.yml`, `deploy-prod.yml` | Full pre-deploy gate before remote migration commands | Deploys wait for verification |
| PR and emergency SQL templates | Declaration, exception and reconciliation capture | Review/process only |

## Guardrail status

| Guardrail | Status | Evidence |
| --- | --- | --- |
| Released migration immutability | IMPLEMENTED | SHA-256 manifest + changed/deleted fixture tests |
| Version/name/order collision | IMPLEMENTED | Strict 14-digit filename and duplicate-version validation |
| DB change declaration | IMPLEMENTED | PR heuristic, declaration and maintained exception-label path |
| Clean migration apply | PARTIAL | Isolated CI job exists; local run blocked by unavailable Docker |
| Catalog fingerprint | IMPLEMENTED | Deterministic raw/conservative semantic fingerprint + normalization test |
| Expected drift allowlist | IMPLEMENTED | Structured metadata and expiry validation |
| Protected remote history verification | PARTIAL | Manual protected workflow exists; environment must provide least-privilege read-only URL |
| Emergency SQL reconciliation | IMPLEMENTED | Issue template requires target, actor, SQL, validation and reconciliation deadline |

## Frozen baseline

- Repository commit: `71db35f8f28ae260d458ee1b6034a03c9bdd6e30`.
- Repository migration count: 139.
- Latest migration: `20260818120000_clean_legacy_manual_mint_templates.sql`.
- Main and Staging live ledger baseline: 139 applied migrations through `20260818120000`.
- Historical drift recorded instead of rewritten: Main provenance gap, 12 statement text differences/two null statement records, RLS/function serialization drift, and Main-only legacy `ai_vouchers` fields.

## Tests executed

| Command | Result | Meaning |
| --- | --- | --- |
| `pnpm db:verify` | PASS | Baseline, allowlist and 12 guardrail tests passed |
| `pnpm test` | PASS | 22 test files / 107 tests passed |
| `pnpm lint` | PASS | ESLint passed |
| `pnpm build:staging` | PASS | Typecheck and staging build passed; existing chunk-size warnings remain |
| `pnpm build:prod` | PASS | Typecheck and production build passed; existing chunk-size warnings remain |
| `pnpm db:verify:local` | BLOCKED | Docker unavailable; no local reset was performed |
| `git diff --check` | PASS | No whitespace error |

## Safety verification

- No Main database write.
- No Staging database write.
- No released migration edit, deletion, rename or repair.
- No business behavior change.
- No Wave 1 implementation.
- No deploy, commit or push.

## Remaining blockers

1. Docker/local Supabase is unavailable on this workstation, so the clean recreate remains unexecuted locally.
2. GitHub Environment secrets `SUPABASE_MAIN_READONLY_DB_URL` and `SUPABASE_STAGING_READONLY_DB_URL` must be configured with least-privilege read-only roles before protected live history verification can run.

## Next step

Run the new CI workflow on a branch/PR and confirm its isolated migration recreate passes. Only then is Wave 0 fully verified for Staging/Main deployment. The next implementation scope remains C-06 Project seed-only sync (Wave 1), not part of this change.
