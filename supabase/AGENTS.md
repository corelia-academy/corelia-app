# Supabase Agent Guide

These instructions apply under `supabase/`. Read `docs/db-baseline/README.md` for database-governance work and `functions/corelia-api/README.md` for API/runtime work.

## Database and Migration Rules

- The ordered files in `migrations/` are the canonical schema-change history. Applied migrations are immutable: never edit, rename, delete, or reorder them.
- Put every schema, RLS, grant, function, trigger, view, storage-policy, or data-contract change in a new forward migration. Do not make undocumented live-database edits.
- Create migration filenames with the repository's Supabase CLI workflow; do not invent timestamps manually. Review nearby recent migrations for SQL conventions without reading the whole history.
- Direct production SQL is incident-only and must be reconciled by a forward migration using `.github/ISSUE_TEMPLATE/emergency-db-sql.yml`.
- Do not update frozen baseline or drift allowlists merely to silence a check. Those files are release governance evidence.

## Security Boundaries

- Enable and test RLS for exposed tables. Policies must express ownership/authorization, not only `TO authenticated`; update policies need appropriate `USING` and `WITH CHECK` rules.
- Never authorize from user-editable metadata. Treat views and `SECURITY DEFINER` functions as privileged surfaces; restrict grants/search paths and follow established private-helper patterns.
- Never expose service-role/secret keys to `src/` or `VITE_*` variables. Frontend clients use the publishable/legacy anon key and rely on RLS.
- `corelia-api` intentionally has `verify_jwt = false` because it mixes public and protected operations. Each protected operation must perform the established Bearer-token and authorization checks; do not assume the gateway authenticates it.
- Scheduler and generator functions with gateway JWT verification disabled must retain their existing explicit secret/auth checks.

## Data and Edge Function Boundaries

- Browser-safe CRUD/RPC calls belong in existing helpers under `src/lib/`; reuse those helpers instead of querying from page components.
- Secret-bearing, administrative, webhook, transactional-email, or otherwise privileged work belongs in Edge Functions.
- `corelia-api` is one entry point routed by the `op` query parameter. Search its router and handlers before adding an operation; extend the closest domain handler rather than creating a parallel function.
- Keep shared function infrastructure in `functions/corelia-api/lib/` and domain handlers in their existing domain folders. Preserve the runtime's Deno-compatible import/style patterns.
- Local function secrets belong only in ignored `supabase/functions/.env`, initialized from `.env.example`.

## Validation

Use the smallest relevant checks, then broaden:

1. Edge/helper test: `pnpm vitest run supabase/functions/<path>.test.ts`
2. Static database governance: `pnpm db:verify`
3. For migration/schema changes, start the isolated local Supabase stack and run `pnpm db:verify:local`; stop it with `pnpm exec supabase stop --no-backup`.
4. Run `pnpm test`, `pnpm lint`, and the relevant build when the contract affects frontend consumers or release parity.

Before remote rollout, verify migration ordering/state and follow `docs/RELEASE_PROCESS.md`. Staging must succeed before Production; a partially applied migration requires investigation and usually a forward fix, not history rewriting or blind reruns.
