# Frontend Agent Guide

These instructions apply under `src/`.

## Structure and Boundaries

- `App.tsx` owns React Router v7 route composition and lazy route imports.
- `pages/<feature>/` owns route-level composition. For a large page, colocate `components/`, `hooks/`, and pure `utils/`; keep the page component focused on composition.
- `features/` contains domain-specific reusable UI/logic that is not a route entry point.
- `components/ui/` contains shared primitives; `components/` contains cross-page UI. Reuse both before adding a new component.
- `lib/` is the established client data/domain layer. Extend a relevant helper instead of issuing new Supabase queries or Edge requests from presentation components.
- `stores/` contains Zustand cross-cutting state. Keep feature-local state in React unless it genuinely needs cross-route ownership.
- `types/` contains shared domain/database types; avoid parallel local shapes when a canonical type exists.

## React, Data, and Auth

- Use `@/…` for internal imports and follow the local file's formatting.
- Put data fetching, polling, subscriptions, redirects, and other side effects in hooks/helpers with cleanup for stale async work. Keep components presentational where practical.
- Parallelize independent reads using the established feature patterns; do not introduce a second cache/data-fetching framework.
- Auth uses Supabase, `useAuth()`/`useAuthStore`, `AuthSync`, and the guards in `components/auth/`. Do not add Firebase code or duplicate auth listeners.
- Use `RequireAuth`, `RequireRole`, and feature-specific guards. Role groups belong in `config/roles.ts`, not inline route arrays.
- Preserve route paths, params, query/hash behavior, and redirects unless explicitly changing navigation behavior.

## UI and i18n

- For UI work, read `docs/DESIGN.md`; do not load it for non-visual tasks.
- Reuse `components/ui/*`, Tailwind v4 semantic tokens, and `cn` from `lib/utils`. Do not add hard-coded palette values or another icon library; current general-purpose icons use `lucide-react`.
- Keep interactive controls accessible: explicit non-submit button types, labels for icon-only controls, meaningful alt text, focus behavior, and adequate touch targets.
- User-facing text uses an existing i18next namespace from `i18n.ts`. Add matching keys to both `locales/vi/<namespace>.json` and `locales/en/<namespace>.json`.
- Keep loading, error, and empty states consistent with representative pages in the same feature.

## Placement and Validation

- New route/page → `pages/<feature>/`; page-only UI/hook → inside that feature folder.
- Cross-page domain UI/logic → `features/<domain>/`; broadly reusable UI → `components/`; data/RPC/Edge helper → `lib/`.
- Place tests next to the relevant helper or in `src/tests/` when they cover cross-cutting regressions.
- Start with `pnpm vitest run <relevant-test-file>`, then run `pnpm lint` and `pnpm build` when TypeScript/UI behavior changed. Add the broader suite when the change crosses features or release parity requires it.
