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
