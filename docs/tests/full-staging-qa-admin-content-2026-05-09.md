# Full staging QA — admin/content pass

- Date started: 2026-05-09 21:34 GMT+7
- Staging URL: https://staging.corelia.academy/
- Requested scope: logged-in admin pass; create test content as needed; capture UX/UI improvement ideas.
- Current status: **blocked on authenticated browser/session access from automation**.

## Access blocker

The tester automation can reach staging as a guest, but cannot currently attach to the Chrome/browser session where admin is logged in. The active Chrome process is not exposing a DevTools websocket port, and AppleScript could not access a front Chrome window from this runtime.

To continue the live authenticated test, use one of these options:

1. Open staging in a dedicated automation Chrome profile with remote debugging, then log in there.
2. Provide disposable staging credentials for admin/instructor/student test accounts.
3. Provide a short-lived staging auth token/cookie export if the team is comfortable with that.

## Route/capability map from source

### Public / guest

- `/`
- `/login`
- `/confirm-signup`
- `/auth/signup-verified`
- `/ocid-redirect`
- `/courses`
- `/courses/:id`
- `/career`
- `/career/corelia/:slug`
- `/career/:handle/:slug`
- `/instructors/:id`
- `/roadmap`
- `/hackathons`
- `/hackathons/:slug/{overview,timeline,prizes,rules,faqs,projects}`
- `/projects`
- `/search`
- `/u/:handle`
- `/:handle/*` fallback to public profile redirect

### Authenticated user

- `/checkout/course/:courseId`
- `/checkout/success/:purpose/:courseId`
- `/learn/:courseId`
- `/learn/:courseId/lesson/:lessonId`
- `/account/{profile,cv,billing,settings,projects,instructor}`
- `/hackathons/:slug/manage/:section`

### Contest manager / instructor workspace

- `/hackathons/manage`
- `/hackathons/new`
- `/instructor/courses`
- `/instructor/courses/new`
- `/instructor/courses/:id/edit`
- `/instructor/career-tracks`
- `/instructor/career-tracks/new`
- `/instructor/career-tracks/:id/edit`
- `/instructor/profile`
- `/instructor/contracts`
- `/instructor/invoices`
- `/instructor/payments`

### Admin

- `/admin`
- `/admin/dashboard`
- `/admin/instructors`
- `/admin/instructors/:id`
- `/admin/hackathons/*` currently routes to NotFound
- `/instructor/instructors` redirects admin/support to `/admin/instructors`

## Proposed test content to create once authenticated

Use clear QA prefixes so it can be found and removed later:

- Course: `QA Smoke Course 2026-05-09`
  - free/public lesson if supported
  - paid/test checkout path if supported
  - at least one lesson for `/learn/:courseId/lesson/:lessonId`
- Career track: `QA Smoke Career Track 2026-05-09`
  - link the QA course
  - publish if safe on staging
- Hackathon: `QA Smoke Hackathon 2026-05-09`
  - overview, timeline, prizes, rules, FAQs populated
  - application open if staging policy allows
  - one co-organizer/reviewer/mentor scoped email if test users exist
- Project: `QA Smoke Project 2026-05-09`
  - associated with account and optionally hackathon
- Instructor profile: QA display name/avatar/bio updates if safe

## UX/UI notes captured so far

- Empty states are working, but staging currently has no published courses/career tracks/hackathons; this makes public smoke testing shallow. Recommendation: keep a stable published QA seed set on staging.
- `/not-a-real-path-qa` falls through to `/:handle/*` and displays `User not found` at `/u/not-a-real-path-qa`. This may be intentional for profile handles, but for arbitrary unknown paths it can feel confusing. Consider reserving known public handle patterns or showing a generic NotFound when the path shape clearly is not a user handle.
- `/admin/hackathons/*` is explicitly NotFound while hackathon management lives under `/hackathons/manage` and `/hackathons/:slug/manage/*`. If admins expect hackathon controls under Admin, add a redirect or explanatory empty page.

## Next live QA checklist once authenticated

- Verify admin gate and admin users/dashboard/instructors pages.
- Create/update instructor profile if admin has instructor workspace access.
- Create QA course, verify public detail and learn routes.
- Create QA career track and verify public list/detail.
- Create QA hackathon and verify public tabs plus management tabs.
- Verify account profile/CV/billing/settings/projects.
- Verify i18n/theme/404/offline behavior while authenticated.
- Export/import manual checklist state after pass.
