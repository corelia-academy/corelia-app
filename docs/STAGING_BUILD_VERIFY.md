# Staging bundle verification

GitHub workflow [Deploy Staging](../.github/workflows/deploy-staging.yml) applies **Supabase** changes only. If you merge backend changes but the browser still shows old behavior (e.g. auth lock logs), confirm the **frontend** was deployed for staging.

## Build identity (app)

Each client build exposes `import.meta.env.VITE_APP_VERSION` — taken from **`package.json`** `version` at build time (also available as `window.__CORELIA_BUILD__.version`).

### Quick check in the browser

1. Open staging in a tab.
2. DevTools → Console, run:

```js
window.__CORELIA_BUILD__
```

You should see `{ version }` matching the app release you expect.

3. Optionally inspect **`index.html`** script `src` URLs — hashed asset names change when a new frontend bundle ships.

## Auth lock re-audit checklist

After deploying frontend + backend:

1. **Home** — load logged-in and anonymous; no `lock:sb-…-auth-token` steal in console during first paint.
2. **Contests** (`/contests`) — list loads; managers see drafts where applicable.
3. **Admin dashboard** — pinned programs load without profile errors.
4. **Contest detail** — open a contest; participant workspace loads registration/submission without repeated auth failures.
5. **Checkout success** — complete or simulate return URL; payment verify runs without hammering `getSession`.
6. **OCID redirect** — callback completes and profile refresh works.

For auth timeline logs during investigation, run the app locally (`pnpm dev`); `installAuthDebugTelemetry` is dev-only.

## Fetch wave timing (`[perf]` markers)

- **Local dev:** `[perf]` timings are logged automatically for major client fetch waves (Home catalog, Contests list, auth profile, spotlight contests, authenticated home dashboard).
- **Staging/production:** rebuild with **`VITE_PERF_DEBUG=true`** in the environment before `pnpm build:*` so the same markers appear in the browser console — useful when comparing waterfalls before/after performance changes.

Key labels to watch:

- `auth.profile.getProfileForUser`
- `home.catalog_wave`
- `home.dashboard_wave`
- `contests.catalog_wave`
- `course.spotlight_contests_wave`

### Logged-in auth profile latency (no ~10s artificial wait)

After the auth pipeline split (session vs profile):

1. Build staging with `VITE_PERF_DEBUG=true`, sign in, hard‑reload on **Home** or **`/u/:handle`**.
2. In the console, `auth.profile.getProfileForUser` should track network time only — **not** a flat ~10000ms from blocking the auth callback.
3. First Supabase REST requests (`profiles`, `contests`, `public_profiles`, etc.) should **start in the same waterfall** as profile (not after a ~10s gap with no network).

If you still see ~10s before any REST activity, confirm the **frontend** bundle on staging matches the expected `window.__CORELIA_BUILD__.version`.
