# Corelia public UI — local review

Local preview: http://127.0.0.1:5178/

Worktree: `/private/tmp/corelia-hackathon-prize-review`.
No commit, push, deployment, database/schema update or production content write was performed.

## Implemented

- Opt-in public presentation: 1280px content, 16/24/32px gutters, 224px desktop sidebar, mobile drawer, responsive headings, flatter cards, visible focus and reduced motion. Authenticated home, Learn, Feed, Account, Achievements, Jobs personal lists, project editing and workspaces do not receive this scope.
- Public header VI/EN switcher; shared course cards across Home, catalog, instructor and public profile. Shared horizontal career cards across Home and Roadmap.
- Simplified guest hero; no duplicate sign-in sidebar. Curriculum initially opens the first section and exposes expanded state. Course and career action columns use 320px; course mobile actions follow the main content.
- Preserved existing Jobs logo and footer changes and Hackathon catalog redesign. Jobs secondary filters collapse; salary/actions wrap on narrow screens. Market bars have a real height, scale, date endpoints and retry state.
- Public search uses scan-friendly rows and retry; translated entity titles have locale-specific cache keys. Job detail separates load failure from missing jobs. Public forms/status pages receive scoped presentation.
- Instructor/profile embedded courses and career courses now apply locale in the data layer. `en-US`, `en_GB`, `vi-VN` normalize correctly. Hackathon legacy aliases prefer translated fields. Brand capitalization, salary periods and Roadmap pluralization fixed.

## Evidence and how to reproduce

- `before/` and `after/`: screenshots for Home, Courses, course detail, Roadmap, career detail, Hackathons, Projects, Jobs, Market, Search, Login, Verify and an instructor page. Baseline screenshots use the base revision in a separate local server on port 5180. Data is live, publicly readable data; Projects currently exercises its real empty state.
- `browser-results.json`: desktop DOM measurements and observed headings. These screenshots use the recorded browser width, not an assumed 1440px.
- `responsive-results.json`: real pages inside a same-origin iframe at CSS widths 360, 390, 768, 1024 and 1440. `client` excludes scrollbars; `scroll > client` would indicate horizontal overflow. Theme changes affect only the local DOM, not account preferences.
- `/artifacts/public-ui/responsive-preview.html`: reproduce responsive checks manually; choose a local route, width and theme.
- `/artifacts/public-ui/fixture-preview.html`: local course/job/project cards with long content, missing/broken images, course progress and curriculum states. Actions are inert; no records are created. Its width selector controls the component container rather than the browser viewport.
- `translation-drafts.json` and `translation-comparison.md`: field-level VI/EN drafts with stable content IDs and source text. Not automatically applied to UI or production.
- `course-content-inventory.json`, `program-content-inventory.json`: read-only inventories restricted to published course introductions and public programs. No lessons, private profiles or external job descriptions were translated.

## Validation boundaries

Automated tests cover public/private presentation boundaries, regional locale normalization and switching instructor language with separate caches. Browser checks cover representative live pages and all public Hackathon tabs. The Learn guest smoke test redirects to Login; authenticated Learn and private dashboards were not exercised with a real session.

A passing overflow measurement is not a complete accessibility audit. Token success/expiry, invitation acceptance, certificate issuance/revocation, OAuth, CAPTCHA completion, authenticated private views and forced network failures still need dedicated fixture-based visual verification. No real email, invitation, certificate or account transaction was triggered. These states must not be marked fully accepted based on these artifacts.

## Content gaps

Rust Survival Kit has English copy in its Vietnamese locale. Digital Assets Market has no English locale. The draft files address their public introductions and outcomes. Roadmap's description/outcome/prerequisite fields are empty in the public data; no facts were invented to fill them. UniHackfest has VI/EN public descriptions and resources. Lesson translations and user/external content remain outside this task.

## Final automated checks

`pnpm test`: 58 files, 332 tests passed. `pnpm lint`: passed. `pnpm build`: passed; existing large-chunk warning remains. `git diff --check`: passed. No changes in Learn, Feed, Account, shared UI primitives or global token definitions. Public presentation and domain locale fixes are covered by the boundary tests.

Keyboard spot check: Tab from the header language control reached Login with a visible solid focus outline. Search with an unmatched query displayed its real empty state.

## Homepage palette update

The approved royal-blue light/dark palette is now applied. See [palette review and evidence](palette/README.md), [contrast calculations](palette-contrast.json), and the `palette/` screenshots. Earlier screenshots in `before/` and `after/` document the layout phase; `palette/` is the latest color reference.
