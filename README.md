# Corelia App

Vite + React 19 + TypeScript SPA. Auth, database, and storage use **Supabase**; backend APIs live in **Supabase Edge Functions** (`corelia-api`). Production hosting is deployed with **Cloudflare Workers** via Wrangler.

## Prerequisites

- Node 22+
- [pnpm](https://pnpm.io/) 9+
- A Supabase project (URL + publishable key, or legacy anon key)

## Environment

1. Copy [.env.example](.env.example) → `.env.development` (and `.env.staging` / `.env.production` for other modes if needed).
2. Set **required** variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (recommended; matches [Supabase React quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs)) **or** `VITE_SUPABASE_ANON_KEY` (legacy)
3. Optional: `VITE_CORELIA_FUNCTIONS_URL`, OCID, SePay API overrides, YouTube, beta feedback form — see comments in `.env.example`.

## Local development

```bash
pnpm install
pnpm dev
```

### Edge Functions (local)

```bash
cp supabase/functions/.env.example supabase/functions/.env
pnpm functions:serve
```

All Edge Functions now share `supabase/functions/.env` as the local secrets file. You can reuse the same file for hosted sync with `supabase secrets set --env-file supabase/functions/.env`.

## Build

```bash
pnpm build              # default mode
pnpm build:dev
pnpm build:staging
pnpm build:prod
```

## Deploy

- **Workers (app):** after build, deploy with Wrangler (see [wrangler.jsonc](wrangler.jsonc)):

```bash
pnpm deploy
```

- **Supabase Edge Functions:**

```bash
pnpm functions:deploy
```

## GitHub Actions

Workflows under [.github/workflows](.github/workflows) build with Vite and expect these **repository/environment secrets** (names match `VITE_*` in CI):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` and/or `VITE_SUPABASE_ANON_KEY` (at least one must be set for the client key)
- Optional: `VITE_OCID_CLIENT_ID`, `VITE_OCID_REDIRECT_URI`, `VITE_YOUTUBE_API_KEY`, `VITE_BETA_FEEDBACK_FORM_URL`

Replace the placeholder “Hosting deploy” step in each workflow with your real host command (e.g. `wrangler deploy` or Cloudflare Pages) when ready.

## React Compiler

The React Compiler is enabled for this project. See [React Compiler](https://react.dev/learn/react-compiler) for behavior and performance notes.

## ESLint (optional tightening)

For stricter type-aware rules, consider extending `typescript-eslint` recommended type-checked configs in [eslint.config.js](eslint.config.js) and setting `parserOptions.project` to your tsconfigs.
