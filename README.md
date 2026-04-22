# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Environment (Firebase)

- **Local dev**
  - Copy `.env.development.example` → `.env.development`
  - Fill Firebase web config vars (`VITE_FIREBASE_*`)
  - Run:

```bash
pnpm dev
```

- **Staging build**
  - Copy `.env.staging.example` → `.env.staging`
  - Build with staging mode:

```bash
pnpm build:staging
```

## Deploy (dev / staging / production)

This repo is set up to deploy to 3 Firebase projects via GitHub Actions:

- **develop** → `corelia-dev`
- **staging** → `corelia-staging`
- **main** → `corelia-a2e6d` (production)

### 1) Firebase projects (one-time, manual)

Create (if not already) and enable **Auth / Firestore / Storage / Hosting / Functions**:

- `corelia-dev`
- `corelia-staging`
- `corelia-a2e6d` (prod)

### 2) GitHub Environments & Secrets (required)

Create 3 environments in GitHub → Settings → Environments: `development`, `staging`, `production`.

**Environment secrets** — add inside each environment (same name, different values per env):

- `FIREBASE_SERVICE_ACCOUNT` (service account JSON key for that environment)

> Service account JSON: Firebase Console → Project Settings → Service accounts → Generate new private key.

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- Optional: `OCID_CLIENT_ID`, `OCID_REDIRECT_URI`, `YOUTUBE_API_KEY`, `BETA_FEEDBACK_FORM_URL`

### 2.1) Deploy troubleshooting (common CI errors)

- **401 UNAUTHENTICATED / CREDENTIALS_MISSING** (Google APIs)
  - **Symptom**: deploy fails early with “Request is missing required authentication credential”.
  - **Fix**: ensure `FIREBASE_SERVICE_ACCOUNT` secret is present and is a valid service account JSON key; workflows write it to `GOOGLE_APPLICATION_CREDENTIALS`.

- **403 Permission `firebasestorage.defaultBucket.get` denied**
  - **Symptom**: `Unexpected error when fetching default storage bucket` while deploying `--only ... ,storage`.
  - **Fix**: grant the service account (the `client_email` inside the JSON key) a Firebase Storage role on the target project:
    - Recommended: **Firebase Storage Admin** (`roles/firebasestorage.admin`)
    - “Just make it work” (broad): **Firebase Admin** (`roles/firebase.admin`) or **Editor** (`roles/editor`)

- **Functions deploy fails: `functions/lib/index.js does not exist`**
  - **Cause**: `functions/` is TypeScript and must be built to `functions/lib/` before deploying (`functions/package.json` has `"main": "lib/index.js"`).
  - **Fix**: run `pnpm -C functions build` before `firebase-tools deploy --only functions` (workflows already do this).

- **Functions deploy fails: Cloud Billing API disabled**
  - **Symptom**: 403 from `cloudbilling.googleapis.com` during Functions deploy (Gen 2).
  - **Fix**: enable **Cloud Billing API** (`cloudbilling.googleapis.com`) for the project in Google Cloud Console (even if the project is already linked to a billing account).

### 3) Production gate (recommended)

In GitHub → Settings → Environments, create environment `production` and enable **Required reviewers**.
The production workflow uses `environment: production` and will wait for approval.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
