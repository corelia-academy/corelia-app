# Global navigation and palette follow-up

User requested the new Roadmap navigation style throughout the application, superseding the previous restriction to public routes.

- MainLayout now always uses the branded shell, 224px desktop sidebar, shared active state, focus styling and language switcher. The existing drawer below 1024px remains.
- Brand palette is imported at application entry, including standalone auth/status and Learn. It no longer depends on the current route. Existing theme selection and storage are unchanged.
- Content sizing remains route-specific: private workspaces and Learn retain their functional layouts.
- Verified 18 combinations of route and theme using real MainLayout/LearnLayout with inert placeholder content in navigation-preview.html. These are shell fixtures, not authenticated page-content tests. Results: navigation-results.json. Light/dark screenshots accompany this report.
- Full suite: 58 files / 332 tests pass. Lint and build pass; existing bundle-size warning remains.
- This report records local verification before the user-authorized staging → main release. No production content edits are included.
