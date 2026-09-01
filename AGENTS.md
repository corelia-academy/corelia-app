# Corelia Agent Guide

## Project

Corelia is a multilingual learning and credential platform. The browser app uses Supabase for auth, data, storage, realtime, and backend functions.

## Stack

- Node 22+, pnpm 9+, TypeScript (strict), Vite, React 19, React Router 7
- Tailwind CSS 4, Base UI/shadcn-style primitives, i18next
- Zustand for client auth/loading state
- Supabase Postgres/Auth/Storage/Realtime/Edge Functions
- Vitest, ESLint; Cloudflare Workers/Wrangler for the frontend artifact

## Repository Structure

- `src/` — SPA routes, feature pages, shared UI, stores, and client data helpers. Read `src/AGENTS.md` before changing it.
- `supabase/` — migrations, local config, email templates, and Edge Functions. Read `supabase/AGENTS.md` before changing it.
- `scripts/db/` — migration-baseline, drift, live-state, and release verification tools.
- `docs/` — specialized architecture, design, QA, and release references; open only the document relevant to the task.
- `.github/workflows/` — executable source of truth for repository CI and Supabase releases.

Use progressive disclosure: this file → nearest nested `AGENTS.md` → one relevant specialized doc → representative source/tests. Do not scan all migrations, pages, or historical reports by default.

## Architecture Rules

- Routes and guards are assembled in `src/App.tsx`; preserve existing paths, params, redirects, and lazy-loading unless the task changes them.
- Pages compose UI. Put reusable client data access/domain helpers in `src/lib/`, feature effects and synchronization in hooks, and shared primitives in `src/components/`.
- Auth is Supabase-backed. Consume `useAuth()`/`useAuthStore` and existing guards instead of adding session listeners or role logic in pages.
- Browser-safe operations use existing `src/lib` Supabase helpers. Privileged or secret-bearing operations belong in the existing Edge Function/API boundary.
- Search for an existing page, hook, component, helper, RPC, or Edge operation before creating another implementation.
- Share code only after there is a real cross-feature consumer; do not expose another feature's private implementation.

## Development Rules

- Implement the smallest coherent change and keep unrelated formatting/refactors out of the diff.
- Follow neighboring naming, imports, error handling, and test patterns before introducing an abstraction.
- Prefer modifying existing APIs and components; preserve public behavior unless the task requires a contract change.
- Do not add dependencies unless existing tooling cannot reasonably solve the task. Keep dependency versions and `pnpm-lock.yaml` consistent.
- Client environment variables use `import.meta.env` and the `VITE_` prefix. Never commit credentials, service-role keys, or populated `.env` files.

## Validation

Run the smallest relevant check first, then broaden in proportion to risk:

1. Targeted test: `pnpm vitest run path/to/file.test.ts`
2. Relevant/full tests: `pnpm test`
3. Lint: `pnpm lint`
4. Typecheck plus production-neutral build: `pnpm build`
5. Mode-specific artifact when relevant: `pnpm build:staging` or `pnpm build:prod`

Database changes additionally use `pnpm db:verify`; schema/migration changes require the isolated local stack check documented in `supabase/AGENTS.md`. Do not require the full suite for documentation-only or narrowly scoped changes unless CI parity or risk warrants it.

## Git and Remote Workflow

- Before editing, check the current branch and worktree. Never discard, rewrite, or include changes outside the task.
- Before commit, review `git status` and the relevant `git diff`; before push, check for secrets and accidental files.
- Do not force-push shared/protected branches, rewrite public history, bypass checks, or disable tests to make CI green.
- Repository flow is normally `work branch → staging → PR from staging to main → main`.
- `.github/workflows/deploy-staging.yml` auto-runs only for pushes to `staging` matching its Supabase path filters; it verifies and deploys Supabase migrations/functions, not the frontend.
- `.github/workflows/db-guardrails.yml` runs on matching PR changes. The live-history workflow is manual and read-only.
- Production Supabase deployment is a manual dispatch of `.github/workflows/deploy-prod.yml` from `main`; merging to `main` does not trigger it automatically.
- Frontend publication to Cloudflare is a separate pipeline not defined in this repository. Require external pipeline/deployment evidence before claiming frontend deployment success.
- For remote delivery, follow `docs/RELEASE_PROCESS.md` and watch every applicable run to a terminal result. Inspect the failed step before retrying; fix only task-related failures and report unrelated failures as blockers.

## Definition of Done

Local Done means requested behavior is implemented, relevant edge cases/checks pass, and the diff is reviewed. It is the final state for local-only tasks.

For an explicitly requested remote release, Done requires: local validation green → pushed through the repository branch flow → applicable Staging checks/deploy green → PR checks green and merge to `main` → manually triggered Production workflow green → separate frontend deployment and post-deploy checks green when the task changes the frontend. Pending, queued, skipped-but-required, cancelled, or failed gates are not Done.
