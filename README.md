# Corelia App

Vite + React 19 + TypeScript SPA. Auth, database, and storage use **Supabase**; backend APIs live in **Supabase Edge Functions** (`corelia-api`). The frontend runs on **Cloudflare Workers**, built and deployed automatically by Cloudflare from the connected `staging` and `main` branches. The UI and content support `vi`, `en`, `zh-CN`, `zh-TW`, `ko`, `es`, and `ja`.

## Releases

Release notes for each version live in [docs/releases](docs/releases) and on [GitHub Releases](https://github.com/corelia-academy/corelia-app/releases). The flow is `work branch → staging → PR to main`; see [Release process](docs/RELEASE_PROCESS.md) for gates, triggers, and failure handling.

## Documentation

See the [documentation index](docs/README.md) for feature guides, QA, and operations. The [Feed guide](docs/feed/README.md) describes the proposed community feed and retirement of the legacy activity stream.

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

- **Frontend (Cloudflare Workers):** do not deploy from a terminal. Cloudflare builds and deploys when `staging` or `main` changes. Verify the Cloudflare build for the commit and the live domain. The `deploy:*` scripts in `package.json` only build the artifact for the matching mode.
- **Supabase migrations and Edge Functions:** deployed by the GitHub workflows (`Deploy Staging` on push to `staging`, `Deploy Production` by manual dispatch from `main`). See [Release process](docs/RELEASE_PROCESS.md). For a single local function deploy:

```bash
pnpm functions:deploy
```

## GitHub Actions

Workflows under [.github/workflows](.github/workflows) build with Vite and expect these **repository/environment secrets** (names match `VITE_*` in CI):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` and/or `VITE_SUPABASE_ANON_KEY` (at least one must be set for the client key)
- Optional: `VITE_OCID_CLIENT_ID`, `VITE_OCID_REDIRECT_URI`, `VITE_YOUTUBE_API_KEY`

The workflows in this repository do not publish the frontend. Cloudflare automatically builds and deploys the frontend from its connected Git branches. Verify the Cloudflare deployment and live domain independently when a release contains browser-app changes; no GitHub frontend deployment workflow or Cloudflare API token is required.

## React Compiler

The React Compiler is enabled for this project. See [React Compiler](https://react.dev/learn/react-compiler) for behavior and performance notes.

## ESLint (optional tightening)

For stricter type-aware rules, consider extending `typescript-eslint` recommended type-checked configs in [eslint.config.js](eslint.config.js) and setting `parserOptions.project` to your tsconfigs.
