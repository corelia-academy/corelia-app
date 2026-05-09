# Guest unauth smoke test — staging

- Date: 2026-05-09 21:29–21:33 GMT+7
- URL: https://staging.corelia.academy/
- Browser: Google Chrome headless via DevTools Protocol, clean temporary profile
- Auth state: not logged in / guest
- Build observed: `window.__CORELIA_BUILD__ = { version: "0.2.1" }`

## Summary

Guest-facing routes load without blank screen or captured console/log errors in this smoke pass. Protected routes redirect to `/login` as expected for unauthenticated users.

## Passed / observed

- `/` loads home with hero, featured area, quick links, and sign-in CTA.
- `/login` loads email/password form plus Google/GitHub provider buttons.
- `/account/profile` while logged out redirects to `/login`.
- `/admin` while logged out redirects to `/login`.
- `/instructor/courses` while logged out redirects to `/login`.
- `/courses` loads with empty state: `0 results` / `No courses match the current filters.`
- `/career` loads with empty state: `No tracks yet`.
- `/roadmap` loads roadmap content.
- `/projects` loads empty public gallery state.
- `/search` loads search empty/instructional state.
- `/hackathons` loads empty state: `0 total · 0 accepting · 0 running · 0 ended`.
- Unknown path `/not-a-real-path-qa` redirects to `/u/not-a-real-path-qa` and shows `User not found` message.

## Blocked / not covered

- Could not verify public course detail `/courses/:id` because staging currently returns 0 courses.
- Could not verify public career detail `/career/corelia/:slug` because staging currently returns no published career tracks.
- Could not verify public hackathon detail tabs because staging currently returns 0 hackathons.
- Logged-in flows were intentionally not tested per request.

## Notes

No console/log errors were captured during the route smoke pass. Cloudflare scripts are present on the rendered page, but did not block the smoke navigation.
