# Manual QA — Projects — 2026-09-07

Environment: live `https://app.corelia.academy`, Chrome, signed-in `@corelia_edu` (Teaching/Admin visible; not a student-role coverage claim). Entry: `/projects/new?hackathon=unihackfest-2026`. Browser UI testing; all saved changes made through the UI, with no direct API/database operations or application-code changes.

QA record retained for inspection: https://app.corelia.academy/projects/qa-manual-project-20260907

Final title is `[QA] Duplicate slug check`; its original title/summary were overwritten by the create-again test below. No invitations were sent, and no existing non-QA project was intentionally modified. Reaction returned to zero. Browser viewport restored to default. Upload fixtures exist only in `/tmp/corelia-project-qa/`.

## Findings

### P1 — Create flow silently overwrites the existing hackathon project

1. Open the entry URL. Create `[QA] Manual Project 20260907`, slug `qa-manual-project-20260907`, with a summary and selected track/engineering area/technology.
2. Edit the summary to `[QA] Đã chỉnh sửa: kiểm tra lưu tiếng Việt, xuống dòng.\nDòng hai — React & TypeScript.` and save; reload verifies persistence.
3. From the detail page choose `View source` / `Xem nguồn`, then the hackathon's `Tạo / xem dự án` action.
4. The application opens an empty **Create project** form even though this account already has a project for the hackathon.
5. Enter `[QA] Duplicate slug check`, the same slug, the same track/area/technology, and leave the optional summary empty. Submit.

Actual: detail at the **same project URL** now has the new title and no summary. Opening Edit and reloading confirms the replacement persists. No overwrite warning or existing-project context was presented.

Expected: route to the existing project's populated editor, or clearly disclose an update and preserve existing fields. Creating again must not silently erase prior content.

Scope: reproduced for this owner's existing hackathon project using the same slug. Different-slug behavior and collisions with another owner's project were not tested. Source corroboration: `src/pages/projects/ProjectNewPage.tsx` uses `upsertContestSubmission` in its create path and reports the `created` message. This does not establish a cross-account authorization issue.

### P2 — Required taxonomy selections have no visible explanation

With title entered, no-area or no-technology selection keeps Create disabled. Selecting the missing category enables it. Tracks, Engineering areas, and Technologies have no required marker, minimum-selection guidance, or visible explanation for the disabled action. Expected: users can identify what remains required without trial and error.

### P2 — Link validation exposes an internal error code

Enter `https://example.com/qa` in Demo URL and submit an otherwise complete form. Actual toast: `link_unverifiable:demo_url`. The form remains available with its data. Expected: a localized explanation identifying Demo URL and explaining how to correct an unverifiable link. Rejection itself is not classified as a bug; the error presentation is.

### P2 — Unsaved edits disappear on Back without warning

Edit the QA project's title to `[QA] UNSAVED CHANGE`, then choose Back. Navigation immediately returns to detail; no JavaScript or in-page confirmation appears. The original saved title remains. Expected: warn before discarding a dirty form, or offer recoverable draft behavior.

### P3 — Detail hides useful hackathon metadata and uses legacy source URL

Detail shows only a generic `Hackathon` badge and `View source`; it does not identify UniHackfest 2026 by name or display the chosen track/engineering areas/technologies, although selections persist in Edit. `View source` works, but navigates to `/hackathons/unihackfest-2026/overview`. Repository checklist `docs/tests/05-projects-invites-search.md` calls for canonical `/hackathons/:slug` instead of `/overview`. This is a navigation/clarity issue, not a broken destination.

## Executed cases

| Case | Result |
| --- | --- |
| Entry URL resolves UniHackfest 2026 and loads form | Pass |
| Empty form prevents creation | Pass |
| Vietnamese title produces `qa-project-2026-kiem-thu` slug | Pass |
| Manually edited slug survives a subsequent title edit | Pass |
| Title/summary limits exposed by rendered fields | 160 / 1000; boundary submissions not tested |
| Invalid `not-a-url` submit | Pass: native validation focuses Demo URL, no navigation |
| Unverifiable HTTP URL | Rejected, but raw error code; P2 above |
| Create without optional URLs | Pass |
| Optional empty summary | Accepted; empty description state shown |
| Required area and technology selections | Enforced, missing guidance; P2 above |
| Select multiple technologies | Pass; persisted in Edit |
| Team picker opens, search nonexistent account, Done | Pass: clear empty result and closes |
| Create QA project | Pass: success toast, detail and gallery entry |
| Edit summary with Vietnamese and newline | Pass |
| Reload saved detail/editor | Pass: persisted content |
| Like then Unlike | Pass: count 0 → 1 → 0; filtered gallery later also 0 |
| Back to Projects | Pass |
| Filter by UniHackfest 2026 | Pass: QA project present |
| Sort Oldest | Control and URL update; only one project, ordering not meaningfully verified |
| Filter by unmatched Python | Pass: no-projects state |
| Clear Python filter | Pass: QA project returns |
| Gallery card opens detail | Pass |
| Source button returns to hackathon | Destination works; legacy URL noted above |
| Create/view action after existing submission | Fail: empty creation form, enables overwrite |
| Create again with same slug | Fail: overwrites existing QA project; P1 above |
| Unsaved edit → Back | No warning; P2 above |
| Mobile editor at 390×844 | Top form visually readable; no horizontal overflow (document 375px, viewport 390px). Full mobile journey not covered |
| Vietnamese editor | Labels and taxonomy translations load correctly; initial switch during viewport reset briefly reverted, not independently reproducible as a product bug |
| Console sample | No error/warning entries in captured samples; not a guarantee of no network errors |

## Not completed / limitations

- Upload: file picker opened, but browser extension rejected file selection with `Not allowed`. Unsupported type, oversized image, valid logo, screenshots, moderation, reorder/remove and upload persistence remain unverified. Enable **Allow access to file URLs** for the ChatGPT Chrome extension to continue.
- Invitations: no second test participant/token; sending, accepting, declining, member permissions and cross-account ownership not exercised. No messages sent.
- Not covered: logged-out/student/other-owner roles, deadline/ineligible states, standalone non-hackathon creation, different-slug collision, successful external-link moderation, delete/recovery, full mobile journey, multi-record sort/pagination, and keyboard/screen-reader audit.
- Tests ran on the supplied live environment. The retained public QA project requires deliberate cleanup after review; it was not permanently deleted.
- No test suite/build run because this deliverable changes documentation only and reports manual behavior of the deployed app.
