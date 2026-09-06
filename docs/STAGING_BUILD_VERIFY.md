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

## Stale chunk recovery verification

The frontend installs a `vite:preloadError` recovery handler before React mounts. It may reload the current URL once per tab within a 60-second window. A repeated failure must stop auto-reloading and fall through to the localized error screen. Recovery must not clear `corelia-auth` or otherwise sign the user out.

### Local Worker routing

Start the production-style preview with `pnpm preview`, then verify:

```sh
curl -i http://localhost:8787/
curl -i http://localhost:8787/courses/example
curl -i http://localhost:8787/assets/__missing_stale_chunk__.js
```

Expected results:

- `/` and the deep link return the SPA HTML with `200` and a revalidating cache policy.
- A real hashed file under `/assets/` returns its JavaScript or CSS MIME type and the immutable cache policy.
- The fake asset returns `404`, `Content-Type: text/plain`, and `Cache-Control: no-store`; it must never return `index.html`.

### Cross-deployment staging acceptance

1. Open staging build A, record `window.__CORELIA_BUILD__`, and keep the tab open.
2. Publish build B through the external frontend pipeline with at least one changed lazy chunk hash.
3. In the build A tab, navigate to a lazy-loaded route that has not been opened in that tab.
4. Confirm the tab reloads no more than once, preserves the full URL, loads build B, and retains the signed-in session.
5. Simulate or retain an unavailable chunk long enough to confirm a repeated failure shows the localized fallback instead of entering a reload loop.
6. In Cloudflare observability, confirm the old path is logged as `missing_static_asset` without query parameters or user data.

The frontend publication system is outside this repository. Before staging or Production acceptance, confirm it runs `wrangler deploy` from this repository so the Worker entry and static assets are published together.

## Auth lock re-audit checklist

After deploying frontend + backend:

1. **Home** — load logged-in and anonymous; no `lock:sb-…-auth-token` steal in console during first paint.
2. **Hackathons** (`/hackathons`) — catalog load; mở một hackathon và kiểm tra đủ năm tab URL `overview`, `prizes`, `timeline`, `resources`, `projects`.
3. **Admin dashboard** — pinned programs load without profile errors.
4. **Hackathon detail** — đăng ký tức thời, mở/tạo project và xác nhận không còn workspace, registration review, judging hoặc role invite cũ.
5. **Hackathon admin** (`/admin/hackathons`) — admin/support mở được editor; role khác bị admin gate chặn.
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
