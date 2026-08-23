# Corelia database baseline

This directory freezes the approved migration and audited live-state baseline for Wave 0. It is governance data, not a migration and not a schema source file.

## Canonical rule

The migration chain at an approved release commit is the canonical record of schema change. Applied migrations are immutable. A schema/RLS/function/trigger change must be a **new** migration under `supabase/migrations`.

The live catalog is runtime state to verify, never a place to make an undocumented schema edit. Emergency SQL is allowed only through the incident template and must receive a forward-only reconciliation migration.

## Files

| File | Purpose |
| --- | --- |
| `baseline.json` | Generated immutable migration file list, SHA-256 values, commit and frozen live/catalog summary. |
| `baseline-context.json` | Audited Main/Staging live history and catalog counts merged into `baseline.json` at freeze time. |
| `expected-drift.json` | Historical/intentional drift allowlist. Unknown or expired drift fails verification. |

## Local commands

| Command | Meaning |
| --- | --- |
| `pnpm db:baseline:verify` | Fails if a frozen migration is changed, deleted, renamed, malformed or collides. New later migrations are allowed. |
| `pnpm db:guard:test` | Tests the guardrails, including known vs unexpected history drift. |
| `pnpm db:verify` | Runs both static guardrails. |
| `pnpm db:verify:local` | Resets the **local** Supabase database only; never use `--linked`. Requires Docker/local Supabase and skips seed data. |

## Catalog fingerprint capture

`node scripts/db/catalog-fingerprint.mjs --input <read-only-catalog-export.json> --output <fingerprint.json>` creates raw and conservative semantic fingerprints for tables, constraints, RLS, functions and triggers. Indexes are recorded but report-only in Wave 0.

The tool normalizes line endings and trailing whitespace only. It deliberately does not rewrite SQL predicates or function bodies; a fingerprint mismatch is evidence for review, not permission to add a broad allowlist entry.

## Protected live-history comparison

The repository does not store a database password or service-role key. An authorized protected job/operator must provide a read-only JSON export in this shape:

`{ "projectRef": "...", "migrations": [{ "version": "YYYYMMDDHHMMSS", "name": "...", "statementSha256": "optional" }] }`

Then run `node scripts/db/verify-live-history.mjs --environment main --project-ref lawhkvyyoznwygzsycan --input <export.json>` (or the exact staging ref). The verifier fails closed on a wrong project ref and on unknown drift.

`.github/workflows/db-live-history-verify.yml` is a manually dispatched protected interface for the same comparison. It requires a least-privilege `SUPABASE_MAIN_READONLY_DB_URL` or `SUPABASE_STAGING_READONLY_DB_URL` secret in the matching GitHub Environment. The connection role must have SELECT only on `supabase_migrations.schema_migrations`; service-role credentials are not acceptable for this job.

## Deployment discipline

1. Create a new migration.
2. Run `pnpm db:verify` and the local recreate test.
3. Deploy to Staging and validate catalog/data/authorization behavior.
4. Obtain explicit Main approval.
5. Deploy to Main and run the protected read-only history/catalog verification.
6. Update the baseline only at the next approved release freeze; never edit old migration files to make history look tidy.

`deploy-prod.yml` still contains historical `migration repair` for `20260709000009`. It is compatibility handling, not the normal migration workflow and must not become a dependency of new migrations.
