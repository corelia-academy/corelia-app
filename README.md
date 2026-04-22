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

**Repository secrets** (Settings → Secrets and variables → Actions):

- `DEV_FIREBASE_SERVICE_ACCOUNT`
- `STAGING_FIREBASE_SERVICE_ACCOUNT`
- `PROD_FIREBASE_SERVICE_ACCOUNT`

> Service account JSON: Firebase Console → Project Settings → Service accounts → Generate new private key.

**Environment secrets** — add inside each environment (same name, different values per env):

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- Optional: `OCID_CLIENT_ID`, `OCID_REDIRECT_URI`, `YOUTUBE_API_KEY`, `BETA_FEEDBACK_FORM_URL`

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
