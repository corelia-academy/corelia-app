# Homepage-aligned public palette

Local app: http://127.0.0.1:5178/
Responsive review: http://127.0.0.1:5178/artifacts/public-ui/palette-preview.html

Implemented the approved royal-blue palette in `src/styles/public-palette.css`, imported by the public presentation stylesheet. Light and dark surfaces, primary/secondary text, links, selected states and decorative borders use the approved values. CTA remains #1759F1 with white text in both themes; dark links/focus use #91B5FF. Hover colors retain readable white labels. Input/outline control borders use darker/lighter accessible variants; invalid borders retain semantic error colors. Existing success/warning/error tokens and image assets are unchanged.

Scope includes conditional body inheritance while a public page is mounted, so dropdowns and mobile drawer portals inherit the palette. It is removed automatically when the route no longer contains public presentation. Root/global tokens, theme provider, stored preference handling, system preference handling, data services, APIs and schemas were not changed in this palette update.

## Verification

- 332 tests in 58 files passed; lint, production-neutral build and diff whitespace checks passed. Build retains its existing large-chunk warning.
- `responsive.json`: 70 measurements across Home, Courses, Hackathons, Jobs, course detail, Login and Verify at 360/390/768/1024/1440 CSS pixels in light/dark. No measured horizontal overflow. Iframe width is the tested viewport; client width excludes scrollbars.
- Theme harness sends a local storage event to synchronize the existing theme provider and logo. It does not write browser storage or any production data.
- `../palette-contrast.json`: approved text pairs exceed 4.5:1; input/outline boundaries exceed 3:1. Decorative card borders are intentionally subtle. Existing semantic colors are preserved, and this is not a full audit of every inherited semantic/third-party color.
- Fixture primary-button hover observed as #1248C5 light and #2464F5 dark, both with white labels. Keyboard focus observed with a solid royal-blue outline in light mode; dark focus uses the configured light-blue token. Disabled button and invalid input states, course loading/error UI and image fallback are present in the fixture preview; no form was submitted.
- Screenshots include light/dark comparisons for each measured page family and interaction-state fixtures.

## Remaining prior acceptance work

The earlier audit remains authoritative for token-dependent states, certificate success/revocation/expiry, invitation acceptance, authenticated private screens and forced transport failures. This update adds visual loading/error/disabled fixtures but does not claim that all those end-to-end flows have been accepted. No real email, credential, invitation or account action was triggered.

Local only: no commit, push, deployment or production write.
