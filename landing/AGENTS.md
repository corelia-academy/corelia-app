# Landing Agent Guide

These instructions apply under `landing/`.

## Project

Astro 5 marketing site for `https://corelia.academy` (home, roadmap, case studies, blog, contact). It is a separate app from the React SPA at the repository root and shares only the pnpm workspace. It was imported squashed from `corelia-academy/corelia-landing@632e589`; that repository keeps the full history.

## Structure

- `src/pages/` — routes. English is the default locale at `/`; Vietnamese lives under `/vi/` (see `astro.config.mjs` and `src/i18n/`).
- `src/pages/[...locale]/{courses,hackathons,jobs}/` — the SEO catalog: server-rendered (`prerender = false`) in every site locale (`/`, `/vi`, `/zh-cn`, `/zh-tw`, `/ko`, `/ja`, `/es`) from public Supabase rows (`src/lib/catalog.ts`). A locale without a translation is `noindex` with a canonical to the language the content is written in; job postings are indexed only at the English URL and only when their source allows it. UI copy: `src/i18n/catalog.ts`. `/sitemap-catalog.xml` lists them; `@astrojs/sitemap` covers the static pages.
- `src/components/` — `.astro` sections plus React islands (`@astrojs/react`).
- `src/content/blog/` — published blog and case-study Markdown (schema in `src/content.config.ts`). `blog/` at this level holds unpublished drafts.
- `src/layouts/BaseLayout.astro` — `<head>`, canonical, robots, Open Graph/Twitter metadata.
- `src/components/common/header.astro` + `LandingHeader.tsx` — the site header shared with the learning app (`packages/ui`, `@corelia/ui/site-header`). Change navigation, header copy and styling there, not per page.
- `public/_redirects` — permanent redirects served by Cloudflare static assets.
- `tools/blog-editor/` — local blog editing tool (`pnpm --filter corelia-landing blog:editor`).

## Rules

- User-facing copy goes through `src/i18n/translations.ts` for both `en` and `vi`.
- Every page sets `title`, `description` and `canonicalUrl` through `BaseLayout`; canonical URLs use `https://corelia.academy` without a trailing slash.
- When a URL changes, add a 301 to `public/_redirects` instead of breaking the old path.
- Links into the learning app use `PUBLIC_APP_URL` (default `/learn`, same origin). Course, hackathon and job links point at this site's catalog.
- Public build variables are listed in `.env.example`; the catalog needs `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Build and Deploy

- Run from the repository root: `pnpm landing:dev`, `pnpm landing:build`.
- `@astrojs/cloudflare`: prerendered pages are static assets in `dist/`, catalog pages run in `dist/_worker.js` (`wrangler.jsonc`, `drop-trailing-slash`). Unknown paths render the prerendered 404 page.
- Worker names: `corelia-landing` (production) and `corelia-landing-staging` (`--env staging`). Always pass `-c wrangler.jsonc` (the repository root has its own Wrangler config) and the environment explicitly, e.g. `npx wrangler deploy -c wrangler.jsonc --env staging`.
